/**
 * Thing/Item schemas: generation, alteration, name regeneration.
 */

const { z } = require('zod');
const { NameRegenSchema } = require('./shared');

// --- Attribute Bonus ---

const AttributeBonusSchema = z.object({
    attribute: z.string().describe('Attribute name'),
    bonus: z.number().describe('Bonus value (positive or negative)'),
});

// --- Status Effect on Thing (causeStatusEffectOnTarget / causeStatusEffectOnEquipper) ---

const StatusEffectAttributeModSchema = z.object({
    attribute: z.string().describe('Attribute name'),
    modifier: z.number().describe('Modifier value'),
});

const StatusEffectSkillModSchema = z.object({
    skill: z.string().describe('Skill name'),
    modifier: z.number().describe('Modifier value'),
});

const StatusEffectNeedBarModSchema = z.object({
    name: z.string().describe('Need bar name'),
    delta: z.number().describe('Delta change per tick'),
});

const ThingStatusEffectSchema = z.object({
    name: z.string().optional().describe('Effect name'),
    description: z.string().optional().describe('What the effect does'),
    duration: z.string().optional().describe('Duration (omitted or "n/a" means permanent)'),
    attributes: z.array(StatusEffectAttributeModSchema).optional()
        .describe('Attribute modifiers applied by this effect'),
    skills: z.array(StatusEffectSkillModSchema).optional()
        .describe('Skill modifiers applied by this effect'),
    needBars: z.array(StatusEffectNeedBarModSchema).optional()
        .describe('Need bar adjustments applied by this effect'),
});

// --- Single Thing/Item (from parseThingsXml) ---

const ThingSchema = z.object({
    name: z.string().describe('Item or scenery name'),
    description: z.string().optional().default('').describe('Full description'),
    shortDescription: z.string().optional().default('').describe('One-line summary'),
    itemOrScenery: z.enum(['item', 'scenery']).optional().default('item')
        .describe('Whether this is an item or scenery'),
    type: z.string().optional().default('item')
        .describe('Item type (e.g. "weapon", "armor", "potion", "scenery")'),
    slot: z.string().optional().default('')
        .describe('Equipment slot (e.g. "mainHand", "chest"); empty if not equippable'),
    rarity: z.string().optional().default('')
        .describe('Rarity label (e.g. "common", "uncommon", "rare")'),
    value: z.string().optional().default('').describe('Monetary value'),
    weight: z.string().optional().default('').describe('Weight'),
    properties: z.string().optional().default('').describe('Special properties text'),
    relativeLevel: z.number().nullable().optional()
        .describe('Power level relative to player'),
    attributeBonuses: z.array(AttributeBonusSchema).optional().default([])
        .describe('Attribute bonuses when equipped'),
    causeStatusEffectOnTarget: ThingStatusEffectSchema.nullable().optional()
        .describe('Status effect applied to targets on use/hit'),
    causeStatusEffectOnEquipper: ThingStatusEffectSchema.nullable().optional()
        .describe('Status effect applied to the equipper'),
    isVehicle: z.boolean().optional().default(false),
    isCraftingStation: z.boolean().optional().default(false),
    isProcessingStation: z.boolean().optional().default(false),
    isHarvestable: z.boolean().optional().default(false),
    isSalvageable: z.boolean().optional().default(false),
});

// --- Thing Array (items/things collection) ---

const ThingArraySchema = z.object({
    things: z.array(ThingSchema).describe('Generated items and scenery'),
});

// --- Thing Name Regen (from parseThingNameRegenResponse) ---
// Each entry maps an old name/id to a new name plus candidate names

const ThingNameRegenEntrySchema = z.object({
    id: z.string().nullable().optional().describe('Thing ID if available'),
    oldName: z.string().nullable().optional().describe('Previous name'),
    name: z.string().describe('Primary new name'),
    names: z.array(z.string()).optional().describe('All candidate names'),
    description: z.string().optional().default('').describe('Updated description'),
});

const ThingNameRegenSchema = z.object({
    items: z.array(ThingNameRegenEntrySchema).describe('Name regeneration entries'),
});

module.exports = {
    ThingSchema,
    ThingArraySchema,
    AttributeBonusSchema,
    ThingStatusEffectSchema,
    StatusEffectAttributeModSchema,
    StatusEffectSkillModSchema,
    StatusEffectNeedBarModSchema,
    ThingNameRegenSchema,
    ThingNameRegenEntrySchema,
    // Re-export shared NameRegenSchema for convenience
    SimpleThingNameRegenSchema: NameRegenSchema,
};
