// Lightweight Matrix Client-Server API wrapper (browser, no SDK needed)
(function() {
  'use strict';

  class MatrixChat {
    /**
     * @param {object} opts
     * @param {string} opts.homeserver - e.g. "https://matrix.org"
     * @param {string} opts.accessToken - user's access token
     * @param {string} opts.userId - e.g. "@user:matrix.org"
     * @param {function} opts.onMessage - called with (roomId, sender, text, event)
     * @param {function} opts.onRoomUpdate - called with (roomId, roomState)
     */
    constructor({ homeserver, accessToken, userId, onMessage, onRoomUpdate }) {
      this.hs = homeserver.replace(/\/$/, '');
      this.token = accessToken;
      this.userId = userId;
      this.onMessage = onMessage || (() => {});
      this.onRoomUpdate = onRoomUpdate || (() => {});
      this.syncToken = null;
      this.rooms = new Map(); // roomId → { name, topic, lastMessage }
      this._syncing = false;
      this._txnId = 0;
    }

    // ── Auth ──────────────────────────────────────────────

    /**
     * Login with username + password, returns { userId, accessToken }
     */
    static async login(homeserver, user, password) {
      const hs = homeserver.replace(/\/$/, '');
      const res = await fetch(`${hs}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user },
          password,
        }),
      });
      if (!res.ok) throw new Error(`Login failed: ${res.status}`);
      const data = await res.json();
      return {
        userId: data.user_id,
        accessToken: data.access_token,
        deviceId: data.device_id,
      };
    }

    // ── Sync (long-poll) ─────────────────────────────────

    async startSync() {
      this._syncing = true;
      // Initial sync (limit to recent messages)
      await this._sync({ timeout: 0, filter: JSON.stringify({
        room: { timeline: { limit: 30 } }
      })});
      // Long-poll loop
      this._pollLoop();
    }

    stopSync() {
      this._syncing = false;
    }

    async _pollLoop() {
      while (this._syncing) {
        try {
          await this._sync({ timeout: 30000 });
        } catch (err) {
          console.warn('[matrix] Sync error, retrying in 5s:', err.message);
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    async _sync({ timeout = 30000, filter } = {}) {
      let url = `${this.hs}/_matrix/client/v3/sync?timeout=${timeout}`;
      if (this.syncToken) url += `&since=${this.syncToken}`;
      if (filter) url += `&filter=${encodeURIComponent(filter)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: timeout > 0 ? AbortSignal.timeout(timeout + 10000) : undefined,
      });
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      const data = await res.json();
      this.syncToken = data.next_batch;

      // Process joined rooms
      const joined = data.rooms?.join || {};
      for (const [roomId, roomData] of Object.entries(joined)) {
        // Room name from state events
        const nameEvent = roomData.state?.events?.find(e => e.type === 'm.room.name');
        if (nameEvent) {
          if (!this.rooms.has(roomId)) this.rooms.set(roomId, {});
          this.rooms.get(roomId).name = nameEvent.content.name;
        }

        // Timeline messages
        const events = roomData.timeline?.events || [];
        for (const event of events) {
          if (event.type === 'm.room.message' && event.sender !== this.userId) {
            const body = event.content?.body || '';
            const sender = event.sender;
            const displayName = this._extractDisplayName(sender);
            this.onMessage(roomId, sender, body, {
              displayName,
              msgtype: event.content?.msgtype,
              eventId: event.event_id,
              timestamp: event.origin_server_ts,
              formattedBody: event.content?.formatted_body,
            });
          }
        }
      }

      // Process invites
      const invited = data.rooms?.invite || {};
      for (const roomId of Object.keys(invited)) {
        // Auto-join invites
        await this._joinRoom(roomId);
      }
    }

    // ── Send ──────────────────────────────────────────────

    async sendMessage(roomId, text) {
      const txnId = `m${Date.now()}.${this._txnId++}`;
      const url = `${this.hs}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: text,
        }),
      });
      if (!res.ok) throw new Error(`Send failed: ${res.status}`);
      return (await res.json()).event_id;
    }

    async sendHtml(roomId, text, html) {
      const txnId = `m${Date.now()}.${this._txnId++}`;
      const url = `${this.hs}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: text,
          format: 'org.matrix.custom.html',
          formatted_body: html,
        }),
      });
      if (!res.ok) throw new Error(`Send failed: ${res.status}`);
      return (await res.json()).event_id;
    }

    // ── Rooms ─────────────────────────────────────────────

    async getJoinedRooms() {
      const res = await fetch(`${this.hs}/_matrix/client/v3/joined_rooms`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) throw new Error(`Failed to get rooms: ${res.status}`);
      const data = await res.json();
      return data.joined_rooms || [];
    }

    async getRoomName(roomId) {
      try {
        const res = await fetch(
          `${this.hs}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`,
          { headers: { Authorization: `Bearer ${this.token}` } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.name;
      } catch {
        return null;
      }
    }

    async _joinRoom(roomId) {
      try {
        await fetch(`${this.hs}/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
      } catch (err) {
        console.warn('[matrix] Failed to join room:', roomId, err.message);
      }
    }

    // ── Members ──────────────────────────────────────────

    async getRoomMembers(roomId) {
      const res = await fetch(
        `${this.hs}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/joined_members`,
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
      if (!res.ok) return {};
      const data = await res.json();
      return data.joined || {};
    }

    // ── Helpers ──────────────────────────────────────────

    _extractDisplayName(userId) {
      // @user:server.com → user
      const match = userId.match(/^@([^:]+)/);
      return match ? match[1] : userId;
    }
  }

  // Expose globally
  window.MatrixChat = MatrixChat;
})();
