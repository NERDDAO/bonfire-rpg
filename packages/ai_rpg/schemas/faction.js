/**
 * Zod schemas for faction-related structured output responses.
 *
 * Covers:
 *   - faction_generation                  (parseFactionCoreXml — core faction data)
 *   - faction_relationship_generation     (parseFactionRelationsXml — inter-faction relations)
 *   - faction_reputation_generation       (parseFactionReputationTiersXml — reputation tiers)
 *   - faction_autofill / setting_faction_autofill (parseFactionAutofillResponse — combined)
 */

const { z } = require('zod');

// --- Faction asset ---

const FactionAssetSchema = z.object({
    name: z.string().describe('Asset name'),
    type: z.string().optional().describe('Asset type (e.g. "military", "economic", "intelligence")'),
    description: z.string().optional().describe('What this asset provides'),
}).describe('A faction asset — resource, base, unit, or capability');

// --- Faction relation (between two factions) ---

const FactionRelationSchema = z.object({
    factionName: z.string().describe('Name of the related faction'),
    status: z.enum(['allied', 'neutral', 'hostile', 'rival'])
        .describe('Diplomatic status toward this faction'),
    notes: z.string().describe('Context explaining the relationship'),
}).describe('Relationship entry toward another faction');

// --- Reputation tier ---

const FactionReputationTierSchema = z.object({
    threshold: z.number().describe('Reputation point threshold to reach this tier'),
    label: z.string().describe('Display name for this reputation tier'),
    perks: z.array(z.string()).optional()
        .describe('Benefits granted at this tier'),
    penalties: z.array(z.string()).optional()
        .describe('Penalties imposed at this tier'),
}).describe('A single reputation tier within a faction');

// --- Core faction (faction_generation) ---
// Fields parsed by parseFactionCoreXml. One per <faction> element.

const FactionCoreSchema = z.object({
    name: z.string().describe('Faction name'),
    description: z.string().describe('Full narrative description of the faction'),
    shortDescription: z.string().describe('Brief one-line faction description'),
    homeRegionName: z.string().optional()
        .describe('Name of the region this faction calls home'),
    tags: z.array(z.string()).describe('Classification tags (e.g. "military", "religious", "criminal")'),
    goals: z.array(z.string()).describe('Faction goals and motivations'),
    assets: z.array(FactionAssetSchema).describe('Resources and capabilities the faction possesses'),
}).describe('Core faction data from faction_generation');

// --- Faction relationships (faction_relationship_generation) ---
// Wrapper: one entry per faction containing its relations array.

const FactionRelationshipsEntrySchema = z.object({
    name: z.string().describe('Faction name this relationship block belongs to'),
    relations: z.array(FactionRelationSchema)
        .describe('Relationships this faction holds toward other factions'),
}).describe('A single faction\'s relationship entries');

// --- Faction reputation tiers (faction_reputation_generation) ---

const FactionReputationEntrySchema = z.object({
    name: z.string().describe('Faction name this reputation block belongs to'),
    reputationTiers: z.array(FactionReputationTierSchema)
        .describe('Ordered reputation tiers for this faction'),
}).describe('A single faction\'s reputation tier definitions');

// --- Combined faction schema (faction_autofill) ---
// Superset returned by parseFactionAutofillResponse, merging core + relations + reputation.

const FactionSchema = z.object({
    name: z.string().describe('Faction name'),
    description: z.string().describe('Full narrative description'),
    shortDescription: z.string().describe('Brief one-line description'),
    homeRegionName: z.string().optional()
        .describe('Name of the region this faction calls home'),
    tags: z.array(z.string()).describe('Classification tags'),
    goals: z.array(z.string()).describe('Faction goals and motivations'),
    assets: z.array(FactionAssetSchema).describe('Resources and capabilities'),
    reputationTiers: z.array(FactionReputationTierSchema).optional()
        .describe('Reputation tier definitions'),
    relationEntries: z.array(FactionRelationSchema).optional()
        .describe('Relationships toward other factions'),
}).describe('Full faction (autofill) response — core + relations + reputation');

module.exports = {
    FactionSchema,
    FactionCoreSchema,
    FactionAssetSchema,
    FactionRelationSchema,
    FactionRelationshipsEntrySchema,
    FactionReputationTierSchema,
    FactionReputationEntrySchema,
};
