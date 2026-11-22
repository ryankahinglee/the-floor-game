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
  starter: 0,              // who goes first (picked in the "Who's starting?" popup)
  countdownId: null,       // the timer used by the 3, 2, 1 countdown
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
    tile.addEventListener("click", () => openStarterPicker(name));
    grid.appendChild(tile);
  });
}

// ---------- "Who's starting?" popup ----------

function openStarterPicker(categoryName) {
  const sourceQuestions = state.categories[categoryName] || [];
  if (sourceQuestions.length < 2) {
    $("loadStatus").textContent = `"${categoryName}" needs at least two images.`;
    return;
  }
  state.categoryName = categoryName;
  $("starterCategory").textContent = categoryName.toUpperCase();
  chooseStarter(state.starter);
  $("starterModal").classList.remove("hidden");
  document.querySelector(".starter-choice.selected").focus();
}

function isStarterPickerOpen() {
  return !$("starterModal").classList.contains("hidden");
}

// Highlight the chosen player (0 = Player 1, 1 = Player 2).
function chooseStarter(player) {
  state.starter = player;
  document.querySelectorAll(".starter-choice").forEach(button => {
    button.classList.toggle("selected", Number(button.dataset.player) === player);
  });
}

function closeStarterPicker() {
  $("starterModal").classList.add("hidden");
}

function confirmStarter() {
  Sound.unlock(); // browsers only allow sound after a click/keypress
  closeStarterPicker();
  startDuel();
}

// ---------- Starting the duel ----------

function startDuel() {
  state.startingSeconds = Number($("durationSelect").value);
  state.round = Number($("roundSelect").value);
  $("homeScreen").classList.add("hidden");
  $("resultScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  $("categoryHeading").textContent = `${state.categoryName} · Round ${state.round}`;
  resetDuel("Host: confirm the answer, then press Correct or Skip.");
}

// Puts both clocks back to full, sets up image #1, then runs the 3, 2, 1 countdown.
// The clock only starts once the countdown finishes.
// The image order is fixed for each category + round (see orderForRound in js/categories.js),
// so it matches the numbered list on the host's answer sheet.
function resetDuel(message) {
  stopClock();
  stopCountdown();
  Sound.stopMusic();
  state.questions =orderForRound(state.categoryName, state.categories[state.categoryName], state.round);
  state.questionIndex = 0;
  state.remaining = [state.startingSeconds, state.startingSeconds];
  state.activePlayer = state.starter;
  state.running = false; // stays false during the countdown, so Correct/Skip/Pause do nothing yet
  state.paused = false;
  state.finished = false;
  state.phase = "playing";
  hideAnswer();
  $("pauseBtn").textContent = "Ⅱ Pause";
  $("hostMessage").textContent = "Get ready…";
  render();
  runCountdown(() => {
    state.running = true;
    $("hostMessage").textContent = message;
    startClock();
    Sound.startMusic();
  });
}

// ---------- 3, 2, 1, START! ----------

// Shows 3 → 2 → 1 → START! (one second each), then calls onDone.
function runCountdown(onDone) {
  const steps = ["3", "2", "1", "START!"];
  let step = 0;
  const text = $("countdownText");
  const starterLabel = $("countdownStarter");
  starterLabel.textContent = `${state.players[state.starter]} starts`;
  starterLabel.style.color = state.starter === 0 ? "var(--p1)" : "var(--p2)";
  $("countdown").classList.remove("hidden");

  function showStep() {
    if (step >= steps.length) {
      stopCountdown();
      onDone();
      return;
    }
    text.textContent = steps[step];
    const isGo = step === steps.length - 1;
    text.classList.toggle("go", isGo);
    if (isGo) Sound.countdownGo(); else Sound.countdownBeep();
    // Restart the "pop" animation for each number.
    text.classList.remove("pop");
    void text.offsetWidth;
    text.classList.add("pop");
    step++;
    // START! stays up a little shorter than the numbers.
    state.countdownId = setTimeout(showStep, step === steps.length ? 700 : 1000);
  }
  showStep();
}

// Cancels the countdown (e.g. if the host presses Home) and hides it.
function stopCountdown() {
  if (state.countdownId) clearTimeout(state.countdownId);
  state.countdownId = null;
  $("countdown").classList.add("hidden");
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
  Sound.correct();
  $("hostMessage").textContent = `Correct! Turn passes to ${state.players[1 - state.activePlayer]} next.`;
  showAnswer("correct", CORRECT_REVEAL_SECONDS);
}

function skipQuestion() {
  if (!canJudge()) return;
  Sound.wrong();
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
  if (state.paused) {
    stopClock();
    Sound.stopMusic();
  } else {
    startClock();
    Sound.startMusic();
  }
}

function finishDuel(winnerIndex) {
  stopClock();
  Sound.stopMusic();
  Sound.timeUp();
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
  stopCountdown();
  Sound.stopMusic();
  closeStarterPicker();
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
// "Play again" asks who's starting again (same category).
$("againBtn").addEventListener("click", () => openStarterPicker(state.categoryName));
$("resultHomeBtn").addEventListener("click", showHome);
$("fullscreenBtn").addEventListener("click", toggleFullscreen);
$("gameFullscreenBtn").addEventListener("click", toggleFullscreen);

function updateMuteButton() {
  $("muteBtn").innerHTML = Sound.isMuted() ? "🔇 Muted <kbd>M</kbd>" : "🔊 Sound <kbd>M</kbd>";
}
function toggleMute() {
  Sound.toggleMute();
  updateMuteButton();
}
$("muteBtn").addEventListener("click", toggleMute);
updateMuteButton();

// "Who's starting?" popup buttons
document.querySelectorAll(".starter-choice").forEach(button => {
  button.addEventListener("click", () => chooseStarter(Number(button.dataset.player)));
  button.addEventListener("dblclick", confirmStarter); // double-click a player to start straight away
});
$("starterConfirmBtn").addEventListener("click", confirmStarter);
$("starterCancelBtn").addEventListener("click", closeStarterPicker);
// Clicking the dark area around the popup also cancels it.
$("starterModal").addEventListener("click", event => {
  if (event.target === $("starterModal")) closeStarterPicker();
});

document.addEventListener("keydown", event => {
  if (event.repeat || event.target.matches("input, select, textarea")) return;

  // While the popup is open, only its own keys work.
  if (isStarterPickerOpen()) {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmStarter();
    } else if (event.key === "Escape") {
      closeStarterPicker();
    } else if (event.key === "1" || event.key === "ArrowLeft") {
      chooseStarter(0);
    } else if (event.key === "2" || event.key === "ArrowRight") {
      chooseStarter(1);
    }
    return;
  }

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
  } else if (event.key.toLowerCase() === "m") {
    toggleMute();
  } else if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  }
});

buildRoundOptions();
loadCategories();
