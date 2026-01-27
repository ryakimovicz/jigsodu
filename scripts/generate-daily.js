import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Import Logic Modules
import { generateDailyGame } from "../js/sudoku-logic.js";
import { getAllTargets } from "../js/peaks-logic.js";
import { generateSearchSequences } from "../js/search-gen.js";

// Setup Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUZZLES_DIR = path.join(__dirname, "../public/puzzles");

if (!fs.existsSync(PUZZLES_DIR)) {
  fs.mkdirSync(PUZZLES_DIR, { recursive: true });
}

async function generateDailyPuzzle() {
  console.log(
    "🧩 Starting Daily Puzzle Generation (Island-Constraint Strategy)...",
  );

  // 1. Determine Seed
  let seed = process.argv[2];
  let dateStr = "";
  let seedInt;

  if (!seed) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    dateStr = `${yyyy}-${mm}-${dd}`;
    seedInt = parseInt(`${yyyy}${mm}${dd}`, 10);
    seed = seedInt.toString();
    console.log(`📅 Target Date: ${dateStr} (Tomorrow), Seed: ${seed}`);
  } else {
    if (/^\d{8}$/.test(seed)) {
      const y = seed.substring(0, 4);
      const m = seed.substring(4, 6);
      const d = seed.substring(6, 8);
      dateStr = `${y}-${m}-${d}`;
    } else {
      dateStr = "custom-" + seed;
    }
    console.log(`🔧 Custom Seed: ${seed} -> Date: ${dateStr}`);
    seedInt = parseInt(seed, 10) || 12345;
  }

  try {
    const baseSeed = seedInt;
    let attemptsGlobal = 0;
    let success = false;

    let finalGameData = null;
    let finalSearchTargets = {};
    let finalSimonValues = [];

    // --- MAIN LOOP ---
    while (!success && attemptsGlobal < 100) {
      attemptsGlobal++;

      // 1. Generate NEW Sudoku
      const currentSeed = baseSeed + attemptsGlobal * 777;
      let gameData = generateDailyGame(currentSeed);

      process.stdout.write(`   > Attempt ${attemptsGlobal}: `);

      // 2. Setup Variations
      let variations = {
        0: { board: JSON.parse(JSON.stringify(gameData.solution)) },
        LR: { board: swapStacks(gameData.solution) },
        TB: { board: swapBands(gameData.solution) },
        HV: { board: swapBands(swapStacks(gameData.solution)) },
      };

      // 3. ISLAND SCAN & CONSTRAINT ANALYSIS
      // Detect forced cells (islands) in all variations
      let forcedValues = new Set();
      let constraintsValid = true;

      for (let key in variations) {
        // Calculate Walls
        const { targetMap } = getAllTargets(variations[key].board);
        variations[key].peaksValleys = targetMap;

        // Find Islands (Cells trapped by walls)
        const islands = getIslands(variations[key].peaksValleys);

        // Save islands as "Pre-Reserved" for this variant
        variations[key].reservedIslands = [];

        for (let island of islands) {
          const val = variations[key].board[island.r][island.c];
          forcedValues.add(val);
          variations[key].reservedIslands.push({
            r: island.r,
            c: island.c,
            val: val,
          });
        }
      }

      // RULE: Max 3 distinct forced numbers allowed
      if (forcedValues.size > 3) {
        process.stdout.write(
          `Too many forced islands (${forcedValues.size} > 3). Next.\r`,
        );
        continue;
      }

      // 4. PREPARE SIMON VALUES
      // If we have forced values (e.g. 5), we keep them.
      // Then we fill the rest of the 3 slots with random numbers.
      let targetValues = Array.from(forcedValues);
      const allNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const randomPool = allNumbers
        .filter((n) => !forcedValues.has(n))
        .sort(() => 0.5 - Math.random());

      while (targetValues.length < 3) {
        targetValues.push(randomPool.pop());
      }

      process.stdout.write(
        `Targets: [${targetValues.join(",")}] (Forced: ${forcedValues.size})... `,
      );

      // 5. FILL & CARVE
      let allVariationsSuccess = true;
      let tempSearchTargets = {};

      for (let key in variations) {
        // A. Generate Full Cover (Respecting Islands)
        // We pass the islands as 'reserved' so the generator doesn't try to cover them
        const fillResult = generateFullCover(
          variations[key].board,
          variations[key].peaksValleys,
          variations[key].reservedIslands, // These stay empty (holes)
          currentSeed + 100,
        );

        if (!fillResult.success) {
          allVariationsSuccess = false;
          break;
        }

        // B. Carve the REST of the numbers
        // The islands are already "carved" (they are holes).
        // We need to carve the other numbers from the generated snakes.

        // Filter out values that are already satisfied by islands in THIS variant
        const satisfiedByIslands = new Set(
          variations[key].reservedIslands.map((i) => i.val),
        );
        const toCarve = targetValues.filter((v) => !satisfiedByIslands.has(v));

        // Carve Logic
        const carveResult = carveHoles(
          fillResult.sequences,
          variations[key].board,
          toCarve,
        );

        if (!carveResult.success) {
          allVariationsSuccess = false;
          break;
        }

        // Combine Islands + Carved Holes for the final Simon Coordinates
        const finalHoles = [
          ...variations[key].reservedIslands.map((i) => ({ r: i.r, c: i.c })),
          ...carveResult.removedCoords,
        ];

        tempSearchTargets[key] = {
          targets: carveResult.sequences,
          simon: finalHoles,
        };
      }

      if (allVariationsSuccess) {
        console.log(`\n     ✅ SUCCESS!`);
        finalSearchTargets = tempSearchTargets;
        finalSimonValues = targetValues;
        finalGameData = gameData;
        success = true;
      } else {
        process.stdout.write(`Carve failed. Next.\r`);
      }
    }

    if (!success)
      throw new Error("Could not generate valid puzzle after 100 attempts.");

    // --- SAVE ---
    const dailyPuzzle = {
      meta: { version: "3.3-island-hybrid", date: dateStr, seed: seedInt },
      data: {
        solution: finalGameData.solution,
        puzzle: finalGameData.puzzle,
        simonValues: finalSimonValues,
        searchTargets: finalSearchTargets,
      },
      chunks: finalGameData.chunks,
    };

    const filename = `daily-${dateStr}.json`;
    fs.writeFileSync(
      path.join(PUZZLES_DIR, filename),
      JSON.stringify(dailyPuzzle, null, 2),
    );
    console.log(`✅ Puzzle saved: ${filename}`);
  } catch (error) {
    console.error("❌ Fatal Error:", error);
    process.exit(1);
  }
}

