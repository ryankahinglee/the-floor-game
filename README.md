# The Floor — Duel Game (starter)

A static browser game designed for a host to run two-player, image-based category duels.

## Included mechanics
- Host manually judges answers.
- Each contestant has an individual countdown timer.
- Only the active contestant's timer runs.
- Correct switches the turn and advances to the next image.
- Skip advances to the next image without switching turns or adding a penalty.
- Pause, restart, reveal answer, full-screen mode and keyboard shortcuts.
- Images are shuffled at the start of each duel and reshuffled if the category runs out.

## Run it locally
Because the app loads `categories.json` with `fetch`, run it through a local web server rather than opening `index.html` directly.

If you have Python installed:
```bash
cd the-floor-game
python -m http.server 8000
```
Then open http://localhost:8000

## Publish with GitHub Pages
1. Create a GitHub repository, e.g. `the-floor-game`.
2. Upload the contents of this folder (not the folder itself) to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch `main` and folder `/ (root)`, then Save.
6. Wait for GitHub Pages to publish the site. The URL will appear in the Pages settings.

## Add your own images and categories
Edit `categories.json`. Each category is an array of questions:
```json
"Category Name": [
  {
    "image": "images/category-name/example.jpg",
    "answer": "Example answer",
    "aliases": ["Alternative accepted answer"]
  }
]
```
- Put the image file at the path in `image`.
- Paths are relative to the repository root and are case-sensitive.
- Use JPG, PNG, WebP or SVG.
- Add aliases for spelling variants or alternate names for your host's reference. The starter game does not auto-check answers; aliases are reference notes only.
- Keep image files reasonably compressed. Avoid uploading huge originals.

## Current starter categories
- Car Brands
- Theme Parks
- Movie Franchises

The included SVGs are labelled placeholders, not real quiz images. Replace each placeholder with an image you have permission to use, keeping the same filename, or update the corresponding path in `categories.json`.

## Controls
- Enter: Correct answer / switch turn
- Space: Skip image (same contestant continues)
- P: Pause / resume
- R: Restart duel

## Important behaviour choices
This starter uses a simple host-led flow: a correct answer passes the turn; a skip does not. Both contestants start with the same duration. The first contestant whose timer reaches zero loses. You can change these rules in `game.js`.
