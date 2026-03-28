const test = require('node:test');
const assert = require('node:assert/strict');

const { GameInstance } = require('../GameInstance.js');

test('creates with isolated state maps', () => {
    const g1 = new GameInstance('game-1');
    const g2 = new GameInstance('game-2');

    g1.players.set('alice', { name: 'Alice' });
    g1.things.set('sword', { name: 'Sword' });

    assert.equal(g2.players.size, 0);
    assert.equal(g2.things.size, 0);
    assert.equal(g1.players.size, 1);
});

test('creates with default game session state', () => {
    const g = new GameInstance('game-1', { maxPlayers: 4 });

    assert.equal(g.id, 'game-1');
    assert.deepEqual(g.config, { maxPlayers: 4 });
    assert.ok(g.createdAt instanceof Date);
    assert.deepEqual(g.chatHistory, []);
    assert.equal(g.currentPlayer, null);
    assert.equal(g.currentSetting, null);
    assert.equal(g.currentTurnToken, null);
    assert.equal(g.gameLoaded, false);
    assert.equal(g.inCombat, false);
    assert.equal(g.processedMove, false);
    assert.equal(g.worldTime, null);
    assert.equal(g.calendarDefinition, null);
    assert.equal(g.saveMetadata, null);
    assert.equal(g.currentSaveInfo, null);
    assert.equal(g.saveFileSaveVersion, '0');
    assert.equal(g.sceneSummaries, null);
    assert.deepEqual(g.travelHistory, []);
    assert.deepEqual(g.slopWords, []);
    assert.deepEqual(g.slopTrigrams, []);
    assert.equal(g.isProcessingJob, false);
    assert.equal(g.eventsProcessedThisTurn, false);
    assert.deepEqual(g.baseContextMemoryCache, { resolvedMemories: null, promise: null, turnsAtResolve: -1 });
    assert.equal(g.chooseImportantMemoriesInFlight, null);
});

test('creates with empty world state maps', () => {
    const g = new GameInstance('game-1');

    const worldMaps = [
        'players', 'things', 'skills', 'factions',
        'gameLocations', 'gameLocationExits', 'regions',
        'pendingRegionStubs', 'pendingLocationImages',
        'npcGenerationPromises', 'levelUpAbilityPromises',
        'playerAbilitySelectionPromises', 'stubExpansionPromises',
        'regionEntryExpansionPromises', 'generatedImages',
        'imageJobs', 'entityImageJobs',
    ];

    for (const name of worldMaps) {
        assert.ok(g[name] instanceof Map, `${name} should be a Map`);
        assert.equal(g[name].size, 0, `${name} should be empty`);
    }

    assert.ok(g.activeImageJobs instanceof Set);
    assert.equal(g.activeImageJobs.size, 0);
    assert.deepEqual(g.jobQueue, []);
});

test('mutations on one instance do not affect another', () => {
    const g1 = new GameInstance('game-1');
    const g2 = new GameInstance('game-2');

    g1.chatHistory.push({ role: 'user', content: 'hello' });
    g1.gameLoaded = true;
    g1.inCombat = true;
    g1.currentPlayer = { id: 'p1' };
    g1.worldTime = 100;
    g1.travelHistory.push('forest');
    g1.slopWords.push('very');
    g1.regions.set('north', { name: 'North' });
    g1.npcGenerationPromises.set('npc1', Promise.resolve());
    g1.activeImageJobs.add('job1');
    g1.jobQueue.push('img-job');
    g1.eventsProcessedThisTurn = true;

    assert.deepEqual(g2.chatHistory, []);
    assert.equal(g2.gameLoaded, false);
    assert.equal(g2.inCombat, false);
    assert.equal(g2.currentPlayer, null);
    assert.equal(g2.worldTime, null);
    assert.deepEqual(g2.travelHistory, []);
    assert.deepEqual(g2.slopWords, []);
    assert.equal(g2.regions.size, 0);
    assert.equal(g2.npcGenerationPromises.size, 0);
    assert.equal(g2.activeImageJobs.size, 0);
    assert.deepEqual(g2.jobQueue, []);
    assert.equal(g2.eventsProcessedThisTurn, false);
});