// --- HELPER: Detect Islands (Forced Holes) ---
function getIslands(pvMap) {
  // Returns array of {r,c} for cells that have 0 free neighbors
  const grid = Array(9)
    .fill()
    .map(() => Array(9).fill(0)); // 0=Free, 1=Wall
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      if (pvMap.has(`${r},${c}`)) grid[r][c] = 1;
    }

  const islands = [];
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        // Free cell
        let freeNeighbors = 0;
        for (let d of dirs) {
          const nr = r + d[0],
            nc = c + d[1];
          if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && grid[nr][nc] === 0) {
            freeNeighbors++;
          }
        }
        if (freeNeighbors === 0) {
          islands.push({ r, c }); // It's a trap!
        }
      }
    }
  }
  return islands;
}

// --- HELPER 1: FULL COVER GENERATOR ---
function generateFullCover(grid, pvMap, reserved, seed) {
  // Allow tolerance because we use absorbOrphans
  const result = generateSearchSequences(grid, seed, 1000, reserved);

  // Expected holes = reserved.length
  // We allow up to 40 extra holes to be cleaned
  if (result && result.holes <= reserved.length + 40) {
    absorbOrphans(result.sequences, grid, reserved, pvMap);

    const holes = countHoles(result.sequences, reserved.length, pvMap);
    if (holes === 0) {
      return { success: true, sequences: result.sequences };
    }
  }
  return { success: false };
}

