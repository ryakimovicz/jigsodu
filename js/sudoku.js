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

    // Check for errors/completion? (Add logic later if needed)
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
  selectedCell.classList.remove("user-filled", "has-notes");
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
