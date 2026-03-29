/**
 * Faction handlers — structured output replacements for inline XML parsing.
 *
 * Covers:
 *   - faction_generation          (parseFactionCoreXml — array of core faction data)
 *   - faction_relationship_generation (parseFactionRelationsXml — inter-faction relations)
 *   - faction_reputation_generation   (parseFactionReputationTiersXml — reputation tiers)
 *   - faction_autofill / setting_faction_autofill (parseFactionAutofillResponse — combined)
 */

const { aiGenerateObject } = require('../ai.js');
const { z } = require('zod');
const {
    FactionCoreSchema,
    FactionRelationshipsEntrySchema,
    FactionReputationEntrySchema,
    FactionSchema,
} = require('../schemas/faction.js');

// Wrapped array schemas for generation endpoints that return multiple factions.
const FactionCoreArraySchema = z.object({
    factions: z.array(FactionCoreSchema).describe('Array of generated faction core data'),
});

const FactionRelationshipsArraySchema = z.object({
    factions: z.array(FactionRelationshipsEntrySchema)
        .describe('Array of per-faction relationship entries'),
});

const FactionReputationArraySchema = z.object({
    factions: z.array(FactionReputationEntrySchema)
        .describe('Array of per-faction reputation tier entries'),
});

// --- Core faction generation ---

async function factionGeneration({ messages, metadataLabel = 'faction_generation', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: FactionCoreArraySchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object.factions;
}

// --- Faction relationship generation ---

async function factionRelationshipGeneration({ messages, metadataLabel = 'faction_relationship_generation', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: FactionRelationshipsArraySchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object.factions;
}

// --- Faction reputation generation ---

async function factionReputationGeneration({ messages, metadataLabel = 'faction_reputation_generation', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: FactionReputationArraySchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object.factions;
}

// --- Faction autofill (combined core + relations + reputation) ---

async function factionAutofill({ messages, metadataLabel = 'faction_autofill', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: FactionSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

module.exports = {
    factionGeneration,
    factionRelationshipGeneration,
    factionReputationGeneration,
    factionAutofill,
};
