/* Browser implementation of checkers with Minimax and MCTS algorithm support.
   Developed by: Md. Safiul Islam & Md. Mesbaul Islam */
const screens = {
  welcome: document.querySelector("#welcome-screen"),
  mode: document.querySelector("#mode-screen"),
  game: document.querySelector("#game-screen"),
};

const boardElement = document.querySelector("#board");
const statusMessage = document.querySelector("#status-message");
const turnText = document.querySelector("#turn-text");
const turnPiece = document.querySelector("#turn-piece");
const whiteCount = document.querySelector("#white-count");
const blackCount = document.querySelector("#black-count");
const modeLabel = document.querySelector("#mode-label");
const modeAlgoSummary = document.querySelector("#mode-algo-summary");
const headerModeBadge = document.querySelector("#header-mode-badge");
const whiteRole = document.querySelector("#white-role");
const blackRole = document.querySelector("#black-role");
const whitePlayerBox = document.querySelector("#white-player-box");
const blackPlayerBox = document.querySelector("#black-player-box");
const backToModeButton = document.querySelector("#back-to-mode-button");

// Algorithm display elements
const activeAlgoBadge = document.querySelector("#active-algo-badge");
const activeAlgoDesc = document.querySelector("#active-algo-desc");
const statusIndicatorDot = document.querySelector("#status-indicator-dot");
const ctrlHumanAi = document.querySelector("#ctrl-human-ai");
const ctrlAiAi = document.querySelector("#ctrl-ai-ai");
const ctrlHumanHuman = document.querySelector("#ctrl-human-human");

const modeNames = {
  "human-human": "Human vs Human",
  "human-ai": "Human vs AI",
  "ai-ai": "AI vs AI",
};

const algorithmMetadata = {
  minimax: {
    label: "Minimax",
    badgeClass: "algo-badge-minimax",
    fullName: "Minimax (Alpha-Beta Pruning)",
    shortDesc: "Minimax with Alpha-Beta",
  },
  mcts: {
    label: "MCTS",
    badgeClass: "algo-badge-mcts",
    fullName: "MCTS (Monte Carlo Tree Search)",
    shortDesc: "Monte Carlo Tree Search",
  },
  human: {
    label: "Human",
    badgeClass: "algo-badge-human",
    fullName: "Human (Manual)",
    shortDesc: "Manual Player",
  },
};

// Pre-game settings configured from mode selection screen
const pregameSettings = window.pregameSettings || {
  humanAi: "minimax",
  aiVsAiWhite: "minimax",
  aiVsAiBlack: "mcts",
  timeLimit: 0, // In seconds: 0 = No Limit (unlimited), 60, 120, 180, 300
};
window.pregameSettings = pregameSettings;

let state;
let aiTimer;
let gameTimerInterval = null;

function createInitialState(mode) {
  const pieces = [];
  for (let position = 0; position < 12; position += 1) pieces.push({ position, color: "B", king: false });
  for (let position = 20; position < 32; position += 1) pieces.push({ position, color: "W", king: false });

  const aiAlgorithms = {
    W: mode === "ai-ai" ? pregameSettings.aiVsAiWhite : "human",
    B: mode === "ai-ai" ? pregameSettings.aiVsAiBlack : (mode === "human-ai" ? pregameSettings.humanAi : "human"),
  };

  const newState = {
    pieces,
    turn: "W",
    selected: null,
    validMoves: [],
    winner: null,
    drawReason: null,
    mode,
    chainPiece: null,
    quietMoves: 0,
    positionHistory: new Map(),
    aiAlgorithms,
    timeLimit: pregameSettings.timeLimit,
    timeRemaining: pregameSettings.timeLimit,
    timeExpired: false,
    timeExpiredReason: null,
  };
  newState.positionHistory.set(positionKey(newState), 1);
  return newState;
}

