'use strict';

class PermadeathManager {
  constructor({ sdk, gameState }) {
    this.sdk = sdk;
    this.gameState = gameState;
  }

  async processDeath(player, { cause = 'Unknown' } = {}) {
    const location = this.gameState.gameLocations.get(player.currentLocation);
    const locationName = location?.name || 'Unknown Location';

    const legend = `Here fell ${player.name}, Level ${player.level} ${player.class} (${player.race}). ${cause}. Their story ends at ${locationName}.`;

    // Drop inventory at death location
    if (location && player.inventory) {
      for (const item of player.inventory) {
        if (!location.thingIds.includes(item.id)) {
          location.thingIds.push(item.id);
        }
      }
    }

    // Deactivate agent via SDK
    if (this.sdk?.agents) {
      try {
        await this.sdk.agents.update({
          agentId: player.agentId,
          is_active: false,
        });
      } catch (err) {
        console.warn('[permadeath] Failed to deactivate agent:', err.message);
      }
    }

    // Create KG ghost entity
    if (this.sdk?.kg) {
      try {
        await this.sdk.kg.createEntity({
          name: `Corpse of ${player.name}`,
          labels: ['dead_player', 'corpse', 'lore'],
          summary: legend,
          attributes: {
            player_id: player.id,
            agent_id: player.agentId,
            level: player.level,
            class: player.class,
            race: player.race,
            cause_of_death: cause,
            location_id: player.currentLocation,
            location_name: locationName,
            died_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.warn('[permadeath] Failed to create KG entity:', err.message);
      }
    }

    return {
      isDead: true,
      playerId: player.id,
      playerName: player.name,
      locationId: player.currentLocation,
      locationName,
      cause,
      legend,
    };
  }
}

module.exports = { PermadeathManager };
