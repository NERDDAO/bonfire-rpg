/**
 * Schemas for event_checks and random_event responses.
 *
 * event_checks: The LLM answers numbered questions inside a <final> block.
 *   Each answer is a free-text string keyed by question number.
 *   See Events._extractFinalEventBlock / _extractNumberedResponses.
 *
 * random_event: Parsed by parseRandomEventResponse in api.js — returns
 *   eventText (narrative) and isAttack (boolean).
 */

const { z } = require('zod');

// --- Event checks ---
// The raw response is a numbered list of answers inside a <final> block.
// After extraction, each answer is mapped to the EVENT_PROMPT_ORDER_FLAT
// question definitions by position (1-indexed).

const EventCheckAnswerSchema = z.object({
    questionIndex: z.number().int().describe('1-based question index from EVENT_PROMPT_ORDER_FLAT'),
    key: z.string().describe('Event key from the prompt definition (e.g. "move_location", "currency")'),
    answer: z.string().describe('Free-text answer from the LLM'),
});

const EventChecksSchema = z.object({
    answers: z.array(EventCheckAnswerSchema)
        .describe('Ordered list of LLM answers to event check questions'),
});

// --- Random event ---

const RandomEventSchema = z.object({
    eventText: z.string().describe('Generated narrative text for the random event'),
    isAttack: z.boolean().describe('Whether the random event involves an attack'),
});

module.exports = {
    EventCheckAnswerSchema,
    EventChecksSchema,
    RandomEventSchema,
};
