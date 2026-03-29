/**
 * Thing/Item handler functions — structured output replacements for XML parsing.
 *
 * Covers:
 *   - generateThings           (thing_generation / location_things_generation / inventory_generation)
 *   - alterThing               (alter_thing)
 *   - generateShortDescription (short_description)
 *   - regenThingName           (thing_name_regen)
 */

const { aiGenerateObject } = require('../ai.js');
const {
    ThingArraySchema,
    ThingSchema,
    ThingNameRegenSchema,
} = require('../schemas/thing.js');
const { ShortDescriptionSchema } = require('../schemas/shared.js');

/**
 * Generate an array of things/items from a prompt (replaces parseThingsXml).
 * Used by thing_generation, location_things_generation, and inventory_generation.
 * Returns { things: [...] } where each thing matches the ThingSchema shape.
 *
 * @param {object} opts
 * @param {Array}  opts.messages       - Pre-built prompt messages
 * @param {string} [opts.metadataLabel='thing_generation']
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @returns {Promise<object>}
 */
async function generateThings({ messages, metadataLabel = 'thing_generation', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: ThingArraySchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Alter an existing thing/item.
 * Returns a single thing object matching ThingSchema (the first/only item in the response).
 *
 * @param {object} opts
 * @param {Array}  opts.messages
 * @param {string} [opts.metadataLabel='alter_thing']
 * @returns {Promise<object>}
 */
async function alterThing({ messages, metadataLabel = 'alter_thing', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: ThingSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Generate a short description for an item, location, region, or ability.
 * Returns { shortDescription }.
 *
 * @param {object} opts
 * @param {Array}  opts.messages
 * @param {string} [opts.metadataLabel='short_description']
 * @returns {Promise<object>}
 */
async function generateShortDescription({ messages, metadataLabel = 'short_description', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: ShortDescriptionSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Regenerate thing/item names.
 * Returns { items: [{ id, oldName, name, names, description }, ...] }.
 *
 * @param {object} opts
 * @param {Array}  opts.messages
 * @param {string} [opts.metadataLabel='thing_name_regen']
 * @returns {Promise<object>}
 */
async function regenThingName({ messages, metadataLabel = 'thing_name_regen', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: ThingNameRegenSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

module.exports = {
    generateThings,
    alterThing,
    generateShortDescription,
    regenThingName,
};
