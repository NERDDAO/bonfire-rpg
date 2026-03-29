/**
 * Schemas for skill_generation and skill_generation_by_name responses.
 *
 * Parsed by parseSkillsXml in server.js.  Each <skill> element contains
 * name, description, and attribute fields.
 */

const { z } = require('zod');

// --- Single skill ---

const SkillSchema = z.object({
    name: z.string().describe('Skill name'),
    description: z.string().describe('What the skill does'),
    attribute: z.string().describe('Governing attribute name (e.g. "strength", "intelligence")'),
});

// --- Array of skills (the typical return shape) ---

const SkillArraySchema = z.array(SkillSchema)
    .describe('List of generated skills');

module.exports = {
    SkillSchema,
    SkillArraySchema,
};
