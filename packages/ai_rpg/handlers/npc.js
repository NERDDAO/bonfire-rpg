/**
 * NPC-related handler functions.
 *
 * Each function receives a pre-built messages array and calls aiGenerateObject()
 * to get a structured response, replacing inline XML parsing from server.js/Events.js.
 *
 * Where existing callers expect a Map (skill assignments, ability assignments, alias
 * assignments, name regen), the handler converts the schema array output into the
 * same Map structure.
 */

const { aiGenerateObject } = require('../ai.js');
const {
    NPCArraySchema,
    NPCAlterSchema,
    SkillAssignmentSchema,
    AbilityAssignmentSchema,
    AliasAssignmentSchema,
    NPCNameRegenSchema,
} = require('../schemas/npc.js');

/**
 * Convert the schema's npcMemories array into a Map keyed by lowercase NPC name,
 * matching the shape returned by parseLocationNpcs.
 */
function buildMemoriesMap(npcMemories) {
    const memories = new Map();
    if (!Array.isArray(npcMemories)) {
        return memories;
    }
    for (const entry of npcMemories) {
        if (!entry || !entry.npcName) {
            continue;
        }
        const key = entry.npcName.trim().toLowerCase();
        if (!key) {
            continue;
        }
        const mems = Array.isArray(entry.memories)
            ? entry.memories.filter(Boolean).slice(0, 3)
            : [];
        if (mems.length) {
            memories.set(key, mems);
        }
    }
    return memories;
}

/**
 * Flatten an NPC schema object's personality/attributes into the flat shape
 * that parseLocationNpcs returns (personalityType, personalityTraits, etc.
 * and attributes as a plain { name: rating } object).
 */
function flattenNpc(npc) {
    const flat = { ...npc };

    // Flatten personality from nested object to flat fields
    if (npc.personality) {
        flat.personalityType = npc.personality.type || null;
        flat.personalityTraits = npc.personality.traits || null;
        flat.personalityNotes = npc.personality.notes || null;
        flat.goals = Array.isArray(npc.personality.goals) ? npc.personality.goals : [];
        delete flat.personality;
    } else {
        flat.personalityType = null;
        flat.personalityTraits = null;
        flat.personalityNotes = null;
        flat.goals = [];
    }

    // Convert attributes from array of { name, rating } to { name: rating } object
    if (Array.isArray(npc.attributes)) {
        const attrObj = {};
        for (const attr of npc.attributes) {
            if (attr && attr.name) {
                attrObj[attr.name] = attr.rating || '';
            }
        }
        flat.attributes = attrObj;
    } else {
        flat.attributes = {};
    }

    // Clamp relativeLevel to [-10, 10]
    if (Number.isFinite(flat.relativeLevel)) {
        flat.relativeLevel = Math.max(-10, Math.min(10, Math.round(flat.relativeLevel)));
    } else {
        flat.relativeLevel = null;
    }

    // Normalize healthAttribute
    if (flat.healthAttribute && flat.healthAttribute.toLowerCase() === 'n/a') {
        flat.healthAttribute = null;
    }

    // Normalize currency
    if (!Number.isFinite(flat.currency) || flat.currency < 0) {
        flat.currency = null;
    }

    return flat;
}

/**
 * Generate NPCs for a location, region, or single NPC regeneration.
 * Replaces parseLocationNpcs / parseRegionNpcs (server.js).
 *
 * Used for metadataLabels: npc_generation_single, location_npc_generation,
 * region_npc_generation.
 *
 * Returns { npcs: [...flatNpc], memories: Map<string, string[]> }
 * matching the shape callers expect from parseLocationNpcs.
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='location_npc_generation']
 * @returns {Promise<{npcs: Array, memories: Map}>}
 */
async function generateNpcs({ messages, metadataLabel = 'location_npc_generation', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: NPCArraySchema,
        messages,
        metadataLabel,
        ...overrides,
    });

    // Merge npcs and hostiles into a single array, flattening each to match
    // the shape parseLocationNpcs returns.
    const allNpcs = [];
    if (Array.isArray(object.npcs)) {
        for (const npc of object.npcs) {
            if (npc && npc.name) {
                allNpcs.push(flattenNpc(npc));
            }
        }
    }
    if (Array.isArray(object.hostiles)) {
        for (const npc of object.hostiles) {
            if (npc && npc.name) {
                const flattened = flattenNpc(npc);
                flattened.isHostile = true;
                allNpcs.push(flattened);
            }
        }
    }

    return {
        npcs: allNpcs,
        memories: buildMemoriesMap(object.npcMemories),
    };
}

/**
 * Alter an NPC after an event.
 * Replaces _parseCharacterAlterXml (Events.js) for the alter_npc metadataLabel.
 *
 * Returns the same shape as _parseCharacterAlterXml: { name, description,
 * shortDescription, role, class, race, relativeLevel, currency, personality,
 * attributes (as { name: value } object), statusEffects, abilities, inventory }.
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='alter_npc']
 * @returns {Promise<object>} - Parsed character alteration object
 */
