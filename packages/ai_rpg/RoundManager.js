'use strict';

class RoundManager {
  constructor({ roundWindowMs = 20000, onRoundClose }) {
    this.roundWindowMs = roundWindowMs;
    this.onRoundClose = onRoundClose;
    this.rounds = new Map(); // locationId -> { actions: [], timer: timeout, startedAt: number }
  }

  get activeRoundCount() {
    return this.rounds.size;
  }

  queueAction(locationId, action) {
    if (!this.rounds.has(locationId)) {
      this.rounds.set(locationId, {
        actions: [],
        timer: null,
        startedAt: Date.now(),
      });
    }

    const round = this.rounds.get(locationId);
    round.actions.push(action);

    // Start timer on first action
    if (!round.timer) {
      round.timer = setTimeout(() => {
        this._closeRound(locationId);
      }, this.roundWindowMs);
    }
  }

  getRound(locationId) {
    return this.rounds.get(locationId) || null;
  }

  closeNow(locationId) {
    if (!this.rounds.has(locationId)) return;
    this._closeRound(locationId);
  }

  _closeRound(locationId) {
    const round = this.rounds.get(locationId);
    if (!round) return;

    if (round.timer) {
      clearTimeout(round.timer);
      round.timer = null;
    }

    const actions = round.actions.slice();
    this.rounds.delete(locationId);

    if (this.onRoundClose && actions.length > 0) {
      this.onRoundClose(locationId, actions);
    }
  }

  destroy() {
    for (const [locationId, round] of this.rounds) {
      if (round.timer) {
        clearTimeout(round.timer);
      }
    }
    this.rounds.clear();
  }
}

module.exports = { RoundManager };
