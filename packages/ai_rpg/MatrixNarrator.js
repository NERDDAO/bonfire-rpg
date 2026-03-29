'use strict';

const {
  MatrixClient,
  SimpleFsStorageProvider,
  AutojoinRoomsMixin,
} = require('matrix-bot-sdk');
const path = require('path');
const fs = require('fs');

const IC_PREFIXES = ['/do ', '/say ', '/attack ', '/use ', '/go ', '/look ', '/talk '];

class MatrixNarrator {
  /**
   * @param {object} opts
   * @param {string} opts.homeserverUrl - e.g. "https://matrix.org"
   * @param {string} opts.accessToken - bot access token
   * @param {string} opts.storageDir - path for bot state (default: ./matrix-storage)
   * @param {function} opts.onICAction - called with (bonfireId, locationRoomId, playerId, text)
   */
  constructor({ homeserverUrl, accessToken, storageDir, onICAction, onMessage }) {
    this.homeserverUrl = homeserverUrl;
    this.accessToken = accessToken;
    this.onICAction = onICAction || (() => {});
    this.onMessage = onMessage || null;

    const storage = new SimpleFsStorageProvider(
      path.join(storageDir || path.join(__dirname, 'matrix-storage'), 'bot.json')
    );

    this.client = new MatrixClient(homeserverUrl, accessToken, storage);
    AutojoinRoomsMixin.setupOnClient(this.client);

    // Track bonfire → rooms mapping
    // { bonfireId: { spaceId, oocRoomId, deathFeedRoomId, locationRooms: Map<locationId, roomId> } }
    this.bonfires = new Map();
    this.roomToBonfire = new Map(); // roomId → { bonfireId, type, locationId }

    this.botUserId = null;
    this.started = false;
  }

  async start() {
    this.botUserId = await this.client.getUserId();
    console.log(`[matrix] Bot starting as ${this.botUserId}`);

    this.client.on('room.message', (roomId, event) => {
      this._handleMessage(roomId, event);
    });

    await this.client.start();
    this.started = true;
    console.log(`[matrix] Bot connected to ${this.homeserverUrl}`);
  }

  async stop() {
    if (this.started) {
      this.client.stop();
      this.started = false;
      console.log('[matrix] Bot stopped');
    }
  }

  // ── Persistence ─────────────────────────────────────────

  _manifestPath() {
    const dir = this.client.storageProvider?.trackingPath
      ? path.dirname(this.client.storageProvider.trackingPath)
      : path.join(__dirname, 'matrix-storage');
    return path.join(dir, 'bonfires-manifest.json');
  }