function formatTime(seconds) {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function updateTimerDisplay() {
  if (!state) return;
  const timerDisplayHeader = document.querySelector("#timer-display-header");
  const timerDisplayPanel = document.querySelector("#timer-display-panel");
  const liveTimerHeader = document.querySelector("#live-timer-header");
  const timerPanelBar = document.querySelector("#timer-panel-bar");

  if (state.timeLimit === 0) {
    if (liveTimerHeader) liveTimerHeader.classList.add("is-hidden");
    if (timerPanelBar) timerPanelBar.classList.add("is-hidden");
    return;
  }

  const timeStr = formatTime(state.timeRemaining);
  if (timerDisplayHeader) timerDisplayHeader.textContent = timeStr;
  if (timerDisplayPanel) timerDisplayPanel.textContent = timeStr;

  const isWarning = state.timeRemaining <= 30 && state.timeRemaining > 10;
  const isCritical = state.timeRemaining <= 10;

  if (liveTimerHeader) {
    liveTimerHeader.classList.remove("is-hidden");
    liveTimerHeader.classList.toggle("is-warning", isWarning);
    liveTimerHeader.classList.toggle("is-critical", isCritical);
  }
  if (timerPanelBar) {
    timerPanelBar.classList.remove("is-hidden");
    timerPanelBar.classList.toggle("is-warning", isWarning);
    timerPanelBar.classList.toggle("is-critical", isCritical);
  }
}

function startTimer() {
  clearInterval(gameTimerInterval);
  if (state.timeLimit > 0) {
    updateTimerDisplay();
    gameTimerInterval = setInterval(() => {
      if (state.winner) {
        clearInterval(gameTimerInterval);
        return;
      }
      state.timeRemaining -= 1;
      updateTimerDisplay();
      if (state.timeRemaining <= 0) {
        clearInterval(gameTimerInterval);
        handleTimeExpired();
      }
    }, 1000);
  } else {
    updateTimerDisplay();
  }
}

function handleTimeExpired() {
  if (state.winner) return;
  clearTimeout(aiTimer);
  clearInterval(gameTimerInterval);
  state.timeExpired = true;

  const whitePieces = state.pieces.filter((p) => p.color === "W");
  const blackPieces = state.pieces.filter((p) => p.color === "B");
  const whiteKings = whitePieces.filter((p) => p.king).length;
  const blackKings = blackPieces.filter((p) => p.king).length;

  if (whitePieces.length > blackPieces.length) {
    state.winner = "W";
    state.timeExpiredReason = `Time expired! White wins on piece advantage (${whitePieces.length} pieces vs ${blackPieces.length} pieces).`;
  } else if (blackPieces.length > whitePieces.length) {
    state.winner = "B";
    state.timeExpiredReason = `Time expired! Black wins on piece advantage (${blackPieces.length} pieces vs ${whitePieces.length} pieces).`;
  } else {
    // Equal total pieces: tiebreaker by king count
    if (whiteKings > blackKings) {
      state.winner = "W";
      state.timeExpiredReason = `Time expired! Tied on pieces (${whitePieces.length} each), White wins on king advantage (${whiteKings} kings vs ${blackKings} kings).`;
    } else if (blackKings > whiteKings) {
      state.winner = "B";
      state.timeExpiredReason = `Time expired! Tied on pieces (${blackPieces.length} each), Black wins on king advantage (${blackKings} kings vs ${whiteKings} kings).`;
    } else {
      state.winner = "DRAW";
      state.drawReason = `Time expired! Match ended in a draw on equal material (${whitePieces.length} pieces, ${whiteKings} kings each).`;
      state.timeExpiredReason = state.drawReason;
    }
  }

  updatePanel();
  renderBoard();
}

function otherColor(color) {
  return color === "W" ? "B" : "W";
}

function coordinates(position) {
  const row = Math.floor(position / 4);
  const column = (position % 4) * 2 + (row % 2);
  return { row, column };
}

function positionAt(row, column) {
  if (row < 0 || row > 7 || column < 0 || column > 7 || (column - (row % 2) + 2) % 2 !== 0) return null;
  return row * 4 + Math.floor((column - (row % 2)) / 2);
}

function pieceAt(position) {
  return state.pieces.find((piece) => piece.position === position) || null;
}

function moveDirections(piece) {
  const directions = [];
  const { row, column } = coordinates(piece.position);
  if (piece.king || piece.color === "W") {
    directions.push([-1, -1], [-1, 1]);
  }
  if (piece.king || piece.color === "B") {
    directions.push([1, -1], [1, 1]);
  }
  return directions.map(([rowDelta, columnDelta]) => ({
    row: row + rowDelta,
    column: column + columnDelta,
  }));
}

function getPieceMoves(piece, includeSimple = true) {
  const moves = [];
  const current = coordinates(piece.position);
  for (const adjacent of moveDirections(piece)) {
    const adjacentPosition = positionAt(adjacent.row, adjacent.column);
    if (adjacentPosition === null) continue;
    const blockingPiece = pieceAt(adjacentPosition);
    if (!blockingPiece) {
      if (includeSimple) moves.push({ to: adjacentPosition, capture: null });
      continue;
    }
    if (blockingPiece.color === piece.color) continue;
    const landingRow = adjacent.row + (adjacent.row - current.row);
    const landingColumn = adjacent.column + (adjacent.column - current.column);
    const landingPosition = positionAt(landingRow, landingColumn);
    if (landingPosition !== null && !pieceAt(landingPosition)) {
      moves.push({ to: landingPosition, capture: adjacentPosition });
    }
  }
  const captures = moves.filter((move) => move.capture !== null);
  return captures.length ? captures : moves;
}

function legalMoves(color = state.turn) {
  const moves = [];
  state.pieces.forEach((piece, index) => {
    if (piece.color !== color) return;
    if (state.chainPiece !== null && piece.position !== state.chainPiece) return;
    getPieceMoves(piece).forEach((move) => moves.push({ index, ...move }));
  });
  const captures = moves.filter((move) => move.capture !== null);
  return captures.length ? captures : moves;
}

function canInteract() {
  if (state.winner) return false;
  if (state.mode === "ai-ai") return false;
  if (state.mode === "human-ai" && state.turn === "B") return false;
  return true;
}

function renderBoard() {
  boardElement.innerHTML = "";
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const position = positionAt(row, column);
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(position === null ? "light" : "dark")}`;
      square.setAttribute("role", "gridcell");
      if (position === null) {
        square.disabled = true;
      } else {
        square.dataset.position = position;
        if (state.selected === position) square.classList.add("selected");
        if (state.validMoves.some((move) => move.to === position)) square.classList.add("valid");
        const piece = pieceAt(position);
        if (piece) {
          const pieceElement = document.createElement("span");
          pieceElement.className = `piece ${piece.color === "W" ? "white-piece" : "black-piece"}${piece.king ? " king" : ""}`;
          square.append(pieceElement);
          square.setAttribute("aria-label", `${piece.color === "W" ? "White" : "Black"}${piece.king ? " king" : ""} piece`);
        } else {
          square.setAttribute("aria-label", `Empty square ${position}`);
        }
        square.addEventListener("click", () => handleSquareClick(position));
      }
      boardElement.append(square);
    }
  }
  updatePanel();
}

function updatePanel() {
  const whitePieces = state.pieces.filter((piece) => piece.color === "W").length;
  const blackPieces = state.pieces.filter((piece) => piece.color === "B").length;
  whiteCount.textContent = whitePieces;
  blackCount.textContent = blackPieces;

  // Determine current active algorithm based on turn and mode
  let activeAlgoKey = "human";
  const isComputerTurn = state.mode === "ai-ai" || (state.mode === "human-ai" && state.turn === "B");
  if (isComputerTurn && !state.winner) {
    activeAlgoKey = state.aiAlgorithms[state.turn] || "minimax";
  }

  const activeMeta = algorithmMetadata[activeAlgoKey] || algorithmMetadata.minimax;

  // Update Turn Text with active algorithm context
  if (state.timeExpired) {
    turnText.textContent = state.winner === "DRAW"
      ? "Time's up — Draw!"
      : `${state.winner === "W" ? "White" : "Black"} wins on time!`;
  } else if (state.winner === "DRAW") {
    turnText.textContent = "It's a draw!";
  } else if (state.winner) {
    turnText.textContent = `${state.winner === "W" ? "White" : "Black"} wins!`;
  } else {
    const turnColorName = state.turn === "W" ? "White" : "Black";
    if (isComputerTurn) {
      turnText.textContent = `${turnColorName}'s turn (${activeMeta.label})`;
    } else {
      turnText.textContent = `${turnColorName}'s turn`;
    }
  }

  turnPiece.className = `mini-piece ${state.turn === "W" ? "white-piece" : "black-piece"}`;
  modeLabel.textContent = modeNames[state.mode];
  if (headerModeBadge) headerModeBadge.textContent = modeNames[state.mode];

  // Update Player Role and Scoreboard Box Highlights
  if (whiteRole) {
    whiteRole.textContent = state.mode === "ai-ai"
      ? `AI (${algorithmMetadata[state.aiAlgorithms.W]?.label || "Minimax"})`
      : "Human";
  }
  if (blackRole) {
    blackRole.textContent = state.mode === "human-human"
      ? "Human"
      : `AI (${algorithmMetadata[state.aiAlgorithms.B]?.label || "Minimax"})`;
  }
  if (whitePlayerBox) whitePlayerBox.classList.toggle("is-active-turn", state.turn === "W" && !state.winner);
  if (blackPlayerBox) blackPlayerBox.classList.toggle("is-active-turn", state.turn === "B" && !state.winner);

  // Update Mode Summary with algorithm specifics
  if (state.mode === "human-human") {
    modeAlgoSummary.textContent = "Two players (Manual moves)";
  } else if (state.mode === "human-ai") {
    const bAlgoMeta = algorithmMetadata[state.aiAlgorithms.B] || algorithmMetadata.minimax;
    modeAlgoSummary.textContent = `Computer AI: ${bAlgoMeta.fullName}`;
  } else if (state.mode === "ai-ai") {
    const wAlgoMeta = algorithmMetadata[state.aiAlgorithms.W] || algorithmMetadata.minimax;
    const bAlgoMeta = algorithmMetadata[state.aiAlgorithms.B] || algorithmMetadata.mcts;
    modeAlgoSummary.textContent = `White: ${wAlgoMeta.label} vs Black: ${bAlgoMeta.label}`;
  }

  // Update Algorithm Badge
  activeAlgoBadge.className = `algo-badge ${activeMeta.badgeClass}`;
  activeAlgoBadge.textContent = activeMeta.label;

  // Update Status and Indicator Dot
  if (state.timeExpired) {
    statusMessage.textContent = state.timeExpiredReason;
    activeAlgoDesc.textContent = "Match concluded by time limit.";
    statusIndicatorDot.classList.remove("active");
  } else if (state.winner === "DRAW") {
    statusMessage.textContent = state.drawReason;
    activeAlgoDesc.textContent = "Game ended in a draw.";
    statusIndicatorDot.classList.remove("active");
  } else if (state.winner) {
    statusMessage.textContent = "Great game! Start a new game to play again.";
    activeAlgoDesc.textContent = `${state.winner === "W" ? "White" : "Black"} crowned winner!`;
    statusIndicatorDot.classList.remove("active");
  } else if (state.chainPiece !== null) {
    statusMessage.textContent = "Another capture is available with this piece.";
    activeAlgoDesc.textContent = isComputerTurn
      ? `Continuing chained jump with ${activeMeta.label}`
      : "Mandatory continuation jump.";
    if (isComputerTurn) statusIndicatorDot.classList.add("active");
    else statusIndicatorDot.classList.remove("active");
  } else if (isComputerTurn) {
    statusMessage.textContent = `The computer is thinking using ${activeMeta.fullName}...`;
    activeAlgoDesc.textContent = `Computing move with ${activeMeta.fullName}`;
    statusIndicatorDot.classList.add("active");
  } else {
    statusIndicatorDot.classList.remove("active");
    if (state.mode === "human-ai") {
      activeAlgoDesc.textContent = "Your turn (White). AI waiting on Black.";
    } else {
      activeAlgoDesc.textContent = "Human player moves directly.";
    }
    statusMessage.textContent = state.validMoves.length ? "Choose a highlighted destination." : "Select a piece to begin.";
  }

  // Update in-game control groups visibility
  ctrlHumanAi.classList.toggle("is-hidden", state.mode !== "human-ai");
  ctrlAiAi.classList.toggle("is-hidden", state.mode !== "ai-ai");
  ctrlHumanHuman.classList.toggle("is-hidden", state.mode !== "human-human");

  // Sync in-game toggle buttons active state
  document.querySelectorAll(".in-game-toggle").forEach((btn) => {
    const color = btn.dataset.color;
    const algo = btn.dataset.algo;
    if (state.aiAlgorithms[color] === algo) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  updateTimerDisplay();
}

function handleSquareClick(position) {
  if (!canInteract()) return;
  const selectedMove = state.validMoves.find((move) => move.to === position);
  if (selectedMove) {
    performMove(selectedMove);
    return;
  }
  const piece = pieceAt(position);
  if (!piece || piece.color !== state.turn) return;
  const moves = legalMoves().filter((move) => move.index === state.pieces.indexOf(piece));
  if (!moves.length) return;
  state.selected = position;
  state.validMoves = moves;
  renderBoard();
}

function performMove(move) {
  const piece = state.pieces[move.index];
  const wasKing = piece.king;
  piece.position = move.to;
  if (move.capture !== null) state.pieces = state.pieces.filter((candidate) => candidate.position !== move.capture);
  const row = coordinates(piece.position).row;
  if (!piece.king && ((piece.color === "W" && row === 0) || (piece.color === "B" && row === 7))) piece.king = true;
  if (move.capture !== null || (!wasKing && piece.king)) state.quietMoves = 0;
  else state.quietMoves += 1;
  state.selected = null;
  state.validMoves = [];
  const nextCaptures = move.capture === null ? [] : getPieceMoves(piece).filter((candidate) => candidate.capture !== null);
  if (nextCaptures.length) {
    state.selected = piece.position;
    state.validMoves = nextCaptures;
    state.chainPiece = piece.position;
  } else {
    state.chainPiece = null;
    state.turn = otherColor(state.turn);
  }
  recordPosition();
  checkWinner();
  renderBoard();
  scheduleAiIfNeeded();
}

function checkWinner() {
  if (state.winner) return;
  if (!state.pieces.some((piece) => piece.color === "W")) state.winner = "B";
  else if (!state.pieces.some((piece) => piece.color === "B")) state.winner = "W";
  else if (!legalMoves(state.turn).length) state.winner = otherColor(state.turn);
  else if (state.positionHistory.get(positionKey()) >= 3) {
    state.winner = "DRAW";
    state.drawReason = "The same position occurred three times.";
  } else if (state.quietMoves >= 80) {
    state.winner = "DRAW";
    state.drawReason = "Draw: 40 moves by each side without a capture or promotion.";
  }

  if (state.winner) {
    clearInterval(gameTimerInterval);
  }
}

function positionKey(gameState = state) {
  const pieces = gameState.pieces
    .map((piece) => `${piece.color}${piece.king ? "K" : "M"}${piece.position}`)
    .sort()
    .join(",");
  return `${gameState.turn}|${gameState.chainPiece ?? "-"}|${pieces}`;
}

function recordPosition() {
  const key = positionKey();
  state.positionHistory.set(key, (state.positionHistory.get(key) || 0) + 1);
}

/* ==========================================================================
   SIMULATION ENGINE FOR MINIMAX AND MCTS
   ========================================================================== */

function cloneSimState(s) {
  const pieces = new Array(s.pieces.length);
  for (let i = 0; i < s.pieces.length; i += 1) {
    const p = s.pieces[i];
    pieces[i] = { position: p.position, color: p.color, king: p.king };
  }
  return {
    pieces,
    turn: s.turn,
    chainPiece: s.chainPiece,
  };
}

function simPieceAt(simState, position) {
  for (let i = 0; i < simState.pieces.length; i += 1) {
    if (simState.pieces[i].position === position) return simState.pieces[i];
  }
  return null;
}

function getSimPieceMoves(simState, piece) {
  const moves = [];
  const current = coordinates(piece.position);
  const dirs = [];
  if (piece.king || piece.color === "W") dirs.push([-1, -1], [-1, 1]);
  if (piece.king || piece.color === "B") dirs.push([1, -1], [1, 1]);

  for (let i = 0; i < dirs.length; i += 1) {
    const [dr, dc] = dirs[i];
    const adjRow = current.row + dr;
    const adjCol = current.column + dc;
    const adjPos = positionAt(adjRow, adjCol);
    if (adjPos === null) continue;

    const blocking = simPieceAt(simState, adjPos);
    if (!blocking) {
      moves.push({ to: adjPos, capture: null });
      continue;
    }
    if (blocking.color === piece.color) continue;

    const landRow = adjRow + dr;
    const landCol = adjCol + dc;
    const landPos = positionAt(landRow, landCol);
    if (landPos !== null && !simPieceAt(simState, landPos)) {
      moves.push({ to: landPos, capture: adjPos });
    }
  }

  const captures = moves.filter((m) => m.capture !== null);
  return captures.length ? captures : moves;
}

function getSimLegalMoves(simState, color = simState.turn) {
  const moves = [];
  const pieces = simState.pieces;
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i];
    if (piece.color !== color) continue;
    if (simState.chainPiece !== null && piece.position !== simState.chainPiece) continue;

    const pMoves = getSimPieceMoves(simState, piece);
    for (let j = 0; j < pMoves.length; j += 1) {
      moves.push({ index: i, ...pMoves[j] });
    }
  }
  const captures = moves.filter((m) => m.capture !== null);
  return captures.length ? captures : moves;
}

