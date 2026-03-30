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
}).describe('Full region generation response (core fields only — no connected regions, vehicles, or weather)');

// --- Connected region (exit stub) ---
// Parsed by parseRegionExitsResponse from <stubRegion> nodes.

const ConnectedRegionSchema = z.object({
    regionName: z.string().describe('Name of the connected region'),
    regionDescription: z.string().optional().describe('Brief description of the connected region'),
    relativeLevel: z.number().int().optional()
        .describe('Level offset relative to current region'),
    relationship: z.string().optional()
        .describe('Relationship to current region (e.g. "Adjacent", "Distant")'),
    exitLocation: z.string().optional()
        .describe('Name of the location in the current region that leads to this connected region'),
    exitVehicle: z.string().optional()
        .describe('Vehicle required to reach this region, if any'),
    controllingFaction: z.string().optional()
        .describe('Faction controlling the connected region, or "None"'),
}).describe('A connected region stub (exit definition)');

// --- Weather sub-schemas ---
// Parsed by Region.parseWeatherDefinitionFromXmlSnippet / parseRegionWeatherResponse.

const DurationRangeSchema = z.object({
    minMinutes: z.number().int().positive()
        .describe('Minimum duration in minutes'),
    maxMinutes: z.number().int().positive()
        .describe('Maximum duration in minutes'),
}).describe('Duration range in minutes');

const RegionWeatherTypeSchema = z.object({
    name: z.string().describe('Weather type name (e.g. "Heavy Rain")'),
    description: z.string().describe('Narrative description of this weather'),
    relativeFrequency: z.number().positive()
        .describe('Relative frequency weight (higher = more common)'),
    durationRange: DurationRangeSchema
        .describe('How long this weather typically lasts'),
}).describe('A single weather type within a season');

const RegionSeasonWeatherSchema = z.object({
    seasonName: z.string().describe('Name of the season'),
    weatherTypes: z.array(RegionWeatherTypeSchema).min(1)
        .describe('Weather types that occur during this season'),
}).describe('Weather definitions for a single season');

const RegionWeatherSchema = z.object({
    hasDynamicWeather: z.boolean()
        .describe('Whether this region has dynamic weather changes'),
    seasonWeather: z.array(RegionSeasonWeatherSchema)
        .describe('Per-season weather definitions'),
}).describe('Full weather definition for a region');

// --- Vehicle definition ---
// Parsed by parseRegionVehicleDefinitions from <vehicle> nodes inside locations.

const VehicleDestinationSchema = z.object({
    regionName: z.string().optional().describe('Destination region name'),
    locationName: z.string().optional().describe('Destination location name'),
}).describe('A vehicle destination');

const VehicleDefinitionSchema = z.object({
    sourceLocationName: z.string()
        .describe('Name of the location where this vehicle is found'),
    name: z.string().describe('Vehicle name'),
    description: z.string().optional().describe('Vehicle description'),
    shortDescription: z.string().optional().describe('Brief vehicle description'),
    controllingFaction: z.string().optional()
        .describe('Faction controlling the vehicle, or null'),
    size: z.enum(['large', 'huge']).describe('Vehicle size category'),
    icon: z.string().optional().describe('Emoji icon for the vehicle'),
    destinations: z.array(VehicleDestinationSchema).optional()
        .describe('Possible destinations this vehicle can travel to'),
}).describe('A large/huge vehicle definition within a region');

// --- Extended region schema (region_generation with all sub-data) ---
// Consolidates the 8+ sub-parsers into a single structured response.

const ExtendedRegionSchema = RegionSchema.extend({
    connectedRegions: z.array(ConnectedRegionSchema).optional()
        .describe('Connected regions reachable from this region (exit stubs)'),
    weather: RegionWeatherSchema.optional()
        .describe('Dynamic weather definition for this region'),
    vehicleDefinitions: z.array(VehicleDefinitionSchema).optional()
        .describe('Large/huge vehicles found in this region'),
}).describe('Full region generation response with connected regions, weather, and vehicles');

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
    regionName: z.string().optional().describe('Region name (may echo the stub name)'),
    regionDescription: z.string().optional().describe('Region description'),
    shortDescription: z.string().optional().describe('Brief one-line region description'),
    numImportantNPCs: z.number().int().optional()
        .describe('Number of important / named NPCs across the region'),
    controllingFaction: z.string().optional()
        .describe('Name of the faction controlling this region, or "None"'),
    characterConcepts: z.array(z.string()).optional()
        .describe('NPC character concepts for populating the region'),
    enemyConcepts: z.array(z.string()).optional()
        .describe('Enemy / hostile NPC concepts'),
    secrets: z.array(z.string()).optional()
        .describe('Hidden secrets or lore within the region'),
    locations: z.array(RegionStubLocationSchema)
        .describe('Location stubs generated for this region'),
    connectedRegions: z.array(ConnectedRegionSchema).optional()
        .describe('Connected regions reachable from this region (exit stubs)'),
    weather: RegionWeatherSchema.optional()
        .describe('Dynamic weather definition for this region'),
    vehicleDefinitions: z.array(VehicleDefinitionSchema).optional()
        .describe('Large/huge vehicles found in this region'),
}).describe('Region stub locations response (with connected regions, weather, vehicles)');

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
    ExtendedRegionSchema,
    RegionLocationBlueprintSchema,
    ConnectedRegionSchema,
    DurationRangeSchema,
    RegionWeatherTypeSchema,
    RegionSeasonWeatherSchema,
    RegionWeatherSchema,
    VehicleDestinationSchema,
    VehicleDefinitionSchema,
    RegionStubSchema,
    RegionStubLocationSchema,
    RegionExitSchema,
    EntranceSelectionSchema,
    RegionNameRegenSchema,
};
