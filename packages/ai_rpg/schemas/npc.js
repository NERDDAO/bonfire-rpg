/**
 * NPC schemas: generation, alteration, skill/ability/alias assignments.
 */

const { z } = require('zod');
const { NameRegenSchema } = require('./shared');

// --- NPC Personality (inline, matches parseLocationNpcs structure) ---
// parseLocationNpcs stores personalityType, personalityTraits, personalityNotes, goals
// as flat fields rather than nested PersonalitySchema — mirror that here.

// --- Single NPC (from parseLocationNpcs / parseRegionNpcs) ---

const NPCAttributeSchema = z.object({
    name: z.string().describe('Attribute name (e.g. "strength")'),
    rating: z.string().describe('Rating label (e.g. "average", "excellent")'),
});

const NPCPersonalitySchema = z.object({
    type: z.string().optional().describe('Personality archetype'),
    traits: z.string().optional().describe('Comma-separated personality traits'),
    notes: z.string().optional().describe('Additional personality notes'),
    goals: z.array(z.string()).optional().describe('Personal goals'),
});

const NPCSchema = z.object({
    name: z.string().describe('NPC name'),
    description: z.string().optional().default('').describe('Full description'),
    shortDescription: z.string().optional().default('').describe('One-line summary'),
    role: z.string().nullable().optional().describe('NPC role (e.g. "shopkeeper", "guard")'),
    class: z.string().nullable().optional().describe('Character class'),
    race: z.string().nullable().optional().describe('Race or species'),
    gender: z.string().nullable().optional().describe('Gender'),
    faction: z.string().optional().default('').describe('Faction affiliation'),
    attributes: z.array(NPCAttributeSchema).optional().describe('Attribute name-rating pairs'),
    personality: NPCPersonalitySchema.optional().describe('Personality details'),
    relativeLevel: z.number().nullable().optional()
        .describe('Power level relative to player (-10 to 10)'),
    resistances: z.string().optional().default('').describe('Damage resistances'),
    vulnerabilities: z.string().optional().default('').describe('Damage vulnerabilities'),
    healthAttribute: z.string().nullable().optional()
        .describe('Which attribute governs health'),
    currency: z.number().nullable().optional().describe('Currency amount carried'),
    isHostile: z.boolean().optional().default(false).describe('Whether NPC is hostile'),
});

// --- NPC Array (from parseLocationNpcs result shape) ---

const NPCMemorySchema = z.object({
    npcName: z.string().describe('NPC name the memories belong to'),
    memories: z.array(z.string()).describe('Memory entries (max 3)'),
});

const NPCArraySchema = z.object({
    npcs: z.array(NPCSchema).describe('Non-hostile NPCs'),
    hostiles: z.array(NPCSchema).optional().describe('Hostile NPCs'),
    npcMemories: z.array(NPCMemorySchema).optional().describe('NPC memory entries'),
});

// --- NPC Alteration (from Events.js alter_npc) ---
// Shape: { name, description } — only physical transformations pass through

const NPCAlterSchema = z.object({
    name: z.string().describe('Name of the NPC being altered'),
    description: z.string().nullable().optional()
        .describe('Description of the physical transformation'),
});

// --- Skill Assignments (from parseNpcSkillAssignments) ---

const SkillPriorityEntrySchema = z.object({
    name: z.string().describe('Skill name'),
    priority: z.number().min(1).max(3).describe('Priority level (1-3)'),
});

const AttributePriorityEntrySchema = z.object({
    name: z.string().describe('Attribute name'),
    priority: z.number().min(1).max(3).describe('Priority level (1-3)'),
});

const NPCSkillAssignmentSchema = z.object({
    name: z.string().describe('NPC name'),
    skills: z.array(SkillPriorityEntrySchema).optional().default([])
        .describe('Skill assignments with priority'),
    attributes: z.array(AttributePriorityEntrySchema).optional().default([])
        .describe('Attribute assignments with priority'),
});

const SkillAssignmentSchema = z.object({
    npcs: z.array(NPCSkillAssignmentSchema).describe('Per-NPC skill/attribute assignments'),
});

// --- Ability Assignments (from parseNpcAbilityAssignments) ---

const NPCAbilityEntrySchema = z.object({
    name: z.string().describe('Ability name'),
    description: z.string().optional().default('').describe('What the ability does'),
    shortDescription: z.string().optional().default('').describe('Brief summary'),
    type: z.enum(['Active', 'Passive', 'Triggered']).optional().default('Passive')
        .describe('Ability type'),
    level: z.number().min(1).optional().default(1).describe('Ability level'),
});

const NPCAbilityAssignmentSchema = z.object({
    name: z.string().describe('NPC name'),
    abilities: z.array(NPCAbilityEntrySchema).describe('Abilities assigned to this NPC'),
});

const AbilityAssignmentSchema = z.object({
    npcs: z.array(NPCAbilityAssignmentSchema).describe('Per-NPC ability assignments'),
});

// --- Alias Assignments (from parseNpcAliasAssignments) ---

const NPCAliasAssignmentSchema = z.object({
    name: z.string().describe('NPC full name'),
    aliases: z.array(z.string()).describe('Alternative names or short names'),
});

const AliasAssignmentSchema = z.object({
    npcs: z.array(NPCAliasAssignmentSchema).describe('Per-NPC alias assignments'),
});

module.exports = {
    NPCSchema,
    NPCAttributeSchema,
    NPCPersonalitySchema,
    NPCArraySchema,
    NPCMemorySchema,
    NPCAlterSchema,
    SkillAssignmentSchema,
    NPCSkillAssignmentSchema,
    SkillPriorityEntrySchema,
    AttributePriorityEntrySchema,
    AbilityAssignmentSchema,
    NPCAbilityAssignmentSchema,
    NPCAbilityEntrySchema,
    AliasAssignmentSchema,
    NPCAliasAssignmentSchema,
    // Re-export shared NameRegenSchema for convenience
    NPCNameRegenSchema: NameRegenSchema,
};
