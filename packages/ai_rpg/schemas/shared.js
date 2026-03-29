/**
 * Shared sub-schemas reused across multiple prompt response types.
 */

const { z } = require('zod');

// --- Personality ---

const PersonalitySchema = z.object({
    type: z.string().describe('Personality archetype (e.g. "stoic", "jovial", "cunning")'),
    traits: z.array(z.string()).describe('Specific personality traits'),
    notes: z.string().optional().describe('Additional personality notes'),
    goals: z.array(z.string()).optional().describe('Personal goals and motivations'),
});

// --- Attributes ---

const AttributeSchema = z.object({
    name: z.string().describe('Attribute name (e.g. "strength", "intelligence")'),
    value: z.number().describe('Numeric attribute rating'),
});

// --- Status Effects ---

const StatusEffectSchema = z.object({
    name: z.string().optional().describe('Effect name'),
    description: z.string().describe('What the effect does'),
    duration: z.string().optional().describe('How long it lasts'),
    attributes: z.array(AttributeSchema).optional().describe('Attribute modifications'),
});

// --- Skill Checks ---

const SkillCheckSchema = z.object({
    skill: z.string().describe('Skill being checked'),
    attribute: z.string().describe('Governing attribute'),
    difficulty: z.string().describe('Difficulty level'),
    opposedCheck: z.object({
        skill: z.string(),
        attribute: z.string(),
    }).optional().describe('Opposed check details if applicable'),
    circumstanceModifiers: z.array(z.string()).optional().describe('Situational modifiers'),
});

// --- Circumstance Modifier (combat) ---

const CircumstanceModifierSchema = z.object({
    amount: z.number().describe('Modifier amount (positive or negative)'),
    reason: z.string().describe('Why this modifier applies'),
});

// --- Name Regen (shared across NPC, location, thing, region) ---

const NameRegenSchema = z.object({
    name: z.string().describe('New generated name'),
});

// --- Rewards ---

const FactionReputationRewardSchema = z.object({
    name: z.string().describe('Faction name'),
    points: z.number().describe('Reputation points gained or lost'),
});

const RewardsSchema = z.object({
    items: z.array(z.string()).optional().describe('Reward item descriptions'),
    currency: z.number().optional().describe('Currency reward amount'),
    xp: z.number().optional().describe('Experience points reward'),
    factionReputation: z.array(FactionReputationRewardSchema).optional()
        .describe('Faction reputation changes'),
});

// --- Short Description ---

const ShortDescriptionSchema = z.object({
    shortDescription: z.string().describe('A brief one-line description'),
});

module.exports = {
    PersonalitySchema,
    AttributeSchema,
    StatusEffectSchema,
    SkillCheckSchema,
    CircumstanceModifierSchema,
    NameRegenSchema,
    FactionReputationRewardSchema,
    RewardsSchema,
    ShortDescriptionSchema,
};
