import { gameManager } from "./game-manager.js";
import { translations } from "./translations.js";
import { getCurrentLang } from "./i18n.js";

let selectedCell = null;
let pencilMode = false;

export function initSudoku() {
  console.log("Initializing Sudoku Stage...");

  // Add listeners to keypad
  const numButtons = document.querySelectorAll(".sudoku-num");
  numButtons.forEach((btn) => {
    btn.addEventListener("click", () => handleNumberInput(btn.dataset.value));
  });

  document
    .getElementById("sudoku-pencil")
    ?.addEventListener("click", togglePencilMode);
  document
    .getElementById("sudoku-clear")
    ?.addEventListener("click", clearSelectedCell);
  document.getElementById("sudoku-back")?.addEventListener("click", handleUndo);

  const helpBtn = document.getElementById("debug-help-btn");
  if (helpBtn) {
    helpBtn.addEventListener("click", provideHint);
  }

  // Board cell selection
  const board = document.getElementById("memory-board");
  if (board) {
    board.addEventListener("click", (e) => {
      const cell = e.target.closest(".mini-cell");
      if (cell) {
        selectCell(cell);
      }
    });
  }
}

export function transitionToSudoku() {
  console.log("Transitioning to Sudoku...");

  const gameSection = document.getElementById("memory-game");
  const controls = document.getElementById("sudoku-controls");

  if (!gameSection || !controls) return;

  // Change mode with forced reflow for smooth animation
  gameSection.classList.remove("jigsaw-mode");
  gameSection.classList.remove("selection-active");
  gameSection.classList.remove("jigsaw-selection-active");

  // Force reflow to capture the starting state for transitions
  void gameSection.offsetWidth;

  gameSection.classList.add("sudoku-mode");

  // Show controls
  controls.classList.remove("hidden");

  // CLEANUP BOARD STATE: Remove jigsaw-related victory classes
  const board = document.getElementById("memory-board");
  if (board) {
    board.classList.remove("board-complete", "board-error");
  }

  // Update header title/desc if needed via gameManager or manually
  const headerTitle = gameSection.querySelector(".header-title-container h2");
  if (headerTitle) {
    headerTitle.textContent =
      translations[gameManager.getState().language]?.game_sudoku || "Sudoku";
  }

  // Deselect any jigsaw pieces
  document
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));

  // Update Tooltip Info for Sudoku
  const lang = getCurrentLang();
  const t = translations[lang];
  const tooltipTitle = document.querySelector(".info-tooltip h3");
  const tooltipDesc = document.querySelector(".info-tooltip p");

  if (tooltipTitle && tooltipDesc) {
    tooltipTitle.style.transition = "opacity 0.5s ease";
    tooltipDesc.style.transition = "opacity 0.5s ease";
    tooltipTitle.style.opacity = "0";
    tooltipDesc.style.opacity = "0";

    setTimeout(() => {
      tooltipTitle.textContent = t.sudoku_help_title || "Sudoku";
      tooltipDesc.innerHTML = t.sudoku_help_desc || "";
      tooltipTitle.style.opacity = "1";
      tooltipDesc.style.opacity = "1";
    }, 500);
  }
}

function selectCell(cell) {
  // Can't edit pre-filled cells (initial puzzle numbers)
  if (
    cell.classList.contains("has-number") &&
    !cell.classList.contains("user-filled")
  ) {
    return;
  }

  if (selectedCell) {
    selectedCell.classList.remove("selected-cell");
  }

  selectedCell = cell;
  selectedCell.classList.add("selected-cell");
}

function handleNumberInput(num) {
  if (!selectedCell) return;

  if (pencilMode) {
    // Implement notes logic
    console.log("Pencil note:", num);
    toggleNote(selectedCell, num);
  } else {
    selectedCell.textContent = num;
    selectedCell.classList.add("user-filled");
    selectedCell.classList.remove("has-notes");
    // Clear any notes
    const notesGrid = selectedCell.querySelector(".notes-grid");
    if (notesGrid) notesGrid.remove();

    // REMOVE ERROR CLASS ON EDIT
    selectedCell.classList.remove("error");

    // VALIDATE BOARD AFTER FILL
    validateBoard();
  }
}

function togglePencilMode() {
  pencilMode = !pencilMode;
  const btn = document.getElementById("sudoku-pencil");
  if (btn) {
    btn.classList.toggle("active", pencilMode);
  }
}

function clearSelectedCell() {
  if (!selectedCell) return;
  selectedCell.textContent = "";
  selectedCell.classList.remove("user-filled", "has-notes", "error");
  const notesGrid = selectedCell.querySelector(".notes-grid");
  if (notesGrid) notesGrid.remove();
}

function handleUndo() {
  console.log("Undo not implemented yet");
}

