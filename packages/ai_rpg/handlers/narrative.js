/**
 * Narrative handlers — structured output replacements for inline XML parsing.
 *
 * Covers: player_action, slop_remover, plot_summary, plot_expander, game_intro,
 * supplemental_story_info, batch_summary (summarize_batch), craft_player_action,
 * and choose_important_memories.
 */

const { aiGenerateObject, aiGenerateText } = require('../ai.js');
const { PlayerActionSchema } = require('../schemas/player-action.js');
const {
    StoryInfoSchema,
    BatchSummarySchema,
    CraftingNarrativeSchema,
    MemorySelectionSchema,
} = require('../schemas/narrative.js');

// --- Structured handlers ---

async function playerAction({ messages, metadataLabel = 'player_action', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: PlayerActionSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

async function supplementalStoryInfo({ messages, metadataLabel = 'supplemental_story_info', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: StoryInfoSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

async function batchSummary({ messages, metadataLabel = 'summarize_batch', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: BatchSummarySchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

async function craftPlayerAction({ messages, metadataLabel = 'craft_player_action', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: CraftingNarrativeSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

async function chooseImportantMemories({ messages, metadataLabel = 'choose_important_memories', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: MemorySelectionSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

// --- Plain text handlers ---

async function slopRemover({ messages, metadataLabel = 'slop_remover', ...overrides }) {
    const { text } = await aiGenerateText({
        messages,
        metadataLabel,
        ...overrides,
    });
    return text;
}

async function plotSummary({ messages, metadataLabel = 'plot_summary', ...overrides }) {
    const { text } = await aiGenerateText({
        messages,
        metadataLabel,
        ...overrides,
    });
    return text;
}

async function plotExpander({ messages, metadataLabel = 'plot_expander', ...overrides }) {
    const { text } = await aiGenerateText({
        messages,
        metadataLabel,
        ...overrides,
    });
    return text;
}

async function gameIntro({ messages, metadataLabel = 'game_intro', ...overrides }) {
    const { text } = await aiGenerateText({
        messages,
        metadataLabel,
        ...overrides,
    });
    return text;
}

module.exports = {
    playerAction,
    slopRemover,
    plotSummary,
    plotExpander,
    gameIntro,
    supplementalStoryInfo,
    batchSummary,
    craftPlayerAction,
    chooseImportantMemories,
};
