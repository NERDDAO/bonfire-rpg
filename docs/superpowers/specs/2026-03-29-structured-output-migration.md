# Structured Output Migration — Replace LLMClient with Vercel AI SDK

## Context

Memento Mori has 73 LLMClient.chatCompletion() call sites across server.js (37), api.js (29), Events.js (6), and others. All use XML regex/DOM parsing with ~50+ instances of `getElementsByTagName` + `textContent.trim()`. This is brittle, error-prone, and wastes tokens on XML formatting.

We're replacing LLMClient with the Vercel AI SDK (`ai` + `@openrouter/ai-sdk-provider`). Each prompt type gets a Zod schema. `generateObject()` handles structured output natively — Zod in, typed object out.

**This also breaks the 25k-line server.js monolith into manageable files** by extracting prompt-specific logic into schema + handler modules.

## Architecture

```
BEFORE:
  server.js (25k) → LLMClient.chatCompletion() → XML string → DOM parse → manual extraction

AFTER:
  server.js → handlers/location.js → generateObject({ schema: LocationSchema }) → typed object
                                   ↘ schemas/location.js (Zod)
```

## File Structure (NEW)

```
packages/ai_rpg/
├── ai.js                    — AI SDK setup (OpenRouter provider, model config)
├── schemas/                 — Zod schemas for ALL prompt response types
│   ├── shared.js            — Reusable sub-schemas (personality, attributes, statusEffect)
│   ├── simple.js            — Yes/No, plausibility, attack precheck
│   ├── npc.js               — NPC generation, alteration, progression, abilities
│   ├── location.js          — Location generation, stubs, name regen
│   ├── thing.js             — Item/scenery generation, inventory, alteration
│   ├── region.js            — Region generation, stubs, secrets, entrances
│   ├── faction.js           — Faction generation, relationships, reputation
│   ├── quest.js             — Quest generation, check, rewards
│   ├── skill.js             — Skill generation
│   ├── player-action.js     — Player action prose, travel, combat
│   ├── event.js             — Event checks, random events
│   ├── narrative.js         — Game intro, plot summary, scene summary, slop
│   ├── calendar.js          — Calendar generation
│   └── image.js             — Image prompt generation
├── handlers/                — Prompt execution functions (replace inline XML parsing)
│   ├── npc.js               — generateNPC(), alterNPC(), assignAbilities()
│   ├── location.js          — generateLocation(), generateLocationNpcs()
│   ├── thing.js             — generateThing(), parseInventory()
│   ├── region.js            — generateRegion(), generateRegionStubs()
│   ├── faction.js           — generateFaction(), generateRelationships()
│   ├── quest.js             — generateQuest(), checkQuest()
│   ├── combat.js            — attackPrecheck(), attackCheck(), plausibility()
│   ├── narrative.js         — playerAction(), gameIntro(), sceneSummary()
│   └── event.js             — eventChecks(), randomEvent()
```

## Key Files Modified

| File | What changes |
|------|-------------|
| `LLMClient.js` | Kept for streaming/semaphore/logging BUT internal calls replaced with AI SDK |
| `server.js` | Extract ~37 inline XML parsing blocks → import from handlers/ |
| `api.js` | Extract ~29 inline XML parsing blocks → import from handlers/ |
| `Events.js` | Extract ~6 inline XML parsing blocks → import from handlers/ |
| `prompts/*.njk` | Update output format instructions (XML → JSON) |

## Shared Sub-Schemas (schemas/shared.js)

These are reused across many prompt types:

```javascript
const PersonalitySchema = z.object({
  type: z.string(),
  traits: z.array(z.string()),
  notes: z.string().optional(),
  goals: z.array(z.string()).optional(),
});

const AttributeSchema = z.object({
  name: z.string(),
  value: z.number(),
});

const StatusEffectSchema = z.object({
  name: z.string().optional(),
  description: z.string(),
  duration: z.string().optional(),
  attributes: z.array(AttributeSchema).optional(),
});

const SkillCheckSchema = z.object({
  skill: z.string(),
  attribute: z.string(),
  difficulty: z.string(),
  opposedCheck: z.object({ ... }).optional(),
  circumstanceModifiers: z.array(z.string()).optional(),
});
```

## Implementation Phases (Parallel Subagent Tasks)

### Phase A: Foundation (1 task)
- Create `ai.js` — OpenRouter provider setup, model config from config.yaml
- Create `schemas/shared.js` — reusable sub-schemas
- Test: `generateObject()` works with OpenRouter + Zod schema

### Phase B: Define All Schemas (3 parallel tasks)
- **B1**: `schemas/simple.js` + `schemas/npc.js` + `schemas/thing.js`
- **B2**: `schemas/location.js` + `schemas/region.js` + `schemas/faction.js`
- **B3**: `schemas/player-action.js` + `schemas/event.js` + `schemas/quest.js` + `schemas/narrative.js` + `schemas/skill.js` + `schemas/calendar.js` + `schemas/image.js`

