/**
 * Schema for player_action responses.
 *
 * The LLM returns XML containing either a <finalProse> block (normal action)
 * or a <travelProse> block (travel action with structured destination/vehicle
 * metadata).  See parsePlayerActionProseFromXml in api.js.
 */

const { z } = require('zod');

// --- Travel metadata (nested inside travelProse) ---

const VehicleInfoSchema = z.object({
    name: z.string().describe('Vehicle name (e.g. "Horse", "Airship")'),
    travelTime: z.string().nullable().optional()
        .describe('How long travel takes (e.g. "2 hours")'),
    vehicleDestination: z.string().nullable().optional()
        .describe('Where the vehicle is headed, if different from the player destination'),
});

const TravelSchema = z.object({
    vehicle: z.string().nullable().describe('Vehicle name, or null if on foot'),
    vehicleTravelTime: z.string().nullable().describe('Travel duration string, or null'),
    vehicleDestination: z.string().nullable().describe('Vehicle-specific destination, or null'),
    playerDestination: z.string().nullable().describe('Name of the destination the player is heading to'),
    originProse: z.string().nullable().describe('Narrative prose for leaving the origin'),
    betweenProse: z.string().nullable().describe('Narrative prose for the journey between locations'),
    destinationProse: z.string().nullable().describe('Narrative prose for arriving at the destination'),
});

// --- Main player action response ---

const PlayerActionSchema = z.object({
    prose: z.string().describe('The narrative prose text returned by the LLM'),
    travel: TravelSchema.nullable()
        .describe('Travel metadata when the action involves movement, null otherwise'),
});

module.exports = {
    VehicleInfoSchema,
    TravelSchema,
    PlayerActionSchema,
};
