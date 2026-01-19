import { gameManager } from "./game-manager.js";
import { translations } from "./translations.js";

// DOM Elements
let memorySection;
let boardContainer;
let cardsContainer;
let collectedLeft;
let collectedRight;

// State
let cards = [];
let flippedCards = [];
let isLocked = false;
let matchesFound = 0;
let panelCount = 0;
const TOTAL_PAIRS = 9;

export function initMemoryGame() {
  console.log("Initializing Memory Game...");

  // 1. Get Elements
  memorySection = document.getElementById("memory-game");
  boardContainer = document.getElementById("memory-board");
  cardsContainer = document.getElementById("memory-cards");
  collectedLeft = document.getElementById("collected-left");
  collectedRight = document.getElementById("collected-right");

  // Info Icon Mobile Interaction
  const infoWrapper = document.querySelector(".info-icon-wrapper");
  if (infoWrapper) {
    infoWrapper.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent closing immediately
      infoWrapper.classList.toggle("active");
    });

    // Close when clicking outside
    document.addEventListener("click", () => {
      infoWrapper.classList.remove("active");
    });
  }

  // 2. Show Section (and Hide Home)
  if (memorySection) {
    memorySection.classList.remove("hidden");
    document.getElementById("menu-content")?.classList.add("hidden");
  }

  // 3. Load Data
  const state = gameManager.getState();
  if (!state || !state.data || !state.data.initialPuzzle) {
    console.error("No game data found!");
    return;
  }

  // Reset State
  cards = [];
  flippedCards = [];
  isLocked = false;
  matchesFound = 0;
  panelCount = 0;
  cardsContainer.innerHTML = "";
  collectedLeft.innerHTML = "";
  collectedRight.innerHTML = "";

  // Reset Board Slots
  setupBoard(state.data.initialPuzzle);

  // 5. Setup Cards
  const puzzleChunks = getChunksFromBoard(state.data.initialPuzzle);
  setupCards(puzzleChunks);
}

function getChunksFromBoard(board) {
  const chunks = [];
  for (let tr = 0; tr < 3; tr++) {
    for (let tc = 0; tc < 3; tc++) {
      const chunk = [];
      for (let r = 0; r < 3; r++) {
        const row = [];
        for (let c = 0; c < 3; c++) {
          row.push(board[tr * 3 + r][tc * 3 + c]);
        }
        chunk.push(row);
      }
      chunks.push(chunk);
    }
  }
  return chunks;
}

function setupBoard() {
  boardContainer.innerHTML = "";
  // Create 9 placeholder slots for the chunks to land in.
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement("div");
    slot.classList.add("sudoku-chunk-slot");
    slot.dataset.slotIndex = i;
    boardContainer.appendChild(slot);
  }
}

function setupCards(chunks) {
  // Generate 18 cards (9 pairs)
  const deck = [];

  chunks.forEach((chunk, index) => {
    // Pair 1
    deck.push({ id: `pair-${index}-a`, chunkIndex: index, chunkData: chunk });
    // Pair 2
    deck.push({ id: `pair-${index}-b`, chunkIndex: index, chunkData: chunk });
  });

  // Shuffle
  shuffleArray(deck);

  // Render
  deck.forEach((cardData) => {
    const cardEl = createCardElement(cardData);
    cardsContainer.appendChild(cardEl);
    cards.push(cardEl);
  });

  // Preview Phase
  previewCards();
}

function previewCards() {
  isLocked = true;
  // Flip all to show content
  cards.forEach((card) => card.classList.add("flipped"));

  setTimeout(() => {
    // Unflip all
    cards.forEach((card) => card.classList.remove("flipped"));
    isLocked = false;
  }, 2000); // 2 Seconds
}

// Helper to render mini grid
function createMiniGrid(chunkData) {
  const table = document.createElement("div");
  table.classList.add("mini-sudoku-grid");
  chunkData.forEach((row) => {
    row.forEach((num) => {
      const cell = document.createElement("div");
      cell.classList.add("mini-cell");
      cell.textContent = num !== 0 ? num : "";
      if (num !== 0) cell.classList.add("has-number");
      table.appendChild(cell);
    });
  });
  return table;
}

