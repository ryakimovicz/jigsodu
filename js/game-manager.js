import { getDailySeed } from "./utils/random.js";
import { generateDailyGame } from "./sudoku-logic.js";
import { generateSearchSequences } from "./search-gen.js";
import { CONFIG } from "./config.js";

export class GameManager {
  constructor() {
    this.currentSeed = getDailySeed();
    this.storageKey = `jigsudo_state_${this.currentSeed}`;
    this.state = null;

    this.init();
  }

  init() {
    // 1. Check LocalStorage
    const savedState = localStorage.getItem(this.storageKey);

    if (savedState) {
      if (CONFIG.debugMode) {
        console.log(
          `[GameManager] Loading existing game for seed ${this.currentSeed}`,
        );
      }
      this.state = JSON.parse(savedState);
    } else {
      if (CONFIG.debugMode) {
        console.log(
          `[GameManager] Generating NEW game for seed ${this.currentSeed}`,
        );
      }
      this.state = this.createNewState();
      this.save();
    }

    // Debug
    if (CONFIG.debugMode) {
      console.log("Game Initialized:", this.state);
    }
  }

  createNewState() {
    // Generate the Sudoku data
    const gameData = generateDailyGame(this.currentSeed);

    return {
      meta: {
        seed: this.currentSeed,
        startedAt: new Date().toISOString(),
        lastPlayed: new Date().toISOString(),
      },
      progress: {
        currentStage: "memory", // memory, jigsaw, sudoku, peaks, search
        stagesCompleted: [],
      },
      data: {
        solution: gameData.solution,
        initialPuzzle: gameData.puzzle, // The one with holes
        chunks: gameData.chunks, // The 9 solved 3x3 grids (prizes)
      },
      memory: {
        pairsFound: 0,
        // We will populate this when Memory initializes
        cards: [],
      },
      jigsaw: {
        placedChunks: [], // indices of placed chunks (0-8)
      },
      sudoku: {
        currentBoard: gameData.puzzle, // Will be modified by user
      },
      search: {
        targets: [], // Generated lazily or now
        found: [],
      },
    };
  }

  save() {
    this.state.meta.lastPlayed = new Date().toISOString();
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  getState() {
    return this.state;
  }

  advanceStage() {
    const stages = ["memory", "jigsaw", "sudoku", "peaks", "search"];
    const currentIdx = stages.indexOf(this.state.progress.currentStage);

    if (currentIdx >= 0 && currentIdx < stages.length - 1) {
      const nextStage = stages[currentIdx + 1];
      const currentStage = this.state.progress.currentStage;

      console.log(`[GameManager] Advancing: ${currentStage} -> ${nextStage}`);

      // Update State
      this.state.progress.currentStage = nextStage;
      if (!this.state.progress.stagesCompleted.includes(currentStage)) {
        this.state.progress.stagesCompleted.push(currentStage);
      }
      this.save();

      // Dispatch Event
      window.dispatchEvent(
        new CustomEvent("stageChanged", { detail: { stage: nextStage } }),
      );
    }
  }

  updateProgress(stage, data) {
    // Generic updater
    if (data) {
      this.state[stage] = { ...this.state[stage], ...data };
    }
    this.save();
  }

  ensureSearchGenerated() {
    // Force Generation or Validation
    let shouldRegenerate = false;

    if (
      !this.state.search ||
      !this.state.search.targets ||
      this.state.search.targets.length === 0
    ) {
      shouldRegenerate = true;
    } else {
      // Validate Existing Targets
      const targets = this.state.search.targets;
      const seenCells = new Set(); // Check for overlaps globaly

      for (const target of targets) {
        if (!target.path || target.path.length < 2) {
          shouldRegenerate = true;
          break;
        }

        // Check each cell
        for (let i = 0; i < target.path.length; i++) {
          const cell = target.path[i];
          const key = `${cell.r},${cell.c}`;

          // 1. Check Duplicates/Overlaps
          if (seenCells.has(key)) {
            console.warn(
              `[GameManager] OVERLAP DETECTED at ${key} - Regenerating`,
            );
            shouldRegenerate = true;
            break;
          }
          seenCells.add(key);

          // 2. Check Orthogonality
          if (i < target.path.length - 1) {
            const next = target.path[i + 1];
            const dist = Math.abs(cell.r - next.r) + Math.abs(cell.c - next.c);
            if (dist !== 1) {
              console.warn(
                `[GameManager] DIAGONAL DETECTED at ${key}->${next.r},${next.c} - Regenerating`,
              );
              shouldRegenerate = true;
              break;
            }
          }
        }
        if (shouldRegenerate) break;
      }
    }

    if (shouldRegenerate) {
      console.log("[GameManager] Generating Search Sequences...");
      const sequences = generateSearchSequences(
        this.state.data.solution,
        this.currentSeed,
      );

      this.state.search = {
        targets: sequences,
        found: [], // array of sequence IDs
      };
      this.save();
    }
  }
}

// Singleton instance
export const gameManager = new GameManager();