function applySimMove(simState, move) {
  const piece = simState.pieces[move.index];
  piece.position = move.to;

  if (move.capture !== null) {
    simState.pieces = simState.pieces.filter((p) => p.position !== move.capture);
  }

  const row = Math.floor(piece.position / 4);
  if (!piece.king && ((piece.color === "W" && row === 0) || (piece.color === "B" && row === 7))) {
    piece.king = true;
  }

  if (move.capture !== null) {
    const nextCaptures = getSimPieceMoves(simState, piece).filter((m) => m.capture !== null);
    if (nextCaptures.length > 0) {
      simState.chainPiece = piece.position;
      return;
    }
  }

  simState.chainPiece = null;
  simState.turn = otherColor(simState.turn);
}

function checkSimWinner(simState) {
  let hasWhite = false;
  let hasBlack = false;
  for (let i = 0; i < simState.pieces.length; i += 1) {
    if (simState.pieces[i].color === "W") hasWhite = true;
    else hasBlack = true;
  }
  if (!hasWhite) return "B";
  if (!hasBlack) return "W";

  const legal = getSimLegalMoves(simState);
  if (legal.length === 0) {
    return otherColor(simState.turn);
  }
  return null;
}

function evaluateSimBoard(simState, myColor) {
  let score = 0;
  const oppColor = otherColor(myColor);

  for (let i = 0; i < simState.pieces.length; i += 1) {
    const piece = simState.pieces[i];
    const { row, column } = coordinates(piece.position);
    let pieceVal = piece.king ? 180 : 100;

    if (!piece.king) {
      if (piece.color === "W") pieceVal += (7 - row) * 5;
      else pieceVal += row * 5;

      if ((piece.color === "W" && row === 7) || (piece.color === "B" && row === 0)) {
        pieceVal += 12;
      }
    } else {
      const centerDist = Math.abs(row - 3.5) + Math.abs(column - 3.5);
      pieceVal += Math.round((7 - centerDist) * 3);
    }

    if (column === 0 || column === 7) pieceVal += 4;

    if (piece.color === myColor) score += pieceVal;
    else score -= pieceVal;
  }

  const myMobility = getSimLegalMoves(simState, myColor).length;
  const oppMobility = getSimLegalMoves(simState, oppColor).length;
  score += (myMobility - oppMobility) * 3;

  return score;
}

