/**
 * Zod schemas for location-related structured output responses.
 *
 * Covers:
 *   - location_generation  (full location via Location.fromXMLSnippet)
 *   - location_name_regen  (uses shared NameRegenSchema)
 *   - alter_location        (Events._parseLocationAlterXml)
 */

const { z } = require('zod');
const { NameRegenSchema } = require('./shared.js');

// --- Random story events embedded inside a location response ---

const RandomStoryEventsSchema = z.array(z.string().describe('A random story event that can occur at this location'))
    .optional()
    .describe('Random narrative events that may trigger at this location');

// --- Full location (location_generation) ---
// Fields extracted in Location.fromXMLSnippet from child elements of <location>.

const LocationSchema = z.object({
    name: z.string().describe('Location name'),
    description: z.string().describe('Full narrative description of the location (may contain HTML)'),
    shortDescription: z.string().optional().describe('Brief one-line description of the location'),
    relativeLevel: z.number().int().optional()
        .describe('Level offset relative to the region average (e.g. -2, 0, +3)'),
    baseLevel: z.number().int().optional()
        .describe('Absolute base level for the location (derived from relativeLevel when absent)'),
    numItems: z.number().int().optional()
        .describe('Suggested number of items / loot to place here'),
    numScenery: z.number().int().optional()
        .describe('Suggested number of scenery objects to place here'),
    numNpcs: z.number().int().optional()
        .describe('Suggested number of NPCs to place here'),
    numHostiles: z.number().int().optional()
        .describe('Suggested number of hostile NPCs to place here'),
    hasWeather: z.boolean().optional()
        .describe('Whether this location is exposed to weather effects'),
    controllingFaction: z.string().optional()
        .describe('Name of the faction controlling this location, or "None"'),
    randomStoryEvents: RandomStoryEventsSchema,
}).describe('Full location generation response');

// --- Location alteration (alter_location) ---
// Fields parsed by Events._parseLocationAlterXml.

const LocationAlterSchema = z.object({
    name: z.string().optional()
        .describe('Updated location name (null to keep current)'),
    description: z.string().describe('Updated full description after the alteration'),
    shortDescription: z.string().optional()
        .describe('Updated short description after the alteration'),
    baseLevel: z.number().optional()
        .describe('Updated base level after the alteration'),
}).describe('Location alteration response');

// Re-export NameRegenSchema for location_name_regen callers.
const LocationNameRegenSchema = NameRegenSchema;

module.exports = {
    LocationSchema,
    LocationAlterSchema,
    LocationNameRegenSchema,
    RandomStoryEventsSchema,
};