### Phase C: Create Handlers (3 parallel tasks)
- **C1**: `handlers/combat.js` + `handlers/npc.js` — simple responses + NPC gen
- **C2**: `handlers/location.js` + `handlers/thing.js` + `handlers/region.js` — world gen
- **C3**: `handlers/narrative.js` + `handlers/event.js` + `handlers/quest.js` + `handlers/faction.js` — gameplay

### Phase D: Wire Into Callers (3 parallel tasks)
- **D1**: server.js world generation calls (location, region, NPC, thing, skill, faction gen)
- **D2**: api.js gameplay calls (player_action, combat, crafting, narrative, summary)
- **D3**: Events.js + remaining (event_checks, quest_check, alter_npc, alter_location)

### Phase E: Update Prompts (2 parallel tasks)
- **E1**: World generation prompt templates (location, region, NPC, thing, skill, faction)
- **E2**: Gameplay prompt templates (player_action, event, quest, combat, narrative)

### Phase F: Cleanup (1 task)
- Remove unused XML parsing functions from Utils.js, server.js, api.js
- Remove validateXML, requiredRegex, requiredTags from LLMClient
- Run full test suite

## Call Site Mapping (73 total)

### server.js (37 calls → handlers/)
| metadataLabel | Handler | Schema |
|---|---|---|
| choose_important_memories | narrative.js | MemorySelectionSchema |
| plausibility_check | combat.js | PlausibilitySchema |
| region_stub_locations | region.js | RegionStubSchema |
| inventory_generation | thing.js | ThingArraySchema |
| thing_generation | thing.js | ThingArraySchema |
| alter_thing | thing.js | ThingSchema |
| short_description | thing.js | ShortDescriptionSchema |
| npc_generation_single | npc.js | NPCSchema |
| equip_best | combat.js | EquipBestSchema |
| npc_progression_assignments | npc.js | SkillAssignmentSchema |
| npc_ability_assignments | npc.js | AbilityAssignmentSchema |
| npc_alias_assignments | npc.js | AliasAssignmentSchema |
| npc_name_regen | npc.js | NameRegenSchema |
| location_things_generation | thing.js | ThingArraySchema |
| thing_name_regen | thing.js | NameRegenSchema |
| location_name_regen | location.js | NameRegenSchema |
| region_name_regen | region.js | NameRegenSchema |
| skill_generation | handlers kept inline | SkillArraySchema |
| faction_generation + variants | faction.js | FactionSchema |
| skill_generation_by_name | handlers kept inline | SkillSchema |
| location_npc_generation | npc.js | NPCArraySchema |
| region_npc_generation | npc.js | NPCArraySchema |
| image_prompt_generation | handlers kept inline | ImagePromptSchema |
| location_generation | location.js | LocationSchema |
| existing_region_exit | region.js | RegionExitSchema |
| region_entrance_selection | region.js | EntranceSelectionSchema |
| region_generation | region.js | RegionSchema |
| calendar_generation | handlers kept inline | CalendarSchema |
| status_effect_generate | handlers kept inline | StatusEffectSchema |

### api.js (29 calls → handlers/)
| metadataLabel | Handler | Schema |
|---|---|---|
| slop_remover | narrative.js | z.string() (plain text) |
| xml_fix | REMOVED (no more XML) |
| player_action | narrative.js | PlayerActionSchema |
| plot_summary | narrative.js | z.string() |
| plot_expander | narrative.js | z.string() |
| supplemental_story_info | narrative.js | StoryInfoSchema |
| game_intro | narrative.js | z.string() |
| attack_check | combat.js | AttackCheckSchema |
| attack_precheck | combat.js | SimpleYesNoSchema |
| npc_plausibility | combat.js | PlausibilitySchema |
| disposition_check | combat.js | DispositionSchema |
| craft_plausibility | combat.js | PlausibilitySchema |
| craft_player_action | narrative.js | CraftingNarrativeSchema |
| faction_autofill | faction.js | FactionSchema |
| calendar_generation | handlers kept inline | CalendarSchema |
| batch_summary | narrative.js | BatchSummarySchema |
| random_event | event.js | RandomEventSchema |

### Events.js (6 calls → handlers/)
| metadataLabel | Handler | Schema |
|---|---|---|
| quest_check | quest.js | z.string() |
| event_checks | event.js | EventChecksSchema |
| quest_reward_prose | quest.js | z.string() |
| alter_location | location.js | LocationAlterSchema |
| quest_generate | quest.js | QuestSchema |
| alter_npc | npc.js | NPCAlterSchema |

## Verification

1. `npm test` — all existing tests pass
2. Create new game — world generation uses generateObject()
3. Play through: travel, combat, NPC interaction, quest
4. Check logs — no XML parsing errors, no missingRegex
5. Compare token usage before/after (JSON should be ~30% fewer tokens)
6. GitNexus detect_changes — verify only expected files affected