/* ==========================================================================
   ALGORITHM 1: MINIMAX WITH ALPHA-BETA PRUNING
   ========================================================================== */

function minimaxSearch(simState, depth, alpha, beta, isMaximizing, myColor) {
  const winner = checkSimWinner(simState);
  if (winner !== null) {
    if (winner === myColor) return 10000 + depth * 100;
    if (winner === otherColor(myColor)) return -10000 - depth * 100;
    return 0;
  }

  if (depth <= 0) {
    return evaluateSimBoard(simState, myColor);
  }

  const moves = getSimLegalMoves(simState);
  if (moves.length === 0) {
    return simState.turn === myColor ? -10000 - depth * 100 : 10000 + depth * 100;
  }

  if (isMaximizing) {
    let maxVal = -Infinity;
    for (let i = 0; i < moves.length; i += 1) {
      const nextState = cloneSimState(simState);
      applySimMove(nextState, moves[i]);
      const nextIsMax = nextState.turn === myColor;
      const val = minimaxSearch(nextState, depth - 1, alpha, beta, nextIsMax, myColor);
      if (val > maxVal) maxVal = val;
      if (val > alpha) alpha = val;
      if (beta <= alpha) break;
    }
    return maxVal;
  } else {
    let minVal = Infinity;
    for (let i = 0; i < moves.length; i += 1) {
      const nextState = cloneSimState(simState);
      applySimMove(nextState, moves[i]);
      const nextIsMax = nextState.turn === myColor;
      const val = minimaxSearch(nextState, depth - 1, alpha, beta, nextIsMax, myColor);
      if (val < minVal) minVal = val;
      if (val < beta) beta = val;
      if (beta <= alpha) break;
    }
    return minVal;
  }
}

