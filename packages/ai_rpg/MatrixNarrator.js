'use strict';

const {
  MatrixClient,
  SimpleFsStorageProvider,
  AutojoinRoomsMixin,
} = require('matrix-bot-sdk');
const path = require('path');

const IC_PREFIXES = ['/do ', '/say ', '/attack ', '/use ', '/go ', '/look ', '/talk '];

class MatrixNarrator {
  /**
   * @param {object} opts
   * @param {string} opts.homeserverUrl - e.g. "https://matrix.org"
   * @param {string} opts.accessToken - bot access token
   * @param {string} opts.storageDir - path for bot state (default: ./matrix-storage)
   * @param {function} opts.onICAction - called with (bonfireId, locationRoomId, playerId, text)
   */
  constructor({ homeserverUrl, accessToken, storageDir, onICAction }) {
    this.homeserverUrl = homeserverUrl;
    this.accessToken = accessToken;
    this.onICAction = onICAction || (() => {});

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

  // ── Bonfire lifecycle ──────────────────────────────────────

  /**
   * Create a Matrix space + rooms for a new bonfire
   */
  async createBonfire(bonfireId, { name, topic } = {}) {
    const spaceName = name || `Bonfire: ${bonfireId}`;

    // Create the space
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

    // Create OOC room
    const oocRoomId = await this._createChildRoom(spaceId, {
      name: `${spaceName} — OOC`,
      topic: 'Out-of-character chat. No token cost.',
    });

    // Create death feed room (read-only for non-bot)
    const deathFeedRoomId = await this._createChildRoom(spaceId, {
      name: `${spaceName} — Death Feed`,
      topic: 'Here lie the fallen. Every death, every legend.',
    });

    const bonfireData = {
      spaceId,
      oocRoomId,
      deathFeedRoomId,
      locationRooms: new Map(),
    };
    this.bonfires.set(bonfireId, bonfireData);
    this.roomToBonfire.set(oocRoomId, { bonfireId, type: 'ooc' });
    this.roomToBonfire.set(deathFeedRoomId, { bonfireId, type: 'death-feed' });

    console.log(`[matrix] Created bonfire space ${spaceName} (${spaceId})`);
    return { spaceId, oocRoomId, deathFeedRoomId };
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
   * Invite a player to the bonfire space + OOC room
   */
  async invitePlayer(bonfireId, matrixUserId) {
    const bonfire = this.bonfires.get(bonfireId);
    if (!bonfire) return;

    try {
      await this.client.inviteUser(matrixUserId, bonfire.spaceId);
      await this.client.inviteUser(matrixUserId, bonfire.oocRoomId);
      await this.client.inviteUser(matrixUserId, bonfire.deathFeedRoomId);
      console.log(`[matrix] Invited ${matrixUserId} to bonfire ${bonfireId}`);
    } catch (err) {
      console.warn(`[matrix] Failed to invite ${matrixUserId}:`, err.message);
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

    const meta = this.roomToBonfire.get(roomId);
    if (!meta) return; // Not a bonfire room

    const body = event.content.body.trim();

    // Check if it's an IC action (location rooms only)
    if (meta.type === 'location') {
      const prefix = IC_PREFIXES.find(p => body.toLowerCase().startsWith(p));
      if (prefix) {
        const actionText = body.slice(prefix.length).trim();
        if (actionText && this.onICAction) {
          this.onICAction(meta.bonfireId, meta.locationId, event.sender, actionText, prefix.trim().slice(1));
        }
      }
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