  _loadManifest() {
    try {
      const raw = fs.readFileSync(this._manifestPath(), 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  _saveManifest(manifest) {
    const dir = path.dirname(this._manifestPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this._manifestPath(), JSON.stringify(manifest, null, 2));
  }

  // ── Bonfire lifecycle ──────────────────────────────────────

  /**
   * Ensure a bonfire space + rooms exist on Matrix.
   * Loads from manifest if already created, otherwise creates fresh.
   */
  async ensureBonfire(bonfireId, { name, topic } = {}) {
    // Check if already loaded in memory
    if (this.bonfires.has(bonfireId)) {
      console.log(`[matrix] Bonfire ${bonfireId} already loaded`);
      return this.bonfires.get(bonfireId);
    }

    // Check manifest for previously created rooms
    const manifest = this._loadManifest();
    if (manifest[bonfireId]) {
      const saved = manifest[bonfireId];
      console.log(`[matrix] Loading bonfire ${bonfireId} from manifest (space: ${saved.spaceId})`);

      const locationRooms = new Map(Object.entries(saved.locationRooms || {}));

      const bonfireData = {
        spaceId: saved.spaceId,
        globalOOCRoomId: saved.globalOOCRoomId,
        deathFeedRoomId: saved.deathFeedRoomId,
        locationRooms,
      };
      this.bonfires.set(bonfireId, bonfireData);
      this.roomToBonfire.set(saved.globalOOCRoomId, { bonfireId, type: 'global-ooc' });
      this.roomToBonfire.set(saved.deathFeedRoomId, { bonfireId, type: 'death-feed' });
      for (const [locId, roomId] of locationRooms) {
        this.roomToBonfire.set(roomId, { bonfireId, type: 'location', locationId: locId });
      }

      return bonfireData;
    }

    // Create fresh
    console.log(`[matrix] Creating new bonfire space for ${bonfireId}`);
    const result = await this.createBonfire(bonfireId, { name, topic });

    // Persist to manifest
    const bonfireData = this.bonfires.get(bonfireId);
    manifest[bonfireId] = {
      spaceId: bonfireData.spaceId,
      globalOOCRoomId: bonfireData.globalOOCRoomId,
      deathFeedRoomId: bonfireData.deathFeedRoomId,
      locationRooms: Object.fromEntries(bonfireData.locationRooms),
    };
    this._saveManifest(manifest);

    return result;
  }

  /**
   * Create a Matrix space + rooms for a new bonfire (internal — use ensureBonfire)
   */
  async createBonfire(bonfireId, { name, topic } = {}) {
    const spaceName = name || `Bonfire: ${bonfireId}`;

    const spaceId = await this.client.createRoom({
      name: spaceName,
      topic: topic || `AI RPG world — ${bonfireId}`,
      creation_content: { type: 'm.space' },
      initial_state: [{
        type: 'm.room.history_visibility',
        content: { history_visibility: 'world_readable' },
      }],
      preset: 'public_chat',
    });

    const deathFeedRoomId = await this._createChildRoom(spaceId, {
      name: `${spaceName} — Death Feed`,
      topic: 'Here lie the fallen. Every death, every legend.',
    });

    const globalOOCRoomId = await this._createChildRoom(spaceId, {
      name: `${spaceName} — General`,
      topic: 'General chat for all players. No game actions here.',
    });

    const bonfireData = {
      spaceId,
      globalOOCRoomId,
      deathFeedRoomId,
      locationRooms: new Map(),
    };
    this.bonfires.set(bonfireId, bonfireData);
    this.roomToBonfire.set(globalOOCRoomId, { bonfireId, type: 'global-ooc' });
    this.roomToBonfire.set(deathFeedRoomId, { bonfireId, type: 'death-feed' });

    console.log(`[matrix] Created bonfire space ${spaceName} (${spaceId})`);
    return bonfireData;
  }

  /**
   * Get or create a Matrix room for a game location
   */
  async getLocationRoom(bonfireId, locationId, locationName) {
    const bonfire = this.bonfires.get(bonfireId);
    if (!bonfire) throw new Error(`Bonfire ${bonfireId} not found in Matrix`);

    if (bonfire.locationRooms.has(locationId)) {
      return bonfire.locationRooms.get(locationId);
    }

    const roomId = await this._createChildRoom(bonfire.spaceId, {
      name: locationName || locationId,
      topic: `Location: ${locationName || locationId}`,
    });

    bonfire.locationRooms.set(locationId, roomId);
    this.roomToBonfire.set(roomId, { bonfireId, type: 'location', locationId });

    // Persist new location room to manifest
    const manifest = this._loadManifest();
    if (manifest[bonfireId]) {
      manifest[bonfireId].locationRooms = manifest[bonfireId].locationRooms || {};
      manifest[bonfireId].locationRooms[locationId] = roomId;
      this._saveManifest(manifest);
    }

    console.log(`[matrix] Created location room: ${locationName} (${roomId})`);
    return roomId;
  }

  // ── Posting ────────────────────────────────────────────────

  /**
   * Post narrator prose to a location room after a round closes
   */
  async postNarration(bonfireId, locationId, locationName, prose) {
    const roomId = await this.getLocationRoom(bonfireId, locationId, locationName);

    const html = `<blockquote><strong>🎲 AI Game Master</strong></blockquote>\n${this._proseToHtml(prose)}`;

    await this.client.sendMessage(roomId, {
      msgtype: 'm.text',
      body: `🎲 AI Game Master\n\n${prose}`,
      format: 'org.matrix.custom.html',
      formatted_body: html,
    });
  }

  /**
   * Post a death announcement to the death feed
   */
  async postDeath(bonfireId, deathInfo) {
    const bonfire = this.bonfires.get(bonfireId);
    if (!bonfire) return;

    const { playerName, level, className, cause, locationName, legend } = deathInfo;

    const body = `💀 **${playerName}** has fallen.\n\n` +
      `Level ${level || '?'} ${className || 'Adventurer'} — ${cause}\n` +
      `Location: ${locationName}\n\n` +
      `_${legend}_`;

    const html = `<p>💀 <strong>${this._esc(playerName)}</strong> has fallen.</p>` +
      `<p>Level ${level || '?'} ${this._esc(className || 'Adventurer')} — ${this._esc(cause)}</p>` +
      `<p>Location: ${this._esc(locationName)}</p>` +
      `<blockquote><em>${this._esc(legend)}</em></blockquote>`;

    await this.client.sendMessage(bonfire.deathFeedRoomId, {
      msgtype: 'm.text',
      body,
      format: 'org.matrix.custom.html',
      formatted_body: html,
    });

    // Also post to the location room where they died
    const locationRoomId = bonfire.locationRooms.get(deathInfo.locationId);
    if (locationRoomId) {
      await this.client.sendMessage(locationRoomId, {
        msgtype: 'm.text',
        body: `💀 ${playerName} has fallen here. ${cause}`,
        format: 'org.matrix.custom.html',
        formatted_body: `<p>💀 <strong>${this._esc(playerName)}</strong> has fallen here. ${this._esc(cause)}</p>`,
      });
    }
  }

  /**
   * Post a world event to the announcements / all location rooms
   */
  async postWorldEvent(bonfireId, text) {
    const bonfire = this.bonfires.get(bonfireId);
    if (!bonfire) return;

    for (const roomId of bonfire.locationRooms.values()) {
      await this.client.sendMessage(roomId, {
        msgtype: 'm.notice',
        body: `🌍 ${text}`,
      });
    }
  }

  /**
   * Invite a player to the bonfire (space + global OOC + death feed only).
   * Location rooms are joined/left as the player travels.
   */
  async invitePlayer(bonfireId, matrixUserId) {
    const bonfire = this.bonfires.get(bonfireId);
    if (!bonfire) return;

    try {
      await this.client.inviteUser(matrixUserId, bonfire.spaceId);
      await this.client.inviteUser(matrixUserId, bonfire.globalOOCRoomId);
      await this.client.inviteUser(matrixUserId, bonfire.deathFeedRoomId);
      console.log(`[matrix] Invited ${matrixUserId} to bonfire ${bonfireId}`);
    } catch (err) {
      console.warn(`[matrix] Failed to invite ${matrixUserId}:`, err.message);
    }
  }

  /**
   * Move a player between location rooms (leave old, join new).
   * Called when player travels to a new location.
   */
  async movePlayerToLocation(bonfireId, matrixUserId, newLocationId, newLocationName, oldLocationId) {
    const bonfire = this.bonfires.get(bonfireId);
    if (!bonfire) return;

    // Leave old location room
    if (oldLocationId && bonfire.locationRooms.has(oldLocationId)) {
      const oldRoomId = bonfire.locationRooms.get(oldLocationId);
      try {
        await this.client.kickUser(matrixUserId, oldRoomId, 'Moved to another location');
      } catch (err) {
        // May not have permission or already left
      }
    }

    // Join new location room
    const newRoomId = await this.getLocationRoom(bonfireId, newLocationId, newLocationName);
    try {
      await this.client.inviteUser(matrixUserId, newRoomId);
    } catch (err) {
      // May already be joined
    }
  }

  /**
   * Invite a player to a specific location room
   */
  async inviteToLocation(bonfireId, locationId, locationName, matrixUserId) {
    const roomId = await this.getLocationRoom(bonfireId, locationId, locationName);
    try {
      await this.client.inviteUser(matrixUserId, roomId);
    } catch (err) {
      // May already be joined
    }
  }

  // ── Message handling ───────────────────────────────────────

  _handleMessage(roomId, event) {
    if (!event?.content?.body) return;
    if (event.sender === this.botUserId) return; // Ignore own messages

    const body = event.content.body.trim();
    const sender = event.sender;
    const displayName = sender.match(/^@([^:]+)/)?.[1] || sender;

    console.log(`[matrix] Message in ${roomId} from ${displayName}: ${body.slice(0, 100)}`);

    const meta = this.roomToBonfire.get(roomId);

    // Check if it's an IC action (location rooms or any tracked room)
    if (meta?.type === 'location') {
      const prefix = IC_PREFIXES.find(p => body.toLowerCase().startsWith(p));
      if (prefix) {
        const actionText = body.slice(prefix.length).trim();
        if (actionText && this.onICAction) {
          console.log(`[matrix] IC action from ${displayName}: /${prefix.trim().slice(1)} ${actionText}`);
          this.onICAction(meta.bonfireId, meta.locationId, sender, actionText, prefix.trim().slice(1));
        }
        return; // Don't echo IC actions
      }
      // Non-prefixed messages in location rooms = OOC (no action needed, just chat)
    }

    // Emit a general message event for any listener
    if (this.onMessage) {
      this.onMessage(roomId, sender, body, {
        displayName,
        roomType: meta?.type || 'unknown',
        bonfireId: meta?.bonfireId || null,
        locationId: meta?.locationId || null,
      });
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  async _createChildRoom(spaceId, { name, topic }) {
    const roomId = await this.client.createRoom({
      name,
      topic,
      initial_state: [
        {
          type: 'm.room.history_visibility',
          content: { history_visibility: 'world_readable' },
        },
        {
          type: 'm.space.parent',
          state_key: spaceId,
          content: { canonical: true, via: [this._getServerName()] },
        },
      ],
      preset: 'public_chat',
    });

    // Add as child of space
    await this.client.sendStateEvent(spaceId, 'm.space.child', roomId, {
      via: [this._getServerName()],
    });

    return roomId;
  }

  _getServerName() {
    try {
      return new URL(this.homeserverUrl).hostname;
    } catch {
      return 'matrix.org';
    }
  }

  _esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _proseToHtml(prose) {
    return prose.split('\n\n').map(p => `<p>${this._esc(p.trim())}</p>`).join('\n');
  }
}

module.exports = { MatrixNarrator };