function toggleNote(cell, num) {
  // Simple note logic for now: just text or small dots?
  // Let's create a 3x3 grid of small numbers for notes
  cell.classList.add("has-notes");
  cell.textContent = ""; // Clear main number
  cell.classList.remove("error"); // Pencil marks clear error state

  let notesGrid = cell.querySelector(".notes-grid");
  if (!notesGrid) {
    notesGrid = document.createElement("div");
    notesGrid.classList.add("notes-grid");
    cell.appendChild(notesGrid);
    // Initialize 9 empty slots
    for (let i = 1; i <= 9; i++) {
      const slot = document.createElement("div");
      slot.classList.add("note-slot");
      slot.dataset.note = i;
      notesGrid.appendChild(slot);
    }
  }

  const slot = notesGrid.querySelector(`[data-note="${num}"]`);
  if (slot) {
    slot.textContent = slot.textContent ? "" : num;
  }
}

function validateBoard() {
  const gameSection = document.getElementById("memory-game");
  if (!gameSection || !gameSection.classList.contains("sudoku-mode")) return;

  const board = document.getElementById("memory-board");
  // Be surgical: only slots inside the board
  const slots = Array.from(board.querySelectorAll(".sudoku-chunk-slot"));

  if (slots.length !== 9) {
    console.warn("Sudoku validation: expected 9 slots, found", slots.length);
    return;
  }

  // 1. Check if Board is Full
  let isFull = true;
  const allCells = [];
  let missingCells = 0;

  slots.forEach((slot) => {
    // Slot index is fixed in DOM order 0-8
    const slotIndex = parseInt(slot.dataset.slotIndex);
    const cells = Array.from(slot.querySelectorAll(".mini-cell"));

    cells.forEach((cell, localIndex) => {
      const val = cell.textContent.trim();
      const hasNotes = cell.classList.contains("has-notes");

      // Store cell with its mapped coordinates
      const row = Math.floor(slotIndex / 3) * 3 + Math.floor(localIndex / 3);
      const col = (slotIndex % 3) * 3 + (localIndex % 3);
      allCells.push({ element: cell, row, col, val });

      if (val === "" || hasNotes) {
        isFull = false;
        missingCells++;
      }
    });
  });

  if (!isFull) {
    if (missingCells < 5)
      console.log(`Sudoku: ${missingCells} cells remaining...`);
    return;
  }

  if (allCells.length !== 81) {
    console.warn(
      "Sudoku validation: expected 81 cells, found",
      allCells.length,
    );
    return;
  }

  console.log("Sudoku Board Full - Validating Matrix...");

  const state = gameManager.getState();
  const solution = state.data.solution;
  let errorCount = 0;

  allCells.forEach((cellData) => {
    const correctValue = solution[cellData.row][cellData.col];
    const userValue = parseInt(cellData.val);

    if (userValue !== correctValue) {
      if (cellData.element.classList.contains("user-filled")) {
        cellData.element.classList.add("error");
      }
      errorCount++;
    } else {
      cellData.element.classList.remove("error");
    }
  });

  if (errorCount === 0) {
    console.log("Sudoku Solved! Triggering success feedback...");
    handleSudokuWin();
  } else {
    console.log(`Sudoku: Board full but ${errorCount} errors found.`);
  }
}

function handleSudokuWin() {
  const board = document.getElementById("memory-board");
  if (board) {
    board.classList.add("board-complete");

    // Advance Stage after animation
    setTimeout(() => {
      board.classList.remove("board-complete");

      // Localized Browser Alert
      const lang = getCurrentLang();
      const msg =
        translations[lang].alert_next_peaks || translations.es.alert_next_peaks;
      alert(msg);

      gameManager.advanceStage();
    }, 1500);
  }
}

function provideHint() {
  const gameSection = document.getElementById("memory-game");
  if (!gameSection || !gameSection.classList.contains("sudoku-mode")) return;

  const board = document.getElementById("memory-board");
  const slots = Array.from(board.querySelectorAll(".sudoku-chunk-slot"));

  if (slots.length !== 9) return;

  const state = gameManager.getState();
  const solution = state.data.solution;

  // 1. Gather all cells with their mapped coordinates
  const allCells = [];
  slots.forEach((slot) => {
    const slotIndex = parseInt(slot.dataset.slotIndex);
    const cells = Array.from(slot.querySelectorAll(".mini-cell"));
    cells.forEach((cell, localIndex) => {
      const row = Math.floor(slotIndex / 3) * 3 + Math.floor(localIndex / 3);
      const col = (slotIndex % 3) * 3 + (localIndex % 3);
      allCells.push({ element: cell, row, col });
    });
  });

  // 2. Sort by reading order (row then col)
  allCells.sort((a, b) => a.row - b.row || a.col - b.col);

  // 3. Find the FIRST empty or incorrect cell
  const target = allCells.find((cell) => {
    const val = cell.element.textContent.trim();
    const isIncorrect =
      cell.element.classList.contains("user-filled") &&
      parseInt(val) !== solution[cell.row][cell.col];
    const isEmpty = val === "" || cell.element.classList.contains("has-notes");
    return isEmpty || isIncorrect;
  });

  if (target) {
    const correctVal = solution[target.row][target.col];
    target.element.textContent = correctVal;
    target.element.classList.add("user-filled");
    target.element.classList.remove("has-notes", "error");

    // Clean up notes grid if any
    const notesGrid = target.element.querySelector(".notes-grid");
    if (notesGrid) notesGrid.remove();

    // Trigger validation (only triggers win if this was the last cell)
    validateBoard();
  }
}