async function alterNpc({ messages, metadataLabel = 'alter_npc', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: NPCAlterSchema,
        messages,
        metadataLabel,
        ...overrides,
    });

    // Convert attributes from array of { name, value } to { name: value } object
    // to match _parseCharacterAlterXml return shape.
    const attributes = {};
    if (Array.isArray(object.attributes)) {
        for (const attr of object.attributes) {
            if (attr && attr.name) {
                attributes[attr.name] = attr.value || '';
            }
        }
    }

    return {
        name: object.name || null,
        description: object.description || '',
        shortDescription: object.shortDescription || '',
        role: object.role || '',
        class: object.class || '',
        race: object.race || '',
        relativeLevel: Number.isFinite(object.relativeLevel) ? object.relativeLevel : null,
        currency: Number.isFinite(object.currency) ? object.currency : null,
        personality: object.personality || null,
        attributes,
        statusEffects: Array.isArray(object.statusEffects) ? object.statusEffects : [],
        abilities: Array.isArray(object.abilities) ? object.abilities : [],
        inventory: Array.isArray(object.inventory) ? object.inventory : [],
    };
}

/**
 * Assign skill and attribute priorities to generated NPCs.
 * Replaces parseNpcSkillAssignments (server.js).
 *
 * Returns a Map keyed by lowercase NPC name, each value being
 * { name, skills: [{ name, priority }], attributes: [{ name, priority }] }.
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='npc_progression_assignments']
 * @returns {Promise<Map<string, {name: string, skills: Array, attributes: Array}>>}
 */
async function npcSkillAssignments({ messages, metadataLabel = 'npc_progression_assignments', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: SkillAssignmentSchema,
        messages,
        metadataLabel,
        ...overrides,
    });

    const result = new Map();
    if (!Array.isArray(object.npcs)) {
        return result;
    }
    for (const entry of object.npcs) {
        if (!entry || !entry.name) {
            continue;
        }
        const skills = Array.isArray(entry.skills) ? entry.skills : [];
        const attributes = Array.isArray(entry.attributes) ? entry.attributes : [];
        if (skills.length || attributes.length) {
            result.set(entry.name.toLowerCase(), {
                name: entry.name,
                skills,
                attributes,
            });
        }
    }
    return result;
}

/**
 * Assign abilities to generated NPCs.
 * Replaces parseNpcAbilityAssignments (server.js).
 *
 * Returns a Map keyed by lowercase NPC name, each value being
 * { name, abilities: [{ name, description, shortDescription, type, level }] }.
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='npc_ability_assignments']
 * @returns {Promise<Map<string, {name: string, abilities: Array}>>}
 */
async function npcAbilityAssignments({ messages, metadataLabel = 'npc_ability_assignments', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: AbilityAssignmentSchema,
        messages,
        metadataLabel,
        ...overrides,
    });

    const result = new Map();
    if (!Array.isArray(object.npcs)) {
        return result;
    }
    for (const entry of object.npcs) {
        if (!entry || !entry.name) {
            continue;
        }
        const abilities = Array.isArray(entry.abilities) ? entry.abilities : [];
        if (abilities.length) {
            result.set(entry.name.toLowerCase(), {
                name: entry.name,
                abilities,
            });
        }
    }
    return result;
}

/**
 * Assign aliases (short names) to generated NPCs.
 * Replaces parseNpcAliasAssignments (server.js).
 *
 * Returns a Map keyed by lowercase NPC name, each value being
 * { name, aliases: string[] }.
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='npc_alias_assignments']
 * @returns {Promise<Map<string, {name: string, aliases: string[]}>>}
 */
async function npcAliasAssignments({ messages, metadataLabel = 'npc_alias_assignments', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: AliasAssignmentSchema,
        messages,
        metadataLabel,
        ...overrides,
    });

    const result = new Map();
    if (!Array.isArray(object.npcs)) {
        return result;
    }
    for (const entry of object.npcs) {
        if (!entry || !entry.name) {
            continue;
        }
        result.set(entry.name.toLowerCase(), {
            name: entry.name,
            aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
        });
    }
    return result;
}

/**
 * Regenerate NPC names.
 * Replaces parseNpcNameRegenResponse (server.js).
 *
 * The NPCNameRegenSchema is NameRegenSchema ({ name }), so this returns just
 * the new name. The full name-regen pipeline (with candidates, shortTemplate,
 * descriptionTemplate) requires a richer schema; this handler covers the
 * simple single-name case.
 *
 * @param {object} options
 * @param {Array} options.messages - Prompt messages array
 * @param {string} [options.metadataLabel='npc_name_regen']
 * @returns {Promise<{name: string}>}
 */
async function npcNameRegen({ messages, metadataLabel = 'npc_name_regen', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: NPCNameRegenSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

module.exports = {
    generateNpcs,
    alterNpc,
    npcSkillAssignments,
    npcAbilityAssignments,
    npcAliasAssignments,
    npcNameRegen,
};
