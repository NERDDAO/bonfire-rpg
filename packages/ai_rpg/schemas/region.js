/**
 * Zod schemas for region-related structured output responses.
 *
 * Covers:
 *   - region_generation          (Region.fromXMLSnippet — full region with location blueprints)
 *   - region_stub_locations      (parseRegionStubLocations — location stubs within a region)
 *   - existing_region_exit       (parseExistingRegionExitResponse — exit selection)
 *   - region_entrance_selection  (parseRegionEntranceResponse — entrance name)
 *   - region_name_regen          (shared NameRegenSchema)
 */

const { z } = require('zod');
const { NameRegenSchema } = require('./shared.js');

// --- Location blueprint inside a full region ---
// Parsed from <locations><location> children in Region.fromXMLSnippet.

const RegionLocationBlueprintSchema = z.object({
    name: z.string().describe('Location name'),
    description: z.string().describe('Location description'),
    shortDescription: z.string().optional().describe('Brief one-line location description'),
    relativeLevel: z.number().int().optional()
        .describe('Level offset relative to the region average (-10 to +10)'),
    numNpcs: z.number().int().optional()
        .describe('Suggested number of NPCs (0-20)'),
    numHostiles: z.number().int().optional()
        .describe('Suggested number of hostile NPCs (0-20)'),
    hasWeather: z.boolean().optional()
        .describe('Whether this location is exposed to weather'),
    controllingFaction: z.string().optional()
        .describe('Name of the faction controlling this location, or "None"'),
    exits: z.array(z.string()).optional()
        .describe('Named exits / connections to other locations in this region'),
}).describe('Location blueprint within a region');

// --- Full region (region_generation) ---
// Top-level fields parsed by Region.fromXMLSnippet.

const RegionSchema = z.object({
    regionName: z.string().describe('Region name'),
    regionDescription: z.string().describe('Full narrative description of the region'),
    shortDescription: z.string().optional().describe('Brief one-line region description'),
    relativeLevel: z.number().int().optional()
        .describe('Average level for the region'),
    numImportantNPCs: z.number().int().optional()
        .describe('Number of important / named NPCs across the region'),
    controllingFaction: z.string().optional()
        .describe('Name of the faction controlling this region, or "None"'),
    characterConcepts: z.array(z.string()).optional()
        .describe('NPC character concepts for populating the region'),
    enemyConcepts: z.array(z.string()).optional()
        .describe('Enemy / hostile NPC concepts for populating the region'),
    secrets: z.array(z.string()).optional()
        .describe('Hidden secrets or lore within the region'),
    locations: z.array(RegionLocationBlueprintSchema)
        .describe('Location blueprints that make up this region'),
    randomStoryEvents: z.array(z.string()).optional()
        .describe('Random narrative events that may trigger in this region'),
}).describe('Full region generation response');

// --- Region stub locations (region_stub_locations) ---
// Parsed by parseRegionStubLocations — same shape as the blueprint but from the
// stub-expansion prompt which generates locations for an existing region.

const RegionStubLocationSchema = z.object({
    name: z.string().describe('Location name'),
    description: z.string().describe('Location description'),
    shortDescription: z.string().optional().describe('Brief one-line description'),
    relativeLevel: z.number().int().optional()
        .describe('Level offset relative to region average'),
    numNpcs: z.number().int().optional()
        .describe('Suggested number of NPCs (0-20)'),
    numHostiles: z.number().int().optional()
        .describe('Suggested number of hostile NPCs (0-20)'),
    hasWeather: z.boolean().optional()
        .describe('Whether this location is exposed to weather'),
    controllingFaction: z.string().optional()
        .describe('Controlling faction name, or "None"'),
    exits: z.array(z.string()).optional()
        .describe('Named exits / connections to other locations'),
}).describe('A location stub generated for a region');

const RegionStubSchema = z.object({
    locations: z.array(RegionStubLocationSchema)
        .describe('Location stubs generated for this region'),
}).describe('Region stub locations response');

// --- Existing region exit (existing_region_exit) ---
// Parsed by parseExistingRegionExitResponse: <remoteExit><name>...<reason>...

const RegionExitSchema = z.object({
    name: z.string().describe('Name of the exit location chosen in the target region'),
    reason: z.string().optional().describe('Why this exit was selected'),
}).describe('Existing region exit selection response');

// --- Entrance selection (region_entrance_selection) ---
// Parsed by parseRegionEntranceResponse: <entrance><name>...

const EntranceSelectionSchema = z.object({
    name: z.string().describe('Name of the location chosen as the region entrance'),
}).describe('Region entrance selection response');

// Re-export NameRegenSchema for region_name_regen callers.
const RegionNameRegenSchema = NameRegenSchema;

module.exports = {
    RegionSchema,
    RegionLocationBlueprintSchema,
    RegionStubSchema,
    RegionStubLocationSchema,
    RegionExitSchema,
    EntranceSelectionSchema,
    RegionNameRegenSchema,
};
