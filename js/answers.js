// The host's answer sheet (answers.html), designed for a phone.
// Pick the same category + round as the game, and the answers are listed 1, 2, 3…
// in exactly the order the TV shows the images (see orderForRound in js/categories.js).
// Tap a row to highlight it and scroll it to the top.

const byId = (id) => document.getElementById(id);
const SAVED_KEY = "floorAnswerSheet"; // remembers your last category + round on this phone
let allCategories = [];

async function initAnswerSheet() {
  try {
    // loadAllCategories() lives in js/categories.js
    const { categories, problems } = await loadAllCategories();
    allCategories = categories;
    fillPickers();
    byId("loadStatus").textContent = problems.join(" ");
    showList();
  } catch (error) {
    byId("loadStatus").textContent = `Couldn't load categories: ${error.message}`;
    console.error(error);
  }
}

function fillPickers() {
  const categoryPicker = byId("categoryPicker");
  allCategories.forEach((category, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = category.name;
    categoryPicker.appendChild(option);
  });
  const roundPicker = byId("roundPicker");
  for (let round = 1; round <= ROUND_COUNT; round++) {
    const option = document.createElement("option");
    option.value = round;
    option.textContent = `Round ${round}`;
    roundPicker.appendChild(option);
  }

  // Restore the last choice made on this phone (if any).
  const saved = readSaved();
  const savedIndex = allCategories.findIndex(c => c.name === saved.category);
  if (savedIndex >= 0) categoryPicker.value = savedIndex;
  if (saved.round) roundPicker.value = saved.round;

  categoryPicker.addEventListener("change", showList);
  roundPicker.addEventListener("change", showList);
}

function showList() {
  const category = allCategories[Number(byId("categoryPicker").value)];
  const round = Number(byId("roundPicker").value);
  if (!category) return;
  writeSaved({ category: category.name, round });

  const list = byId("answerList");
  list.innerHTML = "";
  byId("missingStatus").classList.add("hidden");
  let missing = 0;

  orderForRound(category.name, category.questions, round).forEach((question, index) => {
    const row = document.createElement("li");
    row.className = "answer-row";

    const number = document.createElement("span");
    number.className = "answer-number";
    number.textContent = index + 1;

    const text = document.createElement("div");
    text.className = "answer-text-block";
    const name = document.createElement("div");
    name.className = "answer-row-name";
    name.textContent = question.answer;
    text.appendChild(name);
    const extra = [];
    if (question.aliases.length) extra.push(`also: ${question.aliases.join(", ")}`);
    if (question.description) extra.push(question.description);
    if (extra.length) {
      const small = document.createElement("div");
      small.className = "answer-row-extra";
      small.textContent = extra.join(" · ");
      text.appendChild(small);
    }

    const thumb = document.createElement("img");
    thumb.className = "answer-row-thumb";
    thumb.src = question.image;
    thumb.alt = "";
    thumb.loading = "lazy";
    thumb.onerror = () => {
      if (row.classList.contains("missing")) return;
      row.classList.add("missing");
      missing++;
      const status = byId("missingStatus");
      status.textContent = `⚠ ${missing} image${missing === 1 ? "" : "s"} in this category couldn't be found (marked in red). Check the file names in answers.json.`;
      status.classList.remove("hidden");
    };

    row.append(number, text, thumb);
    row.addEventListener("click", () => highlightRow(row));
    list.appendChild(row);
  });
}

// Mark a row as "current" and scroll it to just below the sticky bar.
function highlightRow(row) {
  document.querySelectorAll(".answer-row.current").forEach(r => r.classList.remove("current"));
  row.classList.add("current");
  row.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Saving is a convenience only, so failures (e.g. private browsing) are ignored.
function readSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || {}; } catch { return {}; }
}
function writeSaved(value) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(value)); } catch { /* ignore */ }
}

initAnswerSheet();
