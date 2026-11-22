const $ = (id) => document.getElementById(id);

// How long the answer stays on screen after the host decides (in seconds).
const CORRECT_REVEAL_SECONDS = 2; // both clocks are stopped while the answer shows
const SKIP_REVEAL_SECONDS = 3;    // the active player's clock KEEPS running (the skip penalty)

// How often the clock updates, in milliseconds. 100 ms = 10 times per second.
const TICK_MS = 100;

const state = {
  categories: {},
  categoryName: "",
  questions: [],
  questionIndex: 0,
  players: ["Player 1", "Player 2"],
  remaining: [45, 45],     // seconds left for each player (can include fractions)
  startingSeconds: 45,
  activePlayer: 0,
  running: false,
  paused: false,
  finished: false,
  // What's happening right now:
  //   "playing" = waiting for the host to judge the current image
  //   "correct" = showing the answer after a correct guess (clocks stopped)
  //   "skip"    = showing the answer after a skip (active clock still running)
  round: 1,               // which fixed image order to use (1–10), chosen on the home screen
  phase: "playing",
  revealLeft: 0,           // seconds left before the answer banner disappears
  intervalId: null,
  lastTick: 0              // the time (from performance.now) of the previous clock update
};

async function loadCategories() {
  try {
    // loadAllCategories() lives in js/categories.js
    const { categories, problems } = await loadAllCategories();
    state.categories = {};
    categories.forEach(category => {
      state.categories[category.name] = category.questions;
    });
    buildCategoryTiles();
    $("loadStatus").textContent = problems.join(" ");
  } catch (error) {
    $("loadStatus").textContent = `Couldn't load categories: ${error.message} (Tip: open the site with Live Server or GitHub Pages, not by double-clicking index.html.)`;
    console.error(error);
  }
}

// Fill the "Round" dropdown on the home screen with Round 1 … Round 10.
function buildRoundOptions() {
  const select = $("roundSelect");
  for (let round = 1; round <= ROUND_COUNT; round++) {
    const option = document.createElement("option");
    option.value = round;
    option.textContent = `Round ${round}`;
    select.appendChild(option);
  }
}

// Create one clickable tile on the home screen for every category in categories.json.
function buildCategoryTiles() {
  const grid = $("categoryGrid");
  grid.innerHTML = "";
  Object.entries(state.categories).forEach(([name, questions]) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "category-tile";

    const title = document.createElement("span");
    title.className = "tile-name";
    title.textContent = name;

    const count = document.createElement("span");
    count.className = "tile-count";
    count.textContent = `${questions.length} images`;

    tile.append(title, count);
    tile.addEventListener("click", () => startDuel(name));
    grid.appendChild(tile);
  });
}

