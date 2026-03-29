/**
 * Schemas for quest_generate and quest_check responses.
 *
 * quest_generate: Parsed by Events._parseQuestXml — a full quest definition
 *   with name, description, giver, secretNotes, objectives, and rewards.
 *
 * quest_check: Parsed by Events.parseQuestObjectiveStatusXml — quest
 *   objective completion status entries.
 */

const { z } = require('zod');
const { RewardsSchema } = require('./shared');

// --- Quest objective (within quest_generate) ---

const QuestObjectiveSchema = z.object({
    description: z.string().describe('What needs to be done for this objective'),
    optional: z.boolean().describe('Whether this objective is optional (currently always false)'),
});

// --- Faction reputation reward (map format as returned by _parseQuestXml) ---
// Note: _parseQuestXml returns rewardFactionReputation as an object map
// { [factionName]: points } rather than the array used in shared RewardsSchema.

const QuestFactionReputationMapSchema = z.record(
    z.string(),
    z.number(),
).describe('Map of faction name to reputation points gained or lost');

// --- Full quest definition (quest_generate) ---

const QuestSchema = z.object({
    name: z.string().describe('Quest name'),
    description: z.string().describe('Quest description'),
    giver: z.string().describe('Name of the NPC who gives the quest'),
    secretNotes: z.string().describe('Hidden DM notes about the quest'),
    objectives: z.array(QuestObjectiveSchema).describe('List of quest objectives'),
    rewardItems: z.array(z.string()).describe('Deduplicated list of reward item descriptions'),
    rewardCurrency: z.number().describe('Currency reward amount (0 if none)'),
    rewardXp: z.number().describe('Experience points reward (0 if none)'),
    rewardFactionReputation: QuestFactionReputationMapSchema
        .describe('Faction reputation changes from quest completion'),
});

// --- Quest objective status (quest_check) ---

const QuestCheckEntrySchema = z.object({
    quest: z.string().nullable().describe('Resolved quest name, or null if unresolved'),
    questId: z.string().nullable().describe('Resolved quest ID, or null'),
    questIndex: z.number().int().describe('1-based quest index from the LLM response'),
    objectiveIndex: z.number().int().describe('1-based objective index from the LLM response'),
});

const QuestCheckSchema = z.array(QuestCheckEntrySchema)
    .describe('List of completed quest objective entries');

module.exports = {
    QuestObjectiveSchema,
    QuestFactionReputationMapSchema,
    QuestSchema,
    QuestCheckEntrySchema,
    QuestCheckSchema,
};