function getMinimaxMove(currentState, depth = 4) {
  const simState = cloneSimState(currentState);
  const moves = getSimLegalMoves(simState);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const myColor = simState.turn;
  let bestScore = -Infinity;
  let bestMoves = [];
  let alpha = -Infinity;

  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    const nextState = cloneSimState(simState);
    applySimMove(nextState, move);
    const nextIsMax = nextState.turn === myColor;
    const score = minimaxSearch(nextState, depth - 1, alpha, Infinity, nextIsMax, myColor);

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
    if (score > alpha) alpha = score;
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/* ==========================================================================
   ALGORITHM 2: MONTE CARLO TREE SEARCH (MCTS)
   ========================================================================== */

class MCTSNode {
  constructor(simState, parent = null, move = null) {
    this.state = simState;
    this.parent = parent;
    this.move = move;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.untriedMoves = getSimLegalMoves(simState);
    this.winner = checkSimWinner(simState);
    this.isTerminal = this.winner !== null || this.untriedMoves.length === 0;
  }

  isFullyExpanded() {
    return this.untriedMoves.length === 0;
  }

  bestUCTChild(c = 1.414) {
    let best = null;
    let bestVal = -Infinity;
    const logN = Math.log(Math.max(1, this.visits));

    for (let i = 0; i < this.children.length; i += 1) {
      const child = this.children[i];
      const winRate = child.wins / child.visits;
      const uct = winRate + c * Math.sqrt(logN / child.visits);
      if (uct > bestVal) {
        bestVal = uct;
        best = child;
      }
    }
    return best;
  }
}

function getMCTSMove(currentState, iterations = 500, maxPlayoutDepth = 16) {
  const simState = cloneSimState(currentState);
  const rootMoves = getSimLegalMoves(simState);
  if (rootMoves.length === 0) return null;
  if (rootMoves.length === 1) return rootMoves[0];

  const rootPlayer = simState.turn;
  const root = new MCTSNode(simState);

  for (let iter = 0; iter < iterations; iter += 1) {
    // 1. Selection
    let node = root;
    while (!node.isTerminal && node.isFullyExpanded() && node.children.length > 0) {
      node = node.bestUCTChild();
    }

    // 2. Expansion
    if (!node.isTerminal && node.untriedMoves.length > 0) {
      const move = node.untriedMoves.pop();
      const nextState = cloneSimState(node.state);
      applySimMove(nextState, move);
      const child = new MCTSNode(nextState, node, move);
      node.children.push(child);
      node = child;
    }

    // 3. Rollout / Simulation
    let rolloutState = cloneSimState(node.state);
    let outcome = 0.5;
    let rolloutWinner = checkSimWinner(rolloutState);

    if (rolloutWinner !== null) {
      outcome = rolloutWinner === rootPlayer ? 1.0 : (rolloutWinner === otherColor(rootPlayer) ? 0.0 : 0.5);
    } else {
      let depth = 0;
      while (depth < maxPlayoutDepth) {
        const moves = getSimLegalMoves(rolloutState);
        if (moves.length === 0) {
          const w = otherColor(rolloutState.turn);
          outcome = w === rootPlayer ? 1.0 : 0.0;
          break;
        }

        const captures = moves.filter((m) => m.capture !== null);
        const chosen = captures.length > 0
          ? captures[Math.floor(Math.random() * captures.length)]
          : moves[Math.floor(Math.random() * moves.length)];

        applySimMove(rolloutState, chosen);
        depth += 1;

        const currentWin = checkSimWinner(rolloutState);
        if (currentWin !== null) {
          outcome = currentWin === rootPlayer ? 1.0 : (currentWin === otherColor(rootPlayer) ? 0.0 : 0.5);
          break;
        }
      }

      if (depth >= maxPlayoutDepth) {
        const evalScore = evaluateSimBoard(rolloutState, rootPlayer);
        if (evalScore > 50) outcome = 1.0;
        else if (evalScore < -50) outcome = 0.0;
        else outcome = 0.5;
      }
    }

    // 4. Backpropagation
    let curr = node;
    while (curr !== null) {
      curr.visits += 1;
      curr.wins += outcome;
      curr = curr.parent;
    }
  }

  // Choose child with maximum visits
  let bestChild = null;
  let maxVisits = -1;
  for (let i = 0; i < root.children.length; i += 1) {
    const child = root.children[i];
    if (child.visits > maxVisits) {
      maxVisits = child.visits;
      bestChild = child;
    }
  }

  return bestChild ? bestChild.move : rootMoves[0];
}

/* ==========================================================================
   AI MOVE DISPATCHER & SCHEDULER
   ========================================================================== */

function aiMove() {
  const moves = legalMoves();
  if (!moves.length) {
    checkWinner();
    renderBoard();
    return;
  }

  const currentAlgo = state.aiAlgorithms[state.turn] || "minimax";
  let selectedMove;

  if (currentAlgo === "mcts") {
    selectedMove = getMCTSMove(state, 500);
  } else {
    selectedMove = getMinimaxMove(state, 4);
  }

  if (!selectedMove) {
    selectedMove = moves[0];
  }

  performMove(selectedMove);
}

function scheduleAiIfNeeded() {
  if (state.winner) return;
  const isComputerTurn = state.mode === "ai-ai" || (state.mode === "human-ai" && state.turn === "B");
  if (!isComputerTurn) return;

  clearTimeout(aiTimer);
  aiTimer = setTimeout(aiMove, 550);
}

function startGame(mode) {
  clearTimeout(aiTimer);
  clearInterval(gameTimerInterval);
  state = createInitialState(mode);
  screens.welcome.classList.add("is-hidden");
  screens.mode.classList.add("is-hidden");
  screens.game.classList.remove("is-hidden");
  renderBoard();
  startTimer();
  scheduleAiIfNeeded();
}

/* ==========================================================================
   EVENT LISTENERS & CONTROLS
   ========================================================================== */

// Navigation
document.querySelector("#lets-play-button").addEventListener("click", () => {
  screens.welcome.classList.add("is-hidden");
  screens.mode.classList.remove("is-hidden");
});

document.querySelector("#back-to-welcome").addEventListener("click", () => {
  screens.mode.classList.add("is-hidden");
  screens.welcome.classList.remove("is-hidden");
});

if (backToModeButton) {
  backToModeButton.addEventListener("click", () => {
    clearTimeout(aiTimer);
    clearInterval(gameTimerInterval);
    screens.game.classList.add("is-hidden");
    screens.mode.classList.remove("is-hidden");
  });
}

document.querySelectorAll(".mode-option").forEach((button) => {
  button.addEventListener("click", () => startGame(button.dataset.mode));
});

document.querySelector("#new-game-button").addEventListener("click", () => startGame(state.mode));

// Mode Screen Time Limit Picker
function selectTimeLimit(seconds) {
  seconds = parseInt(seconds, 10);
  if (isNaN(seconds)) seconds = 0;
  pregameSettings.timeLimit = seconds;

  const buttons = document.querySelectorAll("#mode-time-picker button");
  buttons.forEach((btn) => {
    const btnTime = parseInt(btn.dataset.time, 10);
    if (btnTime === seconds) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const pill = document.querySelector("#time-limit-indicator-pill");
  if (pill) {
    if (seconds === 0) {
      pill.textContent = "No Limit";
    } else {
      pill.textContent = `${Math.floor(seconds / 60)} Min Limit`;
    }
  }
}
window.selectTimeLimit = selectTimeLimit;

// Direct click binding & event delegation for maximum reliability
document.querySelectorAll("#mode-time-picker button").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const seconds = parseInt(btn.dataset.time, 10);
    selectTimeLimit(seconds);
  });
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("#mode-time-picker button");
  if (btn && btn.dataset && btn.dataset.time !== undefined) {
    const seconds = parseInt(btn.dataset.time, 10);
    selectTimeLimit(seconds);
  }
});

