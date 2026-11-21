const $ = (id) => document.getElementById(id);

const state = {
  categories: {},
  categoryName: "",
  questions: [],
  questionIndex: 0,
  players: ["Player 1", "Player 2"],
  remaining: [45, 45],
  startingSeconds: 45,
  activePlayer: 0,
  running: false,
  paused: false,
  finished: false,
  intervalId: null,
  skipTimeout: null,
  duelNumber: 0
};

async function loadCategories() {
  try {
    const response = await fetch("./categories.json");
    if (!response.ok) throw new Error("Could not load categories.json");
    state.categories = await response.json();
    const select = $("categorySelect");
    select.innerHTML = "";
    Object.keys(state.categories).forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    $("loadStatus").textContent = `${Object.keys(state.categories).length} sample categories loaded. Replace the placeholder images with your own.`;
    $("startBtn").disabled = false;
  } catch (error) {
    $("loadStatus").textContent = "Couldn't load categories. Open the site through GitHub Pages or a local web server (not by double-clicking index.html).";
    $("startBtn").disabled = true;
    console.error(error);
  }
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startDuel() {
  stopClock();
  clearTimeout(state.skipTimeout);
  const categoryName = $("categorySelect").value;
  const sourceQuestions = state.categories[categoryName] || [];
  if (sourceQuestions.length < 2) {
    $("loadStatus").textContent = "This category needs at least two images.";
    return;
  }
  state.categoryName = categoryName;
  state.questions = shuffle(sourceQuestions);
  state.questionIndex = 0;
  state.players = [
    $("player1Input").value.trim() || "Player 1",
    $("player2Input").value.trim() || "Player 2"
  ];
  state.startingSeconds = Number($("durationSelect").value);
  state.remaining = [state.startingSeconds, state.startingSeconds];
  state.activePlayer = 0;
  state.running = true;
  state.paused = false;
  state.finished = false;
  state.duelNumber++;
  $("setupScreen").classList.add("hidden");
  $("resultScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  $("categoryHeading").textContent = state.categoryName;
  $("pauseBtn").textContent = "Ⅱ Pause";
  $("hostMessage").textContent = "Host: confirm the answer, then pass the turn.";
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
  const question = state.questions[state.questionIndex];
  const img = $("questionImage");
  $("imageFallback").classList.add("hidden");
  img.classList.remove("hidden");
  img.onerror = () => {
    img.classList.add("hidden");
    $("imageFallback").classList.remove("hidden");
  };
  img.src = question.image;
  img.alt = "Image for the current category question";
}

function updateTimerDisplay(index) {
  const seconds = Math.max(0, state.remaining[index]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const timer = $("timer" + index);
  const bar = $("timerBar" + index);
  timer.textContent = `${mm}:${ss}`;
  const percent = Math.max(0, seconds / state.startingSeconds * 100);
  bar.style.width = `${percent}%`;
  timer.classList.toggle("low", seconds <= 10);
  bar.classList.toggle("low", seconds <= 10);
}

function startClock() {
  stopClock();
  if (!state.running || state.paused || state.finished) return;
  state.intervalId = setInterval(() => {
    state.remaining[state.activePlayer] = Math.max(0, state.remaining[state.activePlayer] - 1);
    updateTimerDisplay(state.activePlayer);
    if (state.remaining[state.activePlayer] <= 0) finishDuel(1 - state.activePlayer);
  }, 1000);
}

function stopClock() {
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = null;
}

function markCorrect() {
  if (!state.running || state.paused || state.finished) return;
  const current = state.questions[state.questionIndex];
  $("hostMessage").textContent = `Correct: ${current.answer}. Turn passes to ${state.players[1 - state.activePlayer]}.`;
  state.activePlayer = 1 - state.activePlayer;
  nextQuestion();
}

function skipQuestion() {
  if (!state.running || state.paused || state.finished) return;
  const current = state.questions[state.questionIndex];
  $("hostMessage").textContent = `Skipped: ${current.answer}. Same contestant continues.`;
  nextQuestion();
}

function nextQuestion() {
  state.questionIndex++;
  if (state.questionIndex >= state.questions.length) {
    // Recycle a freshly shuffled set if the duel lasts longer than the category.
    state.questions = shuffle(state.questions);
    state.questionIndex = 0;
  }
  render();
  startClock();
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
  clearTimeout(state.skipTimeout);
  state.finished = true;
  state.running = false;
  $("gameScreen").classList.add("hidden");
  $("resultScreen").classList.remove("hidden");
  $("winnerHeading").textContent = `${state.players[winnerIndex]} wins!`;
  $("resultDescription").textContent = `${state.players[1 - winnerIndex]}'s timer reached zero in ${state.categoryName}.`;
}

function restartDuel() {
  if (!state.categoryName) return;
  stopClock();
  clearTimeout(state.skipTimeout);
  state.remaining = [state.startingSeconds, state.startingSeconds];
  state.activePlayer = 0;
  state.questionIndex = 0;
  state.questions = shuffle(state.categories[state.categoryName]);
  state.paused = false;
  state.finished = false;
  state.running = true;
  $("resultScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  $("pauseBtn").textContent = "Ⅱ Pause";
  $("hostMessage").textContent = "Duel restarted. Good luck!";
  render();
  startClock();
}

function revealAnswer() {
  if (!state.questions.length || state.finished) return;
  $("hostMessage").textContent = `Answer: ${state.questions[state.questionIndex].answer}`;
}

function showSetup() {
  stopClock();
  clearTimeout(state.skipTimeout);
  state.running = false;
  state.finished = false;
  $("gameScreen").classList.add("hidden");
  $("resultScreen").classList.add("hidden");
  $("setupScreen").classList.remove("hidden");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

$("startBtn").addEventListener("click", startDuel);
$("correctBtn").addEventListener("click", markCorrect);
$("skipBtn").addEventListener("click", skipQuestion);
$("pauseBtn").addEventListener("click", togglePause);
$("restartBtn").addEventListener("click", restartDuel);
$("newDuelBtn").addEventListener("click", showSetup);
$("revealBtn").addEventListener("click", revealAnswer);
$("againBtn").addEventListener("click", restartDuel);
$("setupAgainBtn").addEventListener("click", showSetup);
$("fullscreenBtn").addEventListener("click", toggleFullscreen);

document.addEventListener("keydown", event => {
  if (event.repeat || event.target.matches("input, select, textarea")) return;
  if (event.code === "Enter") {
    event.preventDefault();
    markCorrect();
  } else if (event.code === "Space") {
    event.preventDefault();
    skipQuestion();
  } else if (event.key.toLowerCase() === "p") {
    togglePause();
  } else if (event.key.toLowerCase() === "r") {
    restartDuel();
  }
});

loadCategories();