function createCardElement(data) {
  const card = document.createElement("div");
  card.classList.add("memory-card");
  card.dataset.chunkIndex = data.chunkIndex;

  const inner = document.createElement("div");
  inner.classList.add("memory-card-inner");

  const front = document.createElement("div");
  front.classList.add("memory-card-front");
  front.textContent = "?";

  const back = document.createElement("div");
  back.classList.add("memory-card-back");

  back.appendChild(createMiniGrid(data.chunkData));

  inner.appendChild(front);
  inner.appendChild(back);
  card.appendChild(inner);

  card.addEventListener("click", () => handleCardClick(card));

  return card;
}

function handleCardClick(card) {
  if (isLocked) return;
  if (card === flippedCards[0]) return; // Clicked same card
  if (card.classList.contains("flipped")) return; // Already matched/flipped

  flipCard(card);
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    checkForMatch();
  }
}

function flipCard(card) {
  card.classList.add("flipped");
}

function unflipCards() {
  isLocked = true;
  setTimeout(() => {
    flippedCards.forEach((card) => card.classList.remove("flipped"));
    flippedCards = [];
    isLocked = false;
  }, 1000);
}

function checkForMatch() {
  const [card1, card2] = flippedCards;
  const idx1 = card1.dataset.chunkIndex;
  const idx2 = card2.dataset.chunkIndex;

  if (idx1 === idx2) {
    disableCards();
    handleMatchSuccess(idx1);
  } else {
    unflipCards();
  }
}

function disableCards() {
  flippedCards.forEach((card) => {
    card.style.pointerEvents = "none";
    // Optional: fade them out or keep them until we place the prize?
    // We will keep them for a moment then maybe remove them if we want to simulate "moving"
    // But for now we just spawn the prize and leave cards (or hide them).
    // Instead of hiding, we mark them as matched/disabled visually
    // card.style.visibility = "hidden"; // Removed per user request
    card.classList.add("matched");
  });
  flippedCards = [];
}

function handleMatchSuccess(chunkIndex) {
  matchesFound++;
  console.log(`Matched Pair for Chunk ${chunkIndex}!`);

  setTimeout(() => {
    const idx = parseInt(chunkIndex);
    if (idx === 4) {
      placeInBoard(idx);
    } else {
      placeInPanel(idx);
    }

    // Check Win
    if (matchesFound === TOTAL_PAIRS) {
      setTimeout(() => {
        alert("¡Juego Completado! Próximamente: Jigsaw Stage");
      }, 1000);
    }
  }, 600); // Wait slightly for card flip to finish and "flight" logic (simulated by delay)
}

function placeInBoard(chunkIndex) {
  const slot = boardContainer.querySelector(
    `[data-slot-index="${chunkIndex}"]`,
  );
  if (slot) {
    slot.innerHTML = "";
    slot.classList.add("filled");

    const state = gameManager.getState();
    const chunks = getChunksFromBoard(state.data.initialPuzzle);
    const chunkData = chunks[chunkIndex];

    const content = createMiniGrid(chunkData);
    // Maybe ensure it fills the slot perfectly?
    content.style.width = "100%";
    content.style.height = "100%";

    slot.appendChild(content);
  }
}

function placeInPanel(chunkIndex) {
  panelCount++;
  // 1-4 -> Left, 5-8 -> Right
  let targetContainer = panelCount <= 4 ? collectedLeft : collectedRight;

  const state = gameManager.getState();
  const chunks = getChunksFromBoard(state.data.initialPuzzle);
  const chunkData = chunks[chunkIndex];

  const piece = document.createElement("div");
  piece.classList.add("collected-piece");
  piece.appendChild(createMiniGrid(chunkData));

  targetContainer.appendChild(piece);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
