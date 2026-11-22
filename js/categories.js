// Loads all category data. Used by BOTH the game (index.html) and the answer sheet (answers.html).
//
// How the data is organised:
//   categories/list.json              → the category folder names, in the order they're shown
//   categories/<folder>/answers.json  → the category's display name + each image and its answer
//   categories/<folder>/<image file>  → the images themselves

const CATEGORIES_FOLDER = "categories";

// Downloads a JSON file and turns it into JavaScript data, with friendly error messages.
async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Couldn't find ${path}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${path} has a formatting mistake (check for missing commas, quotes or brackets).`);
  }
}

// ---------- Fixed ("deterministic") shuffling ----------
// The game and the answer sheet must show images in EXACTLY the same order, so the host
// can read answer #12 on their phone while image #12 is on the TV.
// Instead of Math.random(), we use a "seeded" random generator: the same seed always
// produces the same sequence. The seed comes from the category name + round number,
// so each round number gives a different (but repeatable) order.

const ROUND_COUNT = 10;

// Turns text into a number (a simple "hash").
function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// A small, well-known seeded random number generator ("mulberry32").
// Each call returns a number between 0 and 1, always the same sequence for the same seed.
function seededRandom(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns the questions of a category in the fixed order for the given round (1–10).
function orderForRound(categoryName, questions, round) {
  const random = seededRandom(hashText(`${categoryName}#${round}`));
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Returns { categories, problems }.
//   categories: [{ folder, name, questions: [{ image, file, answer, aliases, description, fact }] }]
//   problems:   a list of messages about any category that couldn't be loaded
async function loadAllCategories() {
  const folders = await fetchJson(`${CATEGORIES_FOLDER}/list.json`);
  const categories = [];
  const problems = [];

  for (const folder of folders) {
    try {
      const data = await fetchJson(`${CATEGORIES_FOLDER}/${folder}/answers.json`);
      // Image categories list "images"; text categories (like proverbs) list "questions".
      // A question can have a "file" (shows an image) or a "text" (shows words, ____ = blank).
      const questions = (data.questions || data.images || []).map(item => ({
        file: item.file || "",
        image: item.file ? `${CATEGORIES_FOLDER}/${folder}/${item.file}` : "",
        text: item.text || "",
        answer: item.answer || "(no answer written)",
        aliases: item.aliases || [],
        description: item.description || "",
        fact: item.fact || ""          // optional fun fact shown on the TV with the answer
      }));
      // "summary" (optional) is a one-line description shown in the "Who's starting?" popup.
      categories.push({ folder, name: data.name || folder, summary: data.summary || "", questions });
    } catch (error) {
      problems.push(error.message);
    }
  }

  return { categories, problems };
}
