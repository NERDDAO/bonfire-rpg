/**
 * Combat-related handler functions.
 *
 * Each function receives a pre-built messages array and calls aiGenerateObject()
 * to get a structured response, replacing inline XML parsing from api.js/server.js.
 */

const { aiGenerateObject } = require('../ai.js');
const {
    SimpleYesNoSchema,
    AttackCheckSchema,
    PlausibilitySchema,
    DispositionSchema,
    EquipBestSchema,
} = require('../schemas/simple.js');

/**
 * Attack precheck: quick yes/no on whether an action involves combat.
 * Replaces the inline <response>yes/no</response> parsing in runAttackPrecheck (api.js).
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='attack_precheck']
 * @returns {Promise<{response: 'yes'|'no'}>}
 */
async function attackPrecheck({ messages, metadataLabel = 'attack_precheck', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: SimpleYesNoSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Full attack check: identify attackers, defenders, skills, and modifiers.
 * Replaces parseAttackCheckResponse (api.js).
 *
 * The returned object matches the shape callers expect:
 *   { attacks, hasAttack, isRejected?, rejection?, rejectionReason? }
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='attack_check']
 * @returns {Promise<{attacks: Array, hasAttack: boolean, isRejected?: boolean, rejection?: object, rejectionReason?: string}>}
 */
async function attackCheck({ messages, metadataLabel = 'attack_check', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: AttackCheckSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Plausibility check: determine if a player action is plausible.
 * Replaces parsePlausibilityOutcome (server.js).
 *
 * Used for metadataLabels: plausibility_check, npc_plausibility, craft_plausibility.
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='plausibility_check']
 * @returns {Promise<{type: string, reason?: string, skillCheck?: object, itemsMentioned?: string[], abilitiesMentioned?: string[]}>}
 */
async function plausibilityCheck({ messages, metadataLabel = 'plausibility_check', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: PlausibilitySchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Disposition check: determine NPC dispositions towards the player.
 * Replaces parseDispositionCheckResponse (api.js).
 *
 * Returns { npcDispositions: [{ name, dispositions: [{ type, intensity, reason }] }] }.
 * The caller currently expects an array of { name, dispositions } entries;
 * unwrap via result.npcDispositions.
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='disposition_check']
 * @returns {Promise<{npcDispositions: Array<{name: string, dispositions: Array}>}>}
 */
async function dispositionCheck({ messages, metadataLabel = 'disposition_check', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: DispositionSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

/**
 * Equip-best: determine optimal gear slot assignments for a character's inventory.
 * Replaces parseEquipBestAssignments (server.js).
 *
 * Returns { items: [{ itemName, slotName }] }.
 * The caller currently expects a flat array; unwrap via result.items.
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='equip_best']
 * @returns {Promise<{items: Array<{itemName: string, slotName: string}>}>}
 */
async function equipBest({ messages, metadataLabel = 'equip_best', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: EquipBestSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

module.exports = {
    attackPrecheck,
    attackCheck,
    plausibilityCheck,
    dispositionCheck,
    equipBest,
};
