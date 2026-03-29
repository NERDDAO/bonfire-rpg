/**
 * Schemas for narrative / text-oriented prompt responses.
 *
 * Covers: slop_remover, plot_summary, plot_expander, game_intro (all plain
 * text), supplemental_story_info, batch summaries, crafting narratives,
 * and memory selection.
 */

const { z } = require('zod');

// --- Memory selection (choose_important_memories) ---
// Parsed by parseChooseImportantMemoriesResponse in server.js.
// Returns a Map<string, number[]> of NPC name -> recalled memory indices.

const MemorySelectionNpcSchema = z.object({
    name: z.string().describe('NPC name (lowercased as map key)'),
    recalledMemories: z.array(z.number().int())
        .describe('Zero-based indices of the most important memories for this NPC'),
});

const MemorySelectionSchema = z.array(MemorySelectionNpcSchema)
    .describe('Per-NPC memory selections from the LLM');

// --- Supplemental story info ---
// parseSupplementalStoryInfoResponse returns a plain string extracted from
// <storyNotes> XML.  The schema wraps it for structured output consistency.

const StoryInfoSchema = z.object({
    storyNotes: z.string().describe('Supplemental story notes and world-building details'),
});

// --- Batch summary ---
// parseBatchSummaryResponse returns a Map<number, string> keyed by 0-based
// index.  Each <summary number="N"> element holds a summary string.

const BatchSummaryEntrySchema = z.object({
    number: z.number().int().describe('1-based summary number from the XML attribute'),
    text: z.string().describe('Summary text for this chat entry'),
});

const BatchSummarySchema = z.object({
    summaries: z.array(BatchSummaryEntrySchema)
        .describe('Summarized chat entries, one per input'),
});

// --- Crafting narrative (craft_player_action) ---
// parseCraftingNarrativeResponse returns { description, otherEffectDescription }.

const CraftingNarrativeSchema = z.object({
    description: z.string().describe('Narrative prose describing the crafting action and outcome'),
    otherEffectDescription: z.string().optional()
        .describe('Description of any secondary/side effects from the crafting'),
});

module.exports = {
    MemorySelectionNpcSchema,
    MemorySelectionSchema,
    StoryInfoSchema,
    BatchSummaryEntrySchema,
    BatchSummarySchema,
    CraftingNarrativeSchema,
};