test('clearWorldState resets all maps and session state', () => {
    const g = new GameInstance('game-1');

    // Populate state
    g.players.set('p1', { name: 'Alice' });
    g.things.set('t1', { name: 'Sword' });
    g.skills.set('s1', { name: 'Fireball' });
    g.factions.set('f1', { name: 'Guild' });
    g.gameLocations.set('loc1', { name: 'Tavern' });
    g.gameLocationExits.set('exit1', {});
    g.regions.set('r1', { name: 'North' });
    g.pendingRegionStubs.set('stub1', {});
    g.pendingLocationImages.set('img1', {});
    g.npcGenerationPromises.set('npc1', Promise.resolve());
    g.levelUpAbilityPromises.set('la1', Promise.resolve());
    g.playerAbilitySelectionPromises.set('pas1', Promise.resolve());
    g.stubExpansionPromises.set('se1', Promise.resolve());
    g.regionEntryExpansionPromises.set('ree1', Promise.resolve());
    g.generatedImages.set('gi1', {});
    g.imageJobs.set('ij1', {});
    g.entityImageJobs.set('eij1', {});
    g.jobQueue.push('job1');
    g.activeImageJobs.add('aj1');
    g.isProcessingJob = true;
    g.chatHistory.push({ role: 'user', content: 'hi' });
    g.currentPlayer = { id: 'p1' };
    g.gameLoaded = true;
    g.inCombat = true;
    g.processedMove = true;
    g.worldTime = 500;
    g.travelHistory.push('forest');
    g.slopWords.push('very');
    g.eventsProcessedThisTurn = true;

    g.clearWorldState();

    // All Maps should be cleared
    assert.equal(g.players.size, 0);
    assert.equal(g.things.size, 0);
    assert.equal(g.skills.size, 0);
    assert.equal(g.factions.size, 0);
    assert.equal(g.gameLocations.size, 0);
    assert.equal(g.gameLocationExits.size, 0);
    assert.equal(g.regions.size, 0);
    assert.equal(g.pendingRegionStubs.size, 0);
    assert.equal(g.pendingLocationImages.size, 0);
    assert.equal(g.npcGenerationPromises.size, 0);
    assert.equal(g.levelUpAbilityPromises.size, 0);
    assert.equal(g.playerAbilitySelectionPromises.size, 0);
    assert.equal(g.stubExpansionPromises.size, 0);
    assert.equal(g.regionEntryExpansionPromises.size, 0);
    assert.equal(g.generatedImages.size, 0);
    assert.equal(g.imageJobs.size, 0);
    assert.equal(g.entityImageJobs.size, 0);
    assert.equal(g.activeImageJobs.size, 0);
    assert.deepEqual(g.jobQueue, []);
    assert.equal(g.isProcessingJob, false);

    // Session state should be reset
    assert.deepEqual(g.chatHistory, []);
    assert.equal(g.currentPlayer, null);
    assert.equal(g.gameLoaded, false);
    assert.equal(g.inCombat, false);
    assert.equal(g.processedMove, false);
    assert.equal(g.worldTime, null);
    assert.deepEqual(g.travelHistory, []);
    assert.deepEqual(g.slopWords, []);
    assert.equal(g.eventsProcessedThisTurn, false);
});

test('invalidateCaches clears all caches', () => {
    const g = new GameInstance('game-1');

    // Set all cache properties to non-null values
    g.cachedBannedNpcWords = ['badword'];
    g.cachedBannedNpcRegexes = [/bad/];
    g.cachedBannedLocationNames = new Set(['dungeon']);
    g.cachedExperiencePointValues = { kill: 10 };
    g.cachedSlopWordList = ['very', 'really'];
    g.cachedNpcNameBlockedWords = ['john'];
    g.cachedSystemPromptPrefixByPrompt = { combat: 'You are...' };
    g.cachedPointPoolFormulaRuntime = { fn: () => 0 };

    g.invalidateCaches();

    assert.equal(g.cachedBannedNpcWords, null);
    assert.equal(g.cachedBannedNpcRegexes, null);
    assert.equal(g.cachedBannedLocationNames, null);
    assert.equal(g.cachedExperiencePointValues, null);
    assert.equal(g.cachedSlopWordList, null);
    assert.equal(g.cachedNpcNameBlockedWords, null);
    assert.equal(g.cachedSystemPromptPrefixByPrompt, null);
    assert.equal(g.cachedPointPoolFormulaRuntime, null);
});
