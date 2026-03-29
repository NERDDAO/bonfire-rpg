/**
 * Quest handlers — structured output replacements for inline XML parsing.
 *
 * Covers: quest_generate (Events._parseQuestXml), quest_check
 * (Events.parseQuestObjectiveStatusXml), and quest_reward_prose (plain text).
 */

const { aiGenerateObject, aiGenerateText } = require('../ai.js');
const { QuestSchema, QuestCheckSchema } = require('../schemas/quest.js');

async function questGenerate({ messages, metadataLabel = 'quest_generate', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: QuestSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

async function questCheck({ messages, metadataLabel = 'quest_check', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: QuestCheckSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

async function questRewardProse({ messages, metadataLabel = 'quest_reward_prose', ...overrides }) {
    const { text } = await aiGenerateText({
        messages,
        metadataLabel,
        ...overrides,
    });
    return text;
}

module.exports = {
    questGenerate,
    questCheck,
    questRewardProse,
};
