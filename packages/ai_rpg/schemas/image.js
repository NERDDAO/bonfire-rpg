/**
 * Schema for image_prompt_generation responses.
 *
 * The LLM returns a plain text image prompt string.
 * generateImagePromptFromTemplate in server.js cleans it and optionally
 * prepends a type-specific prefix.  The returned object includes the
 * prompt and the generation duration.
 */

const { z } = require('zod');

// --- Image prompt generation result ---

const ImagePromptSchema = z.object({
    prompt: z.string().describe('Generated image prompt text (cleaned and prefix-applied)'),
    durationSeconds: z.number().nullable()
        .describe('Time in seconds the LLM took to generate the prompt, or null on fallback'),
});

module.exports = {
    ImagePromptSchema,
};