// --- HELPER 2: THE CARVER ---
function carveHoles(sequences, grid, targetValues) {
  // Same logic as before, just removing numbers
  let removedCoords = [];
  // Work on a deep copy of sequences so we don't mess up if we fail mid-way
  let seqCopy = JSON.parse(JSON.stringify(sequences));

  for (let target of targetValues) {
    let carved = false;
    let candidates = [];

    for (let sIdx = 0; sIdx < seqCopy.length; sIdx++) {
      const seq = seqCopy[sIdx];
      for (let cIdx = 0; cIdx < seq.length; cIdx++) {
        const cell = seq[cIdx];
        if (grid[cell.r][cell.c] === target) {
          candidates.push({ sIdx, cIdx, r: cell.r, c: cell.c });
        }
      }
    }
    candidates.sort(() => 0.5 - Math.random());

    for (let cand of candidates) {
      const seq = seqCopy[cand.sIdx];

      // Validation Logic (Min Length 3)
      // Check head, tail, split...
      if (cand.cIdx === 0) {
        if (seq.length - 1 >= 3) {
          seq.shift();
          removedCoords.push({ r: cand.r, c: cand.c });
          carved = true;
          break;
        }
      } else if (cand.cIdx === seq.length - 1) {
        if (seq.length - 1 >= 3) {
          seq.pop();
          removedCoords.push({ r: cand.r, c: cand.c });
          carved = true;
          break;
        }
      } else {
        const left = seq.slice(0, cand.cIdx);
        const right = seq.slice(cand.cIdx + 1);
        if (left.length >= 3 && right.length >= 3) {
          seqCopy[cand.sIdx] = left;
          seqCopy.push(right);
          removedCoords.push({ r: cand.r, c: cand.c });
          carved = true;
          break;
        }
      }
    }
    if (!carved) return { success: false };
  }
  return { success: true, sequences: seqCopy, removedCoords };
}

// --- STANDARD HELPERS ---
function absorbOrphans(sequences, grid, reservedArr, topographyMap) {
  const reservedSet = new Set(reservedArr.map((p) => `${p.r},${p.c}`));
  let changed = true;
  while (changed) {
    changed = false;
    const orphans = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const key = `${r},${c}`;
        const isUsed = sequences.some((seq) =>
          seq.some((s) => s.r === r && s.c === c),
        );
        const isWall = topographyMap.has(key);
        const isReserved = reservedSet.has(key);
        if (!isUsed && !isWall && !isReserved) orphans.push({ r, c });
      }
    }
    if (orphans.length === 0) return true;

    // Merge to neighbors
    for (let i = 0; i < orphans.length; i++) {
      let orphan = orphans[i];
      if (!orphan) continue;
      for (let seq of sequences) {
        if (dist(seq[0], orphan) === 1) {
          seq.unshift(orphan);
          orphans[i] = null;
          changed = true;
          break;
        }
        if (dist(seq[seq.length - 1], orphan) === 1) {
          seq.push(orphan);
          orphans[i] = null;
          changed = true;
          break;
        }
      }
    }

    // Phase 2: Create new snakes if stuck
    const rem = orphans.filter((o) => o !== null);
    if (!changed && rem.length >= 2) {
      for (let i = 0; i < rem.length; i++) {
        for (let j = i + 1; j < rem.length; j++) {
          if (dist(rem[i], rem[j]) === 1) {
            sequences.push([rem[i], rem[j]]);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
  }
  return false;
}

function dist(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}
function countHoles(sequences, reservedCount, pvMap) {
  let used = sequences.reduce((acc, s) => acc + s.length, 0);
  return 81 - (used + pvMap.size + reservedCount);
}
function swapStacks(board) {
  const newBoard = board.map((r) => [...r]);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 3; c++) {
      [newBoard[r][c], newBoard[r][c + 6]] = [
        newBoard[r][c + 6],
        newBoard[r][c],
      ];
    }
  return newBoard;
}
function swapBands(board) {
  const newBoard = board.map((r) => [...r]);
  for (let r = 0; r < 3; r++)
    [newBoard[r], newBoard[r + 6]] = [newBoard[r + 6], newBoard[r]];
  return newBoard;
}

generateDailyPuzzle();
