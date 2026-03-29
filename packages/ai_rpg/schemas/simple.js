/**
 * Simple response schemas: yes/no checks, plausibility, dispositions, equip-best.
 */

const { z } = require('zod');
const { CircumstanceModifierSchema } = require('./shared');

// --- Attack Precheck: simple yes/no (<response>yes</response> / <response>no</response>) ---

const SimpleYesNoSchema = z.object({
    response: z.enum(['yes', 'no']).describe('Simple yes or no answer'),
});

// --- Plausibility Outcome ---
// Parsed by parsePlausibilityOutcome in server.js.
// Fields: type, reason, skillCheck (optional), itemsMentioned[], abilitiesMentioned[]

const PlausibilityOpposedCheckSchema = z.object({
    opponent: z.string().nullable().optional().describe('Opponent name'),
    opponentSkill: z.string().nullable().optional().describe('Opponent skill used'),
    opponentAttribute: z.string().nullable().optional().describe('Opponent attribute used'),
});

const PlausibilitySkillCheckSchema = z.object({
    skill: z.string().nullable().optional().describe('Skill being checked'),
    attribute: z.string().nullable().optional().describe('Governing attribute'),
    difficulty: z.string().nullable().optional().describe('Difficulty level or "Opposed"'),
    reason: z.string().nullable().optional().describe('Why a skill check is needed'),
    checkType: z.enum(['opposed', 'unopposed']).optional().describe('Whether check is opposed or unopposed'),
    opposedCheck: PlausibilityOpposedCheckSchema.optional().describe('Opposed check details'),
    unopposedCheck: z.object({
        difficultyLevel: z.string().nullable().optional(),
    }).optional().describe('Unopposed check difficulty'),
    circumstanceModifiers: z.array(CircumstanceModifierSchema).optional()
        .describe('Situational modifiers with amount and reason'),
    circumstanceModifier: z.number().optional().describe('Total circumstance modifier sum'),
    circumstanceModifierReason: z.string().nullable().optional().describe('Combined modifier reasons'),
});

const MentionedEntrySchema = z.object({
    name: z.string().describe('Name of the mentioned item or ability'),
});

const PlausibilitySchema = z.object({
    type: z.string().describe('Outcome type (e.g. "Plausible", "Implausible", "Rejected")'),
    reason: z.string().nullable().optional().describe('Explanation of the outcome'),
    skillCheck: PlausibilitySkillCheckSchema.nullable().optional()
        .describe('Skill check details if the action requires one'),
    itemsMentioned: z.array(z.string()).optional()
        .describe('Items referenced in the action'),
    abilitiesMentioned: z.array(z.string()).optional()
        .describe('Abilities referenced in the action'),
});

// --- Disposition Check ---
// Parsed by parseDispositionCheckResponse in api.js.
// Each NPC has a name and array of disposition entries.

const DispositionEntrySchema = z.object({
    type: z.string().describe('Disposition type (e.g. "trust", "fear", "hostility")'),
    intensity: z.number().describe('Numeric intensity value (non-zero integer)'),
    reason: z.string().nullable().optional().describe('Reason for this disposition'),
});

const NPCDispositionSchema = z.object({
    name: z.string().describe('NPC name'),
    dispositions: z.array(DispositionEntrySchema).describe('Dispositions towards the player'),
});

const DispositionSchema = z.object({
    npcDispositions: z.array(NPCDispositionSchema).describe('Array of NPC disposition sets'),
});

// --- Attack Check ---
// Parsed by parseAttackCheckResponse in api.js.
// Returns an array of attack entries with attacker/defender/skill info,
// plus rejection info when the action is not a valid attack.

const AttackCircumstanceModifierSchema = z.object({
    amount: z.number().describe('Modifier amount (positive favours attacker, negative favours defender)'),
    reason: z.string().nullable().optional().describe('Reason for this modifier'),
});

const AttackerInfoSchema = z.object({
    attackSkill: z.string().nullable().optional().describe('Skill used for the attack roll'),
    damageAttribute: z.string().nullable().optional().describe('Attribute governing damage'),
});

const DefenderInfoSchema = z.object({
    evadeSkill: z.string().nullable().optional().describe('Skill used to evade'),
    defenseSkill: z.string().nullable().optional().describe('Legacy defense skill (use evadeSkill instead)'),
    deflectSkill: z.string().nullable().optional().describe('Skill used to deflect/block'),
    toughnessAttribute: z.string().nullable().optional().describe('Attribute governing damage resistance'),
});

const AttackEntrySchema = z.object({
    attacker: z.string().nullable().optional().describe('Name of the attacker'),
    defender: z.string().nullable().optional().describe('Name of the defender'),
    ability: z.string().nullable().optional().describe('Ability used in the attack'),
    weapon: z.string().nullable().optional().describe('Weapon used in the attack'),
    damageEffectiveness: z.number().nullable().optional()
        .describe('Damage effectiveness rating (integer)'),
    attackerInfo: AttackerInfoSchema.optional().describe('Attacker skill/attribute info'),
    defenderInfo: DefenderInfoSchema.optional().describe('Defender skill/attribute info'),
    circumstanceModifiers: z.array(AttackCircumstanceModifierSchema).optional()
        .describe('Individual circumstance modifiers'),
    circumstanceModifier: z.number().optional()
        .describe('Total summed circumstance modifier'),
    circumstanceModifierReason: z.string().nullable().optional()
        .describe('Combined modifier reasons joined by semicolons'),
});

const AttackRejectionSchema = z.object({
    reason: z.string().describe('Why the attack was rejected'),
});

const AttackCheckSchema = z.object({
    attacks: z.array(AttackEntrySchema).describe('Parsed attack entries'),
    hasAttack: z.boolean().describe('Whether at least one valid attack was found'),
    isRejected: z.boolean().optional().describe('Whether the attack was rejected'),
    rejection: AttackRejectionSchema.nullable().optional()
        .describe('Rejection details if the attack was rejected'),
    rejectionReason: z.string().nullable().optional()
        .describe('Top-level rejection reason string'),
});

// --- Equip Best ---
// Parsed by parseEquipBestAssignments in server.js.
// Each assignment maps an item to an equipment slot.

const EquipBestAssignmentSchema = z.object({
    itemName: z.string().describe('Name of the item to equip'),
    slotName: z.string().describe('Gear slot to equip it in'),
});

const EquipBestSchema = z.object({
    items: z.array(EquipBestAssignmentSchema).describe('List of item-to-slot assignments'),
});

module.exports = {
    SimpleYesNoSchema,
    AttackCheckSchema,
    AttackEntrySchema,
    AttackerInfoSchema,
    DefenderInfoSchema,
    AttackCircumstanceModifierSchema,
    AttackRejectionSchema,
    PlausibilitySchema,
    PlausibilitySkillCheckSchema,
    PlausibilityOpposedCheckSchema,
    MentionedEntrySchema,
    DispositionSchema,
    DispositionEntrySchema,
    NPCDispositionSchema,
    EquipBestSchema,
    EquipBestAssignmentSchema,
};
