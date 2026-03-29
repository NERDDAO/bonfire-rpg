# GameKG CRUD Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan.

**Goal:** Persist generated game objects (NPCs, locations, items, factions) as KG entities with structural edges, using batch flush at turn end.

**Architecture:** GameKG class in bonfires-gm mod collects entity/edge operations during gameplay, flushes in batch after each turn. Session kEngram tracks what was created. Append-only — death/destruction are status edges, never deletions.

**Tech Stack:** Node.js, Bonfires SDK, node:test

**Spec:** `docs/superpowers/specs/2026-03-29-game-kg-crud-design.md`

---

### Task 1: Create GameKG class with tracking + flush

### Task 2: Add tests

### Task 3: Wire into bonfires-gm mod

### Task 4: Add updateEntity to SDK

### Task 5: Verify end-to-end
