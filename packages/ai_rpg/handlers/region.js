/**
 * Region handler functions — structured output replacements for XML parsing.
 *
 * Covers:
 *   - generateRegion              (region_generation)          → RegionSchema
 *   - generateRegionStubLocations (region_stub_locations)      → RegionStubSchema
 *   - chooseExistingRegionExit    (existing_region_exit)       → RegionExitSchema
 *   - selectRegionEntrance        (region_entrance_selection)  → EntranceSelectionSchema
 *   - regenRegionName             (region_name_regen)          → RegionNameRegenSchema
 */

const { aiGenerateObject } = require('../ai.js');
const {
    RegionSchema,
    RegionStubSchema,
    RegionExitSchema,
    EntranceSelectionSchema,
    RegionNameRegenSchema,
} = require('../schemas/region.js');

/**
 * Generate a full region with location blueprints (replaces Region.fromXMLSnippet).
 * Returns { regionName, regionDescription, shortDescription, relativeLevel,
 *           numImportantNPCs, controllingFaction, characterConcepts,
 *           enemyConcepts, secrets, locations, randomStoryEvents }.
 *
 * @param {object} opts
 * @param {Array}  opts.messages       - Pre-built prompt messages
 * @param {string} [opts.metadataLabel='region_generation']
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @returns {Promise<object>}
 */
async function generateRegion({ messages, metadataLabel = 'region_generation', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: RegionSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Generate stub locations for an existing region (replaces parseRegionStubLocations).
 * Returns { locations: [{ name, description, shortDescription, relativeLevel,
 *           numNpcs, numHostiles, hasWeather, controllingFaction, exits }, ...] }.
 *
 * @param {object} opts
 * @param {Array}  opts.messages
 * @param {string} [opts.metadataLabel='region_stub_locations']
 * @returns {Promise<object>}
 */
async function generateRegionStubLocations({ messages, metadataLabel = 'region_stub_locations', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: RegionStubSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Choose an exit location in an existing target region (replaces parseExistingRegionExitResponse).
 * Returns { name, reason }.
 *
 * @param {object} opts
 * @param {Array}  opts.messages
 * @param {string} [opts.metadataLabel='existing_region_exit']
 * @returns {Promise<object>}
 */
async function chooseExistingRegionExit({ messages, metadataLabel = 'existing_region_exit', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: RegionExitSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Select an entrance location for a region (replaces parseRegionEntranceResponse).
 * Returns { name }.
 *
 * @param {object} opts
 * @param {Array}  opts.messages
 * @param {string} [opts.metadataLabel='region_entrance_selection']
 * @returns {Promise<object>}
 */
async function selectRegionEntrance({ messages, metadataLabel = 'region_entrance_selection', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: EntranceSelectionSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Regenerate a region name.
 * Returns { name }.
 *
 * @param {object} opts
 * @param {Array}  opts.messages
 * @param {string} [opts.metadataLabel='region_name_regen']
 * @returns {Promise<object>}
 */
async function regenRegionName({ messages, metadataLabel = 'region_name_regen', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: RegionNameRegenSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

module.exports = {
    generateRegion,
    generateRegionStubLocations,
    chooseExistingRegionExit,
    selectRegionEntrance,
    regenRegionName,
};
