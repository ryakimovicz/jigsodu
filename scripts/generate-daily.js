import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Import Logic Modules directly from /js/
// Note: We need to use relative paths from this script location
import { generateDailyGame, checkBlockAmbiguity } from "../js/sudoku-logic.js";
import { getAllTargets } from "../js/peaks-logic.js";
import { generateSearchSequences } from "../js/search-gen.js";
import { getDailySeed } from "../js/utils/random.js";

// Setup Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUZZLES_DIR = path.join(__dirname, "../public/puzzles");

// Ensure output directory exists
if (!fs.existsSync(PUZZLES_DIR)) {
  fs.mkdirSync(PUZZLES_DIR, { recursive: true });
}

async function generateDailyPuzzle() {
  console.log("🧩 Starting Daily Puzzle Generation...");

  // 1. Determine Seed (Argument or Today)
  let seed = process.argv[2];
  let dateStr = "";
  let seedInt;

  if (!seed) {
    // Generate for "Tomorrow" to ensure it's ready for early timezones (Asia/Oceania)
    // Run at 00:00 UTC Jan 26 -> Generates for Jan 27
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    dateStr = `${yyyy}-${mm}-${dd}`;

    // Convert formatted date back to integer seed
    // We cannot use getDailySeed() because that uses "Now".
    // We must manually construct seed from the calculated tomorrow date.
    seedInt = parseInt(`${yyyy}${mm}${dd}`, 10);
    seed = seedInt.toString();

    console.log(`📅 Target Date: ${dateStr} (Tomorrow), Seed: ${seed}`);
  } else {
    // If seed is "20260127", we want dateStr to be "2026-01-27"
    // Check if seed matches YYYYMMDD format
    if (/^\d{8}$/.test(seed)) {
      const y = seed.substring(0, 4);
      const m = seed.substring(4, 6);
      const d = seed.substring(6, 8);
      dateStr = `${y}-${m}-${d}`;
    } else {
      dateStr = "custom-" + seed;
    }
    console.log(`🔧 Custom Seed: ${seed} -> Date: ${dateStr}`);
  }

  try {
    // seedInt is already set above if logic is correct, but let's ensure it exists
    if (!seedInt) seedInt = parseInt(seed, 10);
    const baseSeed = seedInt; // Store original date seed

    // 2. Generate Sudoku & Jigsaw (Base)
    console.log("   > Generating Sudoku & Jigsaw Layers...");

    let gameData;
    let attempts = 0;
    const MAX_AMBIGUITY_RETRIES = 500;

    // "El Permutador de Bloques" Loop
    while (true) {
      // Use suffix strategy: 20260126 -> 20260126000, 20260126001, etc.
      // This ensures strictly unique seeds for this date without touching tomorrow's seed
      if (attempts > 0) {
        seedInt = baseSeed * 1000 + attempts;
      } else {
        // First attempt tries the clean date seed (optional, but let's stick to the pattern)
        // or just start with * 1000.
        // Actually, if we change the seed format, we change the resulting puzzle for EVERYONE.
        // But since this is a new validation, it's fine.
        // Let's keep attempt 0 as the pure date seed for backward compat if it works?
        // No, "20260126" and "20260126000" are different numbers.
        // Let's just use the appended version for consistency if we want.
        // OR: keep logic: seedInt = (attempts === 0) ? baseSeed : (baseSeed * 1000 + attempts);
        seedInt = attempts === 0 ? baseSeed : baseSeed * 1000 + attempts;
      }

      gameData = generateDailyGame(seedInt);

      // Validate: Ensure no two blocks are identical (Visual Ambiguity)
      // We no longer check for "Block Swapping Ambiguity" because Stack Swaps are always valid in Sudoku.
      // Instead, we will enforce STRICT placement in the client (jigsaw.js).
      const blocks = [];
      for (let r = 0; r < 9; r += 3) {
        for (let c = 0; c < 9; c += 3) {
          // Extract 3x3 block
          const block = [];
          for (let i = 0; i < 3; i++) {
            block.push(gameData.solution[r + i].slice(c, c + 3));
          }
          blocks.push(JSON.stringify(block));
        }
      }

      if (new Set(blocks).size === 9) {
        // All blocks unique!
        if (attempts > 0) {
          console.log(
            `\n     ✅ Found visually unique puzzle after ${attempts} retries. Final Seed: ${seedInt}`,
          );
        }
        break;
      }

      attempts++;

      if (attempts % 10 === 0) process.stdout.write(".");

      if (attempts > MAX_AMBIGUITY_RETRIES) {
        throw new Error(
          `Could not find a unique block arrangement after ${MAX_AMBIGUITY_RETRIES} attempts.`,
        );
      }
    }
    if (attempts > 0 && attempts % 10 !== 0) console.log(""); // Newline cleanup

    // 3. Generate Peaks & Valleys (Base)
    console.log("   > Calculating Peaks & Valleys (Base)...");
    // We only need this to verify validity? No, we need to generate search sequences for each variation.

    // 4. PREPARE SYMMETRIC VARIATIONS
    // We need 4 variations:
    // 0: Identity (Base)
    // LR: Swap Left Stack (cols 0-2) with Right Stack (cols 6-8)
    // TB: Swap Top Band (rows 0-2) with Bottom Band (rows 6-8)
    // HV: Swap Both (Rotate 180 symmetric effectively for blocks, though not cells)

    // First: Select 3 RESERVED cells (Simon Values) from Base Solution
    // They must NOT be Peak or Valley in the BASE solution?
    // Actually, Peak/Valley status might change if we swap bands?
    // Wait. Peaks/Valleys are Local neighbor checks.
    // If we swap a whole stack of blocks 3x3:
    // The internal 3x3 relationships are preserved.
    // But the BORDERS between blocks change.
    // So Peak/Valley status might change at the edges.
    // Thus we must recalculate Peaks/Valleys for each variation.

    // Selecting Reserved Cells:
    // We want 3 random cells that are NOT peaks/valleys in ANY variation?
    // That's too restrictive.
    // Easier: Pick 3 cells. Calculate variations. IF any reserved cell becomes a peak/valley in any variation, RETRY picking reserved cells.
    // This ensures consistency.

    // 4. PREPARE SYMMETRIC VARIATIONS & GENERATE SEARCH
    // Retry loop: If Search fails to cover the board (leaving only simon cells),
    // pick new Simon Cells and retry. Ideally, different reserved cells enable better coverage.

    let attemptsSearch = 0;
    const MAX_SEARCH_ATTEMPTS = 50;
    let success = false;

    let finalVariations = {};
    let finalSimonValues = [];
    let finalSearchTargets = {};

    while (!success && attemptsSearch < MAX_SEARCH_ATTEMPTS) {
      attemptsSearch++;
      process.stdout.write(
        `   > Attempt ${attemptsSearch}/${MAX_SEARCH_ATTEMPTS}: Picking Simon Cells... `,
      );

      let variations = {
        0: { board: JSON.parse(JSON.stringify(gameData.solution)) },
        LR: { board: swapStacks(gameData.solution) },
        TB: { board: swapBands(gameData.solution) },
        HV: { board: swapBands(swapStacks(gameData.solution)) },
      };

      // 4a. Pick 3 Random Cells
      let simonCoordsBase = [];
      const usedIndices = new Set();
      while (simonCoordsBase.length < 3) {
        const r = Math.floor(Math.random() * 9);
        const c = Math.floor(Math.random() * 9);
        const key = `${r},${c}`;
        if (!usedIndices.has(key)) {
          usedIndices.add(key);
          simonCoordsBase.push({ r, c });
        }
      }

      // 4b. Validate against all variations (Must not be Peak/Valley)
      let clean = true;
      for (const [key, varData] of Object.entries(variations)) {
        varData.simonCoords = mapCoordinates(simonCoordsBase, key);
        const { targetMap } = getAllTargets(varData.board);
        varData.peaksValleys = targetMap;

        for (const coord of varData.simonCoords) {
          if (targetMap.has(`${coord.r},${coord.c}`)) {
            clean = false;
            break; // Failed this attempt
          }
        }
        if (!clean) break;
      }

      if (!clean) {
        process.stdout.write("Conflict with P/V. Retrying.\r");
        continue; // Try next attempt
      }

      // 4c. Generate Search Sequences for ALL variations
      let allVariationsValid = true;
      let tempSearchTargets = {};

      for (const [key, varData] of Object.entries(variations)) {
        let bestResult = null;
        let varSuccess = false;

        // LOCAL RETRY: Try up to 5 times to solve THIS variation with CURRENT Simon cells
        // BEFORE giving up and rotating Simon cells.
        for (let i = 0; i < 5; i++) {
          const seedVariance = attemptsSearch * 100 + i; // Unique seed per local attempt

          const result = generateSearchSequences(
            varData.board,
            seedInt + seedVariance,
            60000,
            varData.simonCoords,
          );

          // Strict Check: Must have <= 3 holes (the Simon cells themselves)
          // Note: result.holes usually includes the simon cells if they are not filled by paths.
          // If result.holes count includes simon, we want == 3. If excludes, == 0.
          // Assuming result.holes counts ALL unused cells:
          if (result && result.holes <= 3) {
            bestResult = result;
            varSuccess = true;
            break; // Found valid path for this variation!
          }
        }

        if (!varSuccess) {
          process.stdout.write(
            ` -> Failed Var [${key}] after 5 attempts. Retrying Set.\r`,
          );
          allVariationsValid = false;
          break; // Break variation loop, triggers outer retry
        }

        tempSearchTargets[key] = bestResult.sequences;
      }

      if (allVariationsValid) {
        console.log(
          `\n     ✅ Success! All variations cover full board (except 3 reserved).`,
        );
        finalVariations = variations;
        finalSimonValues = simonCoordsBase.map(
          (p) => gameData.solution[p.r][p.c],
        );
        finalSearchTargets = tempSearchTargets;
        success = true;
      }
    }

    if (!success) {
      throw new Error(
        `CRITICAL: Could not find valid puzzle layout after ${MAX_SEARCH_ATTEMPTS} attempts.`,
      );
    }

    console.log(`   > Reserved Simon Values: ${finalSimonValues.join(", ")}`);
    const allSearchTargets = finalSearchTargets; // Alias for saving

    // 5. Construct Final JSON Overlay
    const dailyPuzzle = {
      meta: {
        version: "2.1", // Bump version for strict mode
        date: dateStr,
        seed: seedInt,
        generatedAt: new Date().toISOString(),
      },
      data: {
        solution: gameData.solution, // Original Board
        puzzle: gameData.puzzle,
        simonValues: finalSimonValues, // The logical numbers (from the successful attempt)
        searchTargets: allSearchTargets, // Map { "0": {...}, "LR": {...} ... }
      },
      chunks: gameData.chunks, // Add chunks explicitly if needed by earlier logic, though usually part of dailyGame
    };

    // Helper Functions for Transposition
    function swapStacks(board) {
      // Swap ColStack 0 (0-2) and ColStack 2 (6-8)
      const newBoard = board.map((row) => [...row]);
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 3; c++) {
          const temp = newBoard[r][c];
          newBoard[r][c] = newBoard[r][c + 6];
          newBoard[r][c + 6] = temp;
        }
      }
      return newBoard;
    }

    function swapBands(board) {
      // Swap RowBand 0 (0-2) and RowBand 2 (6-8)
      const newBoard = board.map((row) => [...row]);
      // Swap rows 0,1,2 with 6,7,8
      for (let offset = 0; offset < 3; offset++) {
        const tempRow = newBoard[offset];
        newBoard[offset] = newBoard[offset + 6];
        newBoard[offset + 6] = tempRow;
      }
      return newBoard;
    }

    function mapCoordinates(coords, mode) {
      return coords.map((p) => {
        let r = p.r;
        let c = p.c;
        // Apply LR
        if (mode === "LR" || mode === "HV") {
          if (c < 3) c += 6;
          else if (c >= 6) c -= 6;
        }
        // Apply TB
        if (mode === "TB" || mode === "HV") {
          if (r < 3) r += 6;
          else if (r >= 6) r -= 6;
        }
        return { r, c };
      });
    }

    // 6. Save to File
    const filename = `daily-${dateStr}.json`;
    const filePath = path.join(PUZZLES_DIR, filename);

    fs.writeFileSync(filePath, JSON.stringify(dailyPuzzle, null, 2));
    console.log(`✅ Success! Puzzle saved to: ${filePath}`);
  } catch (error) {
    console.error("❌ Fatal Error during generation:", error);
    process.exit(1);
  }
}

// Run
generateDailyPuzzle();
