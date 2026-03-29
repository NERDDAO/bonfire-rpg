/**
 * Location handler functions — structured output replacements for XML parsing.
 *
 * Covers:
 *   - generateLocation        (location_generation)  → LocationSchema
 *   - alterLocation           (alter_location)        → LocationAlterSchema
 *   - regenLocationName       (location_name_regen)   → LocationNameRegenSchema
 */

const { aiGenerateObject } = require('../ai.js');
const {
    LocationSchema,
    LocationAlterSchema,
    LocationNameRegenSchema,
} = require('../schemas/location.js');

/**
 * Generate a full location from a prompt.
 * Returns the same shape callers currently build from Location.fromXMLSnippet:
 *   { name, description, shortDescription, relativeLevel, baseLevel,
 *     numItems, numScenery, numNpcs, numHostiles, hasWeather,
 *     controllingFaction, randomStoryEvents }
 *
 * @param {object} opts
 * @param {Array}  opts.messages       - Pre-built prompt messages
 * @param {string} [opts.metadataLabel='location_generation']
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @returns {Promise<object>}
 */
async function generateLocation({ messages, metadataLabel = 'location_generation', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: LocationSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Alter an existing location (Events._parseLocationAlterXml replacement).
 * Returns { name, description, shortDescription, baseLevel } with nulls for unchanged fields.
 *
 * @param {object} opts
 * @param {Array}  opts.messages
 * @param {string} [opts.metadataLabel='alter_location']
 * @returns {Promise<object>}
 */
async function alterLocation({ messages, metadataLabel = 'alter_location', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: LocationAlterSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Regenerate a location name.
 * Returns { name }.
 *
 * @param {object} opts
 * @param {Array}  opts.messages
 * @param {string} [opts.metadataLabel='location_name_regen']
 * @returns {Promise<object>}
 */
async function regenLocationName({ messages, metadataLabel = 'location_name_regen', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: LocationNameRegenSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

module.exports = {
    generateLocation,
    alterLocation,
    regenLocationName,
};