// Mode Screen Algorithm Picker: Human vs AI
document.querySelectorAll("#mode-human-ai-picker .algo-toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#mode-human-ai-picker .algo-toggle-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    pregameSettings.humanAi = btn.dataset.algo;
  });
});

// Mode Screen Algorithm Picker: AI vs AI Matchup
document.querySelectorAll("#mode-ai-vs-ai-picker .algo-toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#mode-ai-vs-ai-picker .algo-toggle-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const matchup = btn.dataset.matchup;
    if (matchup === "minimax-mcts") {
      pregameSettings.aiVsAiWhite = "minimax";
      pregameSettings.aiVsAiBlack = "mcts";
    } else if (matchup === "mcts-minimax") {
      pregameSettings.aiVsAiWhite = "mcts";
      pregameSettings.aiVsAiBlack = "minimax";
    } else if (matchup === "minimax-minimax") {
      pregameSettings.aiVsAiWhite = "minimax";
      pregameSettings.aiVsAiBlack = "minimax";
    } else if (matchup === "mcts-mcts") {
      pregameSettings.aiVsAiWhite = "mcts";
      pregameSettings.aiVsAiBlack = "mcts";
    }
  });
});

// In-Game Algorithm Toggles
document.querySelectorAll(".in-game-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const color = btn.dataset.color;
    const algo = btn.dataset.algo;
    if (!state || !state.aiAlgorithms) return;

    state.aiAlgorithms[color] = algo;
    updatePanel();
  });
});
