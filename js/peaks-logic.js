/* Shared Peaks & Valleys Logic */

export function isPeakOrValley(row, col, board) {
  return checkCellType(row, col, board);
}

export function getAllTargets(board) {
  const targetMap = new Map();
  let peakCount = 0;
  let valleyCount = 0;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const type = checkCellType(r, c, board);
      if (type) {
        targetMap.set(`${r},${c}`, type);
        if (type === "peak") peakCount++;
        else valleyCount++;
      }
    }
  }
  return { targetMap, peakCount, valleyCount };
}

function checkCellType(row, col, board) {
  const val = board[row][col];
  const neighbors = getNeighbors(row, col);

  // Check Peak (All neighbors are SMALLER)
  const isPeak = neighbors.every((n) => board[n.r][n.c] < val);
  if (isPeak) return "peak";

  // Check Valley (All neighbors are LARGER)
  const isValley = neighbors.every((n) => board[n.r][n.c] > val);
  if (isValley) return "valley";

  return null;
}

export function getNeighbors(r, c) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
        neighbors.push({ r: nr, c: nc });
      }
    }
  }
  return neighbors;
}

export function getOrthogonalNeighbors(r, c) {
  const neighbors = [];
  const dirs = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ];

  for (const d of dirs) {
    const nr = r + d.r;
    const nc = c + d.c;
    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
      neighbors.push({ r: nr, c: nc });
    }
  }
  return neighbors;
}
