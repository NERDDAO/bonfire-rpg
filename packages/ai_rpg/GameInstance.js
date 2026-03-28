'use strict';

class GameInstance {
    constructor(id, options = {}) {
        this.id = id;
        this.createdAt = new Date();
        this.config = options;

        // Game session state
        this.chatHistory = [];
        this.currentPlayer = null;
        this.currentSetting = null;
        this.currentTurnToken = null;
        this.gameLoaded = false;
        this.inCombat = false;
        this.processedMove = false;

        // World time
        this.worldTime = null;
        this.calendarDefinition = null;

        // Save state
        this.saveMetadata = null;
        this.currentSaveInfo = null;
        this.saveFileSaveVersion = '0';
        this.sceneSummaries = null;

        // Travel
        this.travelHistory = [];

        // Slop
        this.slopWords = [];
        this.slopTrigrams = [];

        // World data Maps
        this.players = new Map();
        this.things = new Map();
        this.skills = new Map();
        this.factions = new Map();
        this.gameLocations = new Map();
        this.gameLocationExits = new Map();
        this.regions = new Map();
        this.pendingRegionStubs = new Map();
        this.pendingLocationImages = new Map();

        // Promise tracking Maps
        this.npcGenerationPromises = new Map();
        this.levelUpAbilityPromises = new Map();
        this.playerAbilitySelectionPromises = new Map();
        this.stubExpansionPromises = new Map();
        this.regionEntryExpansionPromises = new Map();

        // Image processing
        this.generatedImages = new Map();
        this.imageJobs = new Map();
        this.jobQueue = [];
        this.activeImageJobs = new Set();
        this.isProcessingJob = false;
        this.entityImageJobs = new Map();

        // Memory cache
        this.baseContextMemoryCache = { resolvedMemories: null, promise: null, turnsAtResolve: -1 };
        this.chooseImportantMemoriesInFlight = null;

        // API state
        this.eventsProcessedThisTurn = false;

        // Caches
        this.cachedBannedNpcWords = null;
        this.cachedBannedNpcRegexes = null;
        this.cachedBannedLocationNames = null;
        this.cachedExperiencePointValues = null;
        this.cachedSlopWordList = null;
        this.cachedNpcNameBlockedWords = null;
        this.cachedSystemPromptPrefixByPrompt = null;
        this.cachedPointPoolFormulaRuntime = null;
    }

    clearWorldState() {
        // Clear all world data Maps
        this.players.clear();
        this.things.clear();
        this.skills.clear();
        this.factions.clear();
        this.gameLocations.clear();
        this.gameLocationExits.clear();
        this.regions.clear();
        this.pendingRegionStubs.clear();
        this.pendingLocationImages.clear();

        // Clear promise tracking Maps
        this.npcGenerationPromises.clear();
        this.levelUpAbilityPromises.clear();
        this.playerAbilitySelectionPromises.clear();
        this.stubExpansionPromises.clear();
        this.regionEntryExpansionPromises.clear();

        // Clear image processing
        this.generatedImages.clear();
        this.imageJobs.clear();
        this.jobQueue = [];
        this.activeImageJobs.clear();
        this.isProcessingJob = false;
        this.entityImageJobs.clear();

        // Reset session state
        this.chatHistory = [];
        this.currentPlayer = null;
        this.currentSetting = null;
        this.currentTurnToken = null;
        this.gameLoaded = false;
        this.inCombat = false;
        this.processedMove = false;
        this.worldTime = null;
        this.calendarDefinition = null;
        this.saveMetadata = null;
        this.currentSaveInfo = null;
        this.saveFileSaveVersion = '0';
        this.sceneSummaries = null;
        this.travelHistory = [];
        this.slopWords = [];
        this.slopTrigrams = [];
        this.baseContextMemoryCache = { resolvedMemories: null, promise: null, turnsAtResolve: -1 };
        this.chooseImportantMemoriesInFlight = null;
        this.eventsProcessedThisTurn = false;
    }

    invalidateCaches() {
        this.cachedBannedNpcWords = null;
        this.cachedBannedNpcRegexes = null;
        this.cachedBannedLocationNames = null;
        this.cachedExperiencePointValues = null;
        this.cachedSlopWordList = null;
        this.cachedNpcNameBlockedWords = null;
        this.cachedSystemPromptPrefixByPrompt = null;
        this.cachedPointPoolFormulaRuntime = null;
    }
}

module.exports = { GameInstance };
