const Utils = require('./Utils.js');
const LLMClient = require('./LLMClient.js');
const { aiGenerateObject } = require('./ai.js');
const { StatusEffectGenerationSchema } = require('./schemas/shared.js');

class StatusEffect {
    constructor({ name, description, attributes, skills, needBars, duration, appliedAt } = {}) {
        if (!description || typeof description !== 'string') {
            throw new Error('StatusEffect description must be a non-empty string');
        }

        this.name = typeof name === 'string' ? name.trim() : '';
        this.description = description.trim();
        this.attributes = this.#normalizeModifiers(attributes, 'attribute');
        this.skills = this.#normalizeModifiers(skills, 'skill');
        this.needBars = this.#normalizeNeedBars(needBars);
        this.duration = this.#normalizeDuration(duration);
        this.appliedAt = this.#normalizeAppliedAt(appliedAt);
    }

    #normalizeModifiers(list, keyName) {
        if (!list) {
            return [];
        }
        if (!Array.isArray(list)) {
            throw new Error(`StatusEffect ${keyName} modifiers must be an array if provided`);
        }

        return list.map((entry) => {
            if (!entry || typeof entry !== 'object') {
                throw new Error(`StatusEffect ${keyName} modifier entries must be objects`);
            }
            const key = typeof entry[keyName] === 'string' ? entry[keyName].trim() : '';
            if (!key) {
                throw new Error(`StatusEffect ${keyName} modifier is missing a ${keyName} name`);
            }
            const modifier = Number(entry.modifier);
            if (!Number.isFinite(modifier)) {
                throw new Error(`StatusEffect ${keyName} modifier must include a numeric modifier value`);
            }
            return {
                [keyName]: key,
                modifier
            };
        });
    }

    #normalizeNeedBars(list) {
        if (list === undefined || list === null) {
            return [];
        }
        if (!Array.isArray(list)) {
            throw new Error('StatusEffect need bar modifiers must be an array if provided');
        }

        return list.map(entry => {
            if (!entry || typeof entry !== 'object') {
                throw new Error('StatusEffect need bar modifier entries must be objects');
            }
            const name = typeof entry.name === 'string' ? entry.name.trim() : '';
            if (!name) {
                throw new Error('StatusEffect need bar modifier is missing a name');
            }
            const delta = Number(entry.delta);
            if (!Number.isFinite(delta)) {
                throw new Error(`StatusEffect need bar "${name}" has invalid delta`);
            }
            return { name, delta };
        });
    }

    static normalizeDuration(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
                return null;
            }
            if (/^-?\d+$/.test(trimmed)) {
                const parsed = Number.parseInt(trimmed, 10);
                if (!Number.isFinite(parsed)) {
                    throw new Error(`StatusEffect duration "${value}" is invalid`);
                }
                return parsed < 0 ? -1 : parsed;
            }
            const lower = trimmed.toLowerCase();
            if (lower === 'instant') {
                return 1;
            }
            if (lower === 'permanent' || lower === 'continuous') {
                return -1;
            }
            if (lower === 'n/a' || lower === 'na' || lower === 'none') {
                return null;
            }
            return Utils.parseDurationToMinutes(trimmed, { fieldName: 'StatusEffect duration' });
        }

        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            throw new Error(`StatusEffect duration "${value}" is invalid`);
        }
        if (numeric < 0) {
            return -1;
        }
        if (!Number.isInteger(numeric)) {
            throw new Error(`StatusEffect duration "${value}" is invalid`);
        }
        return numeric;
    }

    #normalizeAppliedAt(value) {
        if (value === null || value === undefined) {
            return null;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0) {
            throw new Error(`StatusEffect appliedAt "${value}" is invalid`);
        }
        return numeric;
    }

    #normalizeDuration(value) {
        return StatusEffect.normalizeDuration(value);
    }

    update({ name, description, attributes, skills, needBars, duration, appliedAt } = {}) {
        if (typeof name === 'string' && name.trim()) {
            this.name = name.trim();
        }
        if (typeof description === 'string' && description.trim()) {
            this.description = description.trim();
        }
        if (attributes !== undefined) {
            this.attributes = this.#normalizeModifiers(attributes, 'attribute');
        }
        if (skills !== undefined) {
            this.skills = this.#normalizeModifiers(skills, 'skill');
        }
        if (needBars !== undefined) {
            this.needBars = this.#normalizeNeedBars(needBars);
        }
        if (duration !== undefined) {
            this.duration = this.#normalizeDuration(duration);
        }
        if (appliedAt !== undefined) {
            this.appliedAt = this.#normalizeAppliedAt(appliedAt);
        }
        return this;
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            attributes: this.attributes,
            skills: this.skills,
            needBars: this.needBars,
            duration: this.duration,
            appliedAt: this.appliedAt
        };
    }

    static fromJSON(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data provided to StatusEffect.fromJSON');
        }
        return new StatusEffect({
            name: data.name,
            description: data.description,
            attributes: data.attributes,
            skills: data.skills,
            needBars: data.needBars,
            duration: data.duration,
            appliedAt: data.appliedAt
        });
    }

    static async generateFromDescriptions(descriptions, {
        promptEnv,
        parseXMLTemplate,
        prepareBasePromptContext
    } = {}) {
        if (!Array.isArray(descriptions) || !descriptions.length) {
            throw new Error('generateFromDescriptions requires a non-empty array of descriptions');
        }
        const seeds = descriptions.map((entry, index) => {
            if (typeof entry === 'string') {
                const trimmed = entry.trim();
                if (!trimmed) {
                    throw new Error(`Status effect description at index ${index} is empty`);
                }
                return { description: trimmed, name: null, level: null };
            }
            if (entry && typeof entry === 'object') {
                const description = typeof entry.description === 'string' ? entry.description.trim() : '';
                const name = typeof entry.name === 'string' ? entry.name.trim() : null;
                const level = Number.isFinite(entry.level) ? entry.level : null;
                if (!description) {
                    throw new Error(`Status effect description at index ${index} is empty`);
                }
                return { description, name: name || null, level };
            }
            throw new Error(`Status effect description at index ${index} is not valid`);
        });

        if (!promptEnv || typeof promptEnv.render !== 'function') {
            throw new Error('generateFromDescriptions requires a promptEnv with a render function');
        }
        if (typeof parseXMLTemplate !== 'function') {
            throw new Error('generateFromDescriptions requires a parseXMLTemplate function');
        }
        if (typeof prepareBasePromptContext !== 'function') {
            throw new Error('generateFromDescriptions requires a prepareBasePromptContext function');
        }

        const baseContext = await prepareBasePromptContext({});
        const renderedTemplate = promptEnv.render('base-context.xml.njk', {
            ...baseContext,
            promptType: 'status-effect-generate',
            statusEffectSeeds: seeds
        });
        const parsedTemplate = parseXMLTemplate(renderedTemplate);
        if (!parsedTemplate?.systemPrompt || !parsedTemplate?.generationPrompt) {
            throw new Error('Status effect prompt template did not include required prompts');
        }

        const messages = [
            { role: 'system', content: parsedTemplate.systemPrompt.trim() },
            { role: 'user', content: parsedTemplate.generationPrompt.trim() }
        ];

        const { object } = await aiGenerateObject({
            schema: StatusEffectGenerationSchema,
            messages,
            metadataLabel: 'status_effect_generate',
        });

        if (!Array.isArray(object.effects) || !object.effects.length) {
            throw new Error('Status effect generation returned no effects');
        }

        const results = new Map();
        for (const effect of object.effects) {
            const sourceDescription = effect.sourceDescription?.trim();
            if (!sourceDescription) {
                throw new Error('Generated status effect is missing sourceDescription');
            }
            if (results.has(sourceDescription)) {
                throw new Error(`Duplicate status effect generated for "${sourceDescription}"`);
            }

            const description = effect.description?.trim();
            if (!description) {
                throw new Error(`Generated status effect for "${sourceDescription}" is missing description`);
            }

            const name = effect.name?.trim() || null;
            const duration = effect.duration?.trim() || null;

            // Filter out zero-value modifiers
            const attributes = (effect.attributes || [])
                .filter(a => a.attribute && Number.isFinite(a.modifier) && a.modifier !== 0);
            const skills = (effect.skills || [])
                .filter(s => s.skill && Number.isFinite(s.modifier) && s.modifier !== 0);
            const needBars = (effect.needBars || [])
                .filter(n => n.name && Number.isFinite(n.delta) && n.delta !== 0);

            results.set(sourceDescription, new StatusEffect({
                name,
                description,
                duration,
                attributes,
                skills,
                needBars
            }));
        }

        return results;
    }
}

module.exports = StatusEffect;
