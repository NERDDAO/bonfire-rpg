/**
 * AI SDK setup — OpenRouter provider, model resolution, generateObject wrapper.
 *
 * Replaces direct LLMClient.chatCompletion() calls for structured output.
 * Uses Vercel AI SDK with @openrouter/ai-sdk-provider for native Zod schema support.
 */

const { generateObject, generateText } = require('ai');
const { createOpenRouter } = require('@openrouter/ai-sdk-provider');
const Globals = require('./Globals.js');
const LLMClient = require('./LLMClient.js');

/**
 * Build an OpenRouter provider instance from current config.
 * Called per-request so config changes (model overrides) are respected.
 */
function createProvider(apiKey) {
    const key = apiKey || Globals.config?.ai?.apiKey;
    if (!key) {
        throw new Error('ai.apiKey is not configured');
    }
    return createOpenRouter({ apiKey: key });
}

/**
 * Resolve model ID for a given metadataLabel, respecting ai_model_overrides.
 * Returns { model, temperature, maxTokens } with overrides applied.
 */
function resolveModelConfig(metadataLabel) {
    const aiConfig = Globals.config?.ai;
    if (!aiConfig) {
        throw new Error('Globals.config.ai is not configured');
    }

    const base = {
        model: aiConfig.model,
        temperature: aiConfig.temperature ?? 0.8,
        maxTokens: aiConfig.maxTokens ?? 2000,
        apiKey: aiConfig.apiKey,
    };

    if (!metadataLabel) return base;

    // Use LLMClient's override resolution if available
    const overrides = Globals.config?.ai_model_overrides;
    if (!overrides || typeof overrides !== 'object') return base;

    const normalizedLabel = metadataLabel.replace(/[\s-]+/g, '_').toLowerCase();

    for (const [, profileConfig] of Object.entries(overrides)) {
        if (!profileConfig?.prompts) continue;
        const matches = profileConfig.prompts.some(
            p => p.replace(/[\s-]+/g, '_').toLowerCase() === normalizedLabel
        );
        if (!matches) continue;

        if (profileConfig.model) base.model = profileConfig.model;
        if (profileConfig.temperature !== undefined) base.temperature = profileConfig.temperature;
        if (profileConfig.maxTokens !== undefined) base.maxTokens = profileConfig.maxTokens;
        if (profileConfig.apiKey) base.apiKey = profileConfig.apiKey;
    }

    return base;
}

/**
 * Generate a structured object from an AI prompt using a Zod schema.
 *
 * @param {object} options
 * @param {import('zod').ZodType} options.schema - Zod schema for the response
 * @param {string} options.prompt - System/user prompt text (used as user message)
 * @param {Array} [options.messages] - Full message array (overrides prompt)
 * @param {string} [options.system] - System message
 * @param {string} [options.metadataLabel] - For model override resolution and logging
 * @param {number} [options.temperature] - Override temperature
 * @param {number} [options.maxTokens] - Override maxTokens
 * @param {string} [options.model] - Override model directly
 * @param {'json'|'tool'|'auto'} [options.mode] - Schema enforcement mode (default: 'json')
 * @returns {Promise<{object: T, usage: object}>}
 */
async function aiGenerateObject({
    schema,
    prompt,
    messages,
    system,
    metadataLabel = '',
    temperature,
    maxTokens,
    model: modelOverride,
    mode = 'json',
}) {
    const config = resolveModelConfig(metadataLabel);
    const provider = createProvider(config.apiKey);
    const modelId = modelOverride || config.model;

    const result = await generateObject({
        model: provider(modelId),
        schema,
        mode,
        ...(messages ? { messages } : { prompt }),
        ...(system && { system }),
        temperature: temperature ?? config.temperature,
        maxTokens: maxTokens ?? config.maxTokens,
    });

    return result;
}

/**
 * Generate plain text from an AI prompt (for responses that are just prose).
 *
 * @param {object} options
 * @param {string} options.prompt - User prompt text
 * @param {Array} [options.messages] - Full message array (overrides prompt)
 * @param {string} [options.system] - System message
 * @param {string} [options.metadataLabel] - For model override resolution
 * @param {number} [options.temperature] - Override temperature
 * @param {number} [options.maxTokens] - Override maxTokens
 * @param {string} [options.model] - Override model directly
 * @returns {Promise<{text: string, usage: object}>}
 */
async function aiGenerateText({
    prompt,
    messages,
    system,
    metadataLabel = '',
    temperature,
    maxTokens,
    model: modelOverride,
}) {
    const config = resolveModelConfig(metadataLabel);
    const provider = createProvider(config.apiKey);
    const modelId = modelOverride || config.model;

    const result = await generateText({
        model: provider(modelId),
        ...(messages ? { messages } : { prompt }),
        ...(system && { system }),
        temperature: temperature ?? config.temperature,
        maxTokens: maxTokens ?? config.maxTokens,
    });

    return result;
}

module.exports = {
    createProvider,
    resolveModelConfig,
    aiGenerateObject,
    aiGenerateText,
};
