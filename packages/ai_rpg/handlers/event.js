/**
 * Event handlers — structured output replacements for inline XML parsing.
 *
 * Covers: event_checks (Events._extractFinalEventBlock + _extractNumberedResponses)
 * and random_event (parseRandomEventResponse).
 */

const { aiGenerateObject } = require('../ai.js');
const { EventChecksSchema, RandomEventSchema } = require('../schemas/event.js');

async function eventChecks({ messages, metadataLabel = 'event_checks', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: EventChecksSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

async function randomEvent({ messages, metadataLabel = 'random_event', ...overrides }) {
    const { object } = await aiGenerateObject({
        schema: RandomEventSchema,
        messages,
        metadataLabel,
        ...overrides,
    });
    return object;
}

module.exports = {
    eventChecks,
    randomEvent,
};
