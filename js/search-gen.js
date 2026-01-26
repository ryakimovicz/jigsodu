import {
  isPeakOrValley,
  getNeighbors,
  getOrthogonalNeighbors,
} from "./peaks-logic.js";

// Deterministic RNG (Linear Congruential Generator)
class SeededRNG {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed;
  }
  nextFloat() {
    return (this.next() - 1) / 2147483646;
  }
  range(min, max) {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }
}

export function generateSearchSequences(board, dateSeed) {
  const rng = new SeededRNG(dateSeed);
  const rows = 9;
  const cols = 9;
  const usedMap = new Set(); // "r,c" of cells used in sequences
  const sequences = [];

  // 1. Identify Available Cells (NOT Peak AND NOT Valley)
  const availableCells = [];
  const peaksValleys = new Set();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isPeakOrValley(r, c, board)) {
        peaksValleys.add(`${r},${c}`);
      } else {
        availableCells.push({ r, c });
      }
    }
  }

  // 2. Target Used Cells = Total Available - 5
  // We want exactly 5 cells left unused (neither peak/valley nor sequence)
  const totalAvailable = availableCells.length;
  const targetUsedCount = Math.max(0, totalAvailable - 5);

  console.log(
    `Generating Search: Available ${totalAvailable}, Target Used ${targetUsedCount}`,
  );

  // 3. Backtracking Generation
  const result = backtrackSequences(
    board,
    usedMap,
    sequences,
    0, // currentUsedCount
    targetUsedCount,
    peaksValleys,
    rng,
  );

  if (!result) {
    console.warn(
      "Failed to generate perfect search sequences. Fallback or retry?",
    );
    // Fallback? Ideally we should always find one given the constraints are loose enough.
    return [];
  }

  return sequences;
}

function backtrackSequences(
  board,
  usedMap,
  sequences,
  currentUsedCount,
  targetUsedCount,
  peaksValleys,
  rng,
) {
  // Base Case: Success
  if (currentUsedCount === targetUsedCount) {
    return true;
  }

  // Pruning: Check for islands (Dead Ends)
  if (
    !isValidState(usedMap, peaksValleys, targetUsedCount - currentUsedCount)
  ) {
    return false;
  }

  // Pick a random starting cell from unused available cells
  const potentialStarts = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const key = `${r},${c}`;
      if (!usedMap.has(key) && !peaksValleys.has(key)) {
        potentialStarts.push({ r, c });
      }
    }
  }

  if (potentialStarts.length === 0) return false;

  // Shuffle starts to vary the generation
  shuffleArray(potentialStarts, rng);

  for (const start of potentialStarts) {
    // Try lengths 3 to 6
    const lengths = [3, 4, 5, 6];
    shuffleArray(lengths, rng);

    for (const len of lengths) {
      // Don't exceed target
      if (currentUsedCount + len > targetUsedCount) continue;

      // Try to find a path of 'len' starting at 'start'
      const paths = findPaths(board, start, len, usedMap, peaksValleys);
      shuffleArray(paths, rng);

      for (const path of paths) {
        // Place Path
        path.forEach((cell) => usedMap.add(`${cell.r},${cell.c}`));

        // Extract Numbers
        const numbers = path.map((p) => board[p.r][p.c]);
        const seqObj = { path, numbers, id: sequences.length };
        sequences.push(seqObj);

        // Recursive Step
        if (
          backtrackSequences(
            board,
            usedMap,
            sequences,
            currentUsedCount + len,
            targetUsedCount,
            peaksValleys,
            rng,
          )
        ) {
          return true;
        }

        // Undo (Backtrack)
        sequences.pop();
        path.forEach((cell) => usedMap.delete(`${cell.r},${cell.c}`));
      }
    }
  }

  return false;
}

// Check if remaining holes are valid
// Allow holes ONLY if they will become the final 5
// Since we fill EXACTLY targetUsedCount, "holes" here means islands of unused cells.
// Constraint: logic says "Islands < 3 are impossible".
// BUT: We have a buffer of 5.
// So, the SUM of all islands size < 3 MUST be <= (remaining_buffer_for_final_5).
// Actually, strict reading of user request: "imposibles (islas < 3 celdas que no son parte de los 5 finales)".
// This means we can have small islands if they are the FINAL leftovers.
// Total unused cells at ANY point = (TotalAvailable - currentUsedCount).
// Final unused will be 5.
// So, valid state is: Sum(size of islands < 3) <= 5.
function isValidState(usedMap, peaksValleys, remainingToFill) {
  const visited = new Set();
  let smallIslandSum = 0;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const key = `${r},${c}`;
      if (usedMap.has(key) || peaksValleys.has(key) || visited.has(key))
        continue;

      // Found an unused component
      const size = getComponentSize(r, c, usedMap, peaksValleys, visited);

      // If this island is too small to fit a sequence (size < 3),
      // it MUST remain unused forever.
      if (size < 3) {
        smallIslandSum += size;
      }
    }
  }

  // Total Free Cells = remainingToFill + 5 (Final Buffer)
  // We need to fill remainingToFill.
  // The 'smallIslandSum' cells are useless for filling.
  // So available for filling = (TotalFree - smallIslandSum).
  // If (TotalFree - smallIslandSum) < remainingToFill, we are stuck.
  // Or simply: smallIslandSum must fit in the final 5 buffer.
  return smallIslandSum <= 5;
}

function getComponentSize(startR, startC, usedMap, peaksValleys, visited) {
  let size = 0;
  const stack = [{ r: startR, c: startC }];
  visited.add(`${startR},${startC}`);

  while (stack.length > 0) {
    const { r, c } = stack.pop();
    size++;

    const neighbors = getOrthogonalNeighbors(r, c);
    for (const n of neighbors) {
      const key = `${n.r},${n.c}`;
      if (!usedMap.has(key) && !peaksValleys.has(key) && !visited.has(key)) {
        visited.add(key);
        stack.push(n);
      }
    }
  }
  return size;
}

function findPaths(board, start, len, usedMap, peaksValleys) {
  const result = [];

  function dfs(curr, path, visitedSet) {
    if (path.length === len) {
      result.push([...path]);
      return;
    }

    const neighbors = getOrthogonalNeighbors(curr.r, curr.c);
    for (const n of neighbors) {
      const key = `${n.r},${n.c}`;
      // Constraint: Unique cells (not in global usedMap, not in current path, not peak/valley)
      if (!usedMap.has(key) && !peaksValleys.has(key) && !visitedSet.has(key)) {
        visitedSet.add(key);
        path.push(n);
        dfs(n, path, visitedSet);
        path.pop();
        visitedSet.delete(key);
      }
    }
  }

  dfs(start, [start], new Set([`${start.r},${start.c}`]));
  return result;
}

function shuffleArray(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = rng.range(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
}
