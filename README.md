# The Floor — Duel Game

A static browser game for a host to run two-player, image-based category duels.

## Folder layout
```
the-floor-game/
├── index.html            ← the game
├── answers.html          ← host answer sheet (open in a separate tab or on your phone)
├── css/style.css         ← all styling
├── js/
│   ├── categories.js     ← loads category data (shared by both pages)
│   ├── game.js           ← game logic
│   └── answers.js        ← answer sheet logic
└── categories/
    ├── list.json         ← which category folders to show, in order
    └── car-brands/       ← one folder per category
        ├── answers.json  ← category name + every image's answer
        ├── ferrari.jpg
        └── ...
```

## How the game works
- The home screen lists every category as a clickable tile; pick the time per player there.
- Each contestant has their own countdown; only the active contestant's clock runs.
- **Correct** shows the answer for 2 seconds (both clocks stopped), then switches the turn and shows the next image.
- **Skip** shows the answer for 3 seconds while the same contestant's clock keeps running (the skip penalty), then shows the next image.
- The first contestant whose clock reaches zero loses.
- Images appear in a fixed shuffled order for each **category + Round** (Round 1–10, chosen on the home screen). The same round always gives the same order; a different round gives a different order. If a duel runs past the last image it starts again from #1.
- The image number is shown in the corner of the picture on the TV.
- The reveal lengths are set at the top of `js/game.js` (`CORRECT_REVEAL_SECONDS` and `SKIP_REVEAL_SECONDS`).

## Host answer sheet (use it on your phone)
Open `answers.html` (on GitHub Pages: `<your URL>/answers.html`). Pick the **same category and round** as the game, and the answers are listed **1, 2, 3…** in exactly the order the TV shows them. When the TV shows image #12, row 12 on your phone is the answer. Tap a row to highlight it and scroll it to the top. The page remembers your last choice. Thumbnails with a red outline mean an image file couldn't be found.

Tip: use a new round number for each game so players can't learn the order.

## Controls
- Enter: Correct
- Space: Skip
- P: Pause / resume
- R: Restart duel (starts again from image #1)
- F: Full screen

## Adding your own images to an existing category
1. Copy the image into the category's folder, e.g. `categories/car-brands/mclaren.jpg`.
2. Open that folder's `answers.json` and add a line to the `images` list:
   ```json
   { "file": "mclaren.jpg", "answer": "McLaren" }
   ```
   Every line except the last needs a comma after its closing `}`.
3. Open `answers.html` to check the new image shows up (it warns you if a file can't be found).

## Adding a new category
1. Create a folder inside `categories/`, e.g. `categories/landmarks/`. Use lowercase letters and hyphens, no spaces.
2. Put the images in it.
3. Create `answers.json` in that folder:
   ```json
   {
     "name": "Famous Landmarks",
     "summary": "How well-travelled are you? Don't confuse the Arc de Triomphe with the Brandenburg Gate!",
     "images": [
       { "file": "eiffel-tower.jpg", "answer": "Eiffel Tower" },
       { "file": "big-ben.jpg", "answer": "Big Ben", "aliases": ["Elizabeth Tower"] },
       { "file": "colosseum.jpg", "answer": "Colosseum", "description": "Rome, Italy" }
     ]
   }
   ```
   - `name` is what appears on the home-screen tile.
   - `summary` (optional) is a one-line description of the category, shown under the category name in the "Who's starting?" popup.
   - `aliases` (optional) are other answers the host should accept.
   - `description` (optional) is an extra note for the host. It only shows on the answer sheet.
   - `fact` (optional) is a short fun fact shown on the TV under the answer, after Correct or Skip. Example: `"fact": "Led India's peaceful struggle for independence."`
4. Add the folder name to `categories/list.json`:
   ```json
   [
     "car-brands",
     "theme-parks",
     "movie-franchises",
     "landmarks"
   ]
   ```

### Text categories (no images)
A category can show words instead of pictures. Write `____` (four underscores) where the blank goes. See `categories/proverbs/answers.json`:
```json
{
  "name": "Finish the Proverb",
  "questions": [
    { "text": "Once ____, twice shy", "answer": "Bitten", "description": "Once bitten, twice shy" },
    { "text": "Easy ____, easy ____", "answer": "Come, Go" }
  ]
}
```
- For two blanks, separate the answers with a comma, in order.
- When the host presses Correct or Skip, the blanks fill in with the answer.

### Tips
- **File names are case-sensitive on GitHub Pages.** `Ferrari.JPG` and `ferrari.jpg` are different files online, even though Windows treats them as the same. If it works with Live Server but not online, check the capitals.
- Use JPG, PNG, WebP or SVG. Keep images reasonably small (under ~500 KB) so they appear instantly.
- Aim for 15+ images per category so the shuffle rarely repeats.
- A category needs at least 2 images to start.

## Run it locally
Open the folder in VS Code and use **Live Server** (right-click `index.html` → Open with Live Server). Double-clicking `index.html` won't work, because browsers block it from loading the JSON files.

## Publish with GitHub Pages
1. Create a GitHub repository, e.g. `the-floor-game`.
2. Upload the contents of this folder (not the folder itself) to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch `main` and folder `/ (root)`, then Save.
6. The URL will appear in the Pages settings once it's published. The answer sheet is at `<your URL>/answers.html`.

Images come from Wikimedia Commons (free licences) and Riot Games' Data Dragon (League of Legends, under Riot's fan-content policy). Each category folder has a `credits.txt` listing sources and licences, so keep those files when you publish.
