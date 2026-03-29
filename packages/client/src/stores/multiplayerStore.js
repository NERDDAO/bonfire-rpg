import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useMultiplayerStore = create(
  devtools((set, get) => ({
    roster: [],
    oocMessages: [],
    maxOocMessages: 200,
    roundActive: false,
    roundStartedAt: null,
    roundWindowMs: 20000,
    roundActions: [],
    isDead: false,
    deathInfo: null,

    setRoster: (roster) => set({ roster }),

    addOocMessage: (msg) => set((state) => {
      const messages = [...state.oocMessages, msg];
      if (messages.length > state.maxOocMessages) {
        messages.splice(0, messages.length - state.maxOocMessages);
      }
      return { oocMessages: messages };
    }),

    setRoundActive: (active, startedAt = null) => set({
      roundActive: active,
      roundStartedAt: active ? (startedAt || Date.now()) : null,
      roundActions: active ? get().roundActions : [],
    }),

    addRoundAction: (action) => set((state) => ({
      roundActions: [...state.roundActions, action],
    })),

    setRoundWindowMs: (ms) => set({ roundWindowMs: ms }),

    setDead: (deathInfo) => set({ isDead: true, deathInfo }),

    resetDeath: () => set({ isDead: false, deathInfo: null }),

    handleMultiplayerEvent: (event) => {
      const { type } = event;
      if (type === 'ooc_chat') {
        get().addOocMessage({
          from: event.from,
          fromName: event.fromName || event.from,
          text: event.text,
          timestamp: event.timestamp || Date.now(),
        });
      } else if (type === 'roster_update') {
        get().setRoster(event.roster);
      } else if (type === 'round_started') {
        get().setRoundActive(true, event.startedAt);
      } else if (type === 'round_closed') {
        get().setRoundActive(false);
      } else if (type === 'player_death') {
        get().setDead(event);
      }
    },

    reset: () => set({
      roster: [],
      oocMessages: [],
      roundActive: false,
      roundStartedAt: null,
      roundActions: [],
      isDead: false,
      deathInfo: null,
    }),
  }), { name: 'multiplayer-store' })
);

export default useMultiplayerStore;