function startDuel(categoryName) {
  const sourceQuestions = state.categories[categoryName] || [];
  if (sourceQuestions.length < 2) {
    $("loadStatus").textContent = `"${categoryName}" needs at least two images.`;
    return;
  }
  state.categoryName = categoryName;
  state.startingSeconds = Number($("durationSelect").value);
  state.round = Number($("roundSelect").value);
  $("homeScreen").classList.add("hidden");
  $("resultScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  $("categoryHeading").textContent = `${state.categoryName} · Round ${state.round}`;
  resetDuel("Host: confirm the answer, then press Correct or Skip.");
}

// Puts both clocks back to full and starts the duel from image #1.
// The image order is fixed for each category + round (see orderForRound in js/categories.js),
// so it matches the numbered list on the host's answer sheet.
function resetDuel(message) {
  stopClock();
  state.questions = orderForRound(state.categoryName, state.categories[state.categoryName], state.round);
  state.questionIndex = 0;
  state.remaining = [state.startingSeconds, state.startingSeconds];
  state.activePlayer = 0;
  state.running = true;
  state.paused = false;
  state.finished = false;
  state.phase = "playing";
  hideAnswer();
  $("pauseBtn").textContent = "Ⅱ Pause";
  $("hostMessage").textContent = message;
  render();
  startClock();
}

function render() {
  for (let i = 0; i < 2; i++) {
    $("playerName" + i).textContent = state.players[i];
    $("playerCard" + i).classList.toggle("active", i === state.activePlayer && !state.finished);
    updateTimerDisplay(i);
  }
  $("turnLabel").textContent = `${state.players[state.activePlayer].toUpperCase()}'S TURN`;
  $("questionCount").textContent = `IMAGE ${state.questionIndex + 1} / ${state.questions.length}`;
  $("imageNumber").textContent = state.questionIndex + 1;
  const question = state.questions[state.questionIndex];
  const img = $("questionImage");
  $("imageFallback").classList.add("hidden");
  img.classList.remove("hidden");
  img.onerror = () => {
    img.classList.add("hidden");
    $("imageFallback").classList.remove("hidden");
    $("imageFallbackPath").textContent = question.image;
  };
  img.src = question.image;
  img.alt = "Image for the current category question";
}

function updateTimerDisplay(index) {
  const exact = Math.max(0, state.remaining[index]);
  // Round UP so the clock shows 00:01 until the very last moment, like a real countdown.
  const seconds = Math.ceil(exact);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const timer = $("timer" + index);
  const bar = $("timerBar" + index);
  timer.textContent = `${mm}:${ss}`;
  bar.style.width = `${exact / state.startingSeconds * 100}%`;
  timer.classList.toggle("low", seconds <= 10);
  bar.classList.toggle("low", seconds <= 10);
}

function startClock() {
  stopClock();
  if (!state.running || state.paused || state.finished) return;
  state.lastTick = performance.now();
  state.intervalId = setInterval(tick, TICK_MS);
}

function stopClock() {
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = null;
}

// Runs 10 times a second. Instead of assuming exactly 0.1s passed, it measures
// the real time since the last update, so the clocks stay accurate.
function tick() {
  const now = performance.now();
  const elapsed = (now - state.lastTick) / 1000;
  state.lastTick = now;

  // The active player's clock runs while they're guessing AND during a skip reveal,
  // but not during the pause after a correct answer.
  if (state.phase !== "correct") {
    const player = state.activePlayer;
    state.remaining[player] = Math.max(0, state.remaining[player] - elapsed);
    updateTimerDisplay(player);
    if (state.remaining[player] <= 0) {
      finishDuel(1 - player);
      return;
    }
  }

  // Count down the answer banner, then move on.
  if (state.phase !== "playing") {
    state.revealLeft -= elapsed;
    if (state.revealLeft <= 0) endReveal();
  }
}

function canJudge() {
  return state.running && !state.paused && !state.finished && state.phase === "playing";
}

function markCorrect() {
  if (!canJudge()) return;
  $("hostMessage").textContent = `Correct! Turn passes to ${state.players[1 - state.activePlayer]} next.`;
  showAnswer("correct", CORRECT_REVEAL_SECONDS);
}

function skipQuestion() {
  if (!canJudge()) return;
  $("hostMessage").textContent = `Skipped. ${state.players[state.activePlayer]}'s clock keeps running.`;
  showAnswer("skip", SKIP_REVEAL_SECONDS);
}

// Shows the answer banner over the image for a few seconds.
function showAnswer(kind, seconds) {
  state.phase = kind;
  state.revealLeft = seconds;
  const banner = $("answerReveal");
  banner.classList.remove("hidden", "correct", "skip");
  banner.classList.add(kind);
  $("revealLabel").textContent = kind === "correct" ? "CORRECT" : "SKIPPED";
  $("answerText").textContent = state.questions[state.questionIndex].answer;
  $("correctBtn").disabled = true;
  $("skipBtn").disabled = true;
}

function hideAnswer() {
  $("answerReveal").classList.add("hidden");
  $("correctBtn").disabled = false;
  $("skipBtn").disabled = false;
}

// Called when the answer banner's time is up.
function endReveal() {
  if (state.phase === "correct") state.activePlayer = 1 - state.activePlayer;
  state.phase = "playing";
  hideAnswer();
  $("hostMessage").textContent = `${state.players[state.activePlayer]}, you're up.`;
  nextQuestion();
}

function nextQuestion() {
  state.questionIndex++;
  if (state.questionIndex >= state.questions.length) {
    // If the duel outlasts the category, start again from #1 (same order as the answer sheet).
    state.questionIndex = 0;
  }
  render();
}

function togglePause() {
  if (!state.running || state.finished) return;
  state.paused = !state.paused;
  $("pauseBtn").textContent = state.paused ? "▶ Resume" : "Ⅱ Pause";
  $("hostMessage").textContent = state.paused ? "Game paused. Both timers are stopped." : "Game resumed.";
  if (state.paused) stopClock(); else startClock();
}

function finishDuel(winnerIndex) {
  stopClock();
  state.finished = true;
  state.running = false;
  state.phase = "playing";
  hideAnswer();
  $("gameScreen").classList.add("hidden");
  $("resultScreen").classList.remove("hidden");
  $("winnerHeading").textContent = `${state.players[winnerIndex]} wins!`;
  $("resultDescription").textContent = `${state.players[1 - winnerIndex]}'s timer reached zero in ${state.categoryName}.`;
}

function restartDuel() {
  // Only allowed from the game or result screen, not from the home screen.
  if (!state.categoryName || !$("homeScreen").classList.contains("hidden")) return;
  $("resultScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  resetDuel("Duel restarted. Good luck!");
}

function revealAnswer() {
  if (!state.questions.length || state.finished) return;
  $("hostMessage").textContent = `Answer: ${state.questions[state.questionIndex].answer}`;
}

function showHome() {
  stopClock();
  state.running = false;
  state.finished = false;
  state.phase = "playing";
  hideAnswer();
  $("gameScreen").classList.add("hidden");
  $("resultScreen").classList.add("hidden");
  $("homeScreen").classList.remove("hidden");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

$("correctBtn").addEventListener("click", markCorrect);
$("skipBtn").addEventListener("click", skipQuestion);
$("pauseBtn").addEventListener("click", togglePause);
$("restartBtn").addEventListener("click", restartDuel);
$("homeBtn").addEventListener("click", showHome);
$("revealBtn").addEventListener("click", revealAnswer);
$("againBtn").addEventListener("click", restartDuel);
$("resultHomeBtn").addEventListener("click", showHome);
$("fullscreenBtn").addEventListener("click", toggleFullscreen);
$("gameFullscreenBtn").addEventListener("click", toggleFullscreen);

document.addEventListener("keydown", event => {
  if (event.repeat || event.target.matches("input, select, textarea")) return;
  const onGameScreen = !$("gameScreen").classList.contains("hidden");
  // Game shortcuts only apply during a duel, so Enter/Space still work normally
  // on the home screen (e.g. to click a category tile with the keyboard).
  if (onGameScreen && event.code === "Enter") {
    event.preventDefault();
    markCorrect();
  } else if (onGameScreen && event.code === "Space") {
    event.preventDefault();
    skipQuestion();
  } else if (onGameScreen && event.key.toLowerCase() === "p") {
    togglePause();
  } else if (event.key.toLowerCase() === "r") {
    restartDuel();
  } else if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  }
});

buildRoundOptions();
loadCategories();
