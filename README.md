# SmartChef — Ingredient Scanner

A working prototype of the "SmartChef Ingredient Scanner" feature proposed in Task 7.3HD:
photograph the ingredients you have, get them recognised automatically, confirm/edit the
list, and get matching recipes with an interactive step-by-step cooking guide.

**Live flow:** Home → Scan (camera) → Confirm ingredients → Recipe results → Cooking mode,
with a manual-entry path available at every point for accessibility, privacy, or devices
without a camera — matching the fallback described in the original proposal.

This document is written as a tutorial: enough for another developer to understand *how*
each piece works and implement something similar themselves, not just what the code does.

---

## 1. Quick start

No build step, no server-side code, no API keys.

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000 in a browser
```

A local server is required (rather than opening `index.html` directly) because the app
`fetch()`s `data/recipes.json` and `data/ingredient-map.json`, which most browsers block
under the `file://` protocol.

Camera access also requires either `localhost` or HTTPS — browsers refuse
`getUserMedia()` on a plain `http://` address that isn't localhost. This means the deployed
version needs HTTPS (GitHub Pages provides this automatically).

## 2. Architecture overview

```
 index.html  (single-page app, 5 screens toggled by JS)
      │
      ├── css/style.css        – design tokens, phone-frame layout
      │
      ├── js/camera.js         – MediaDevices.getUserMedia() wrapper
      ├── js/recognition.js    – TensorFlow.js MobileNet classification
      ├── js/recipes.js        – recipe data + ingredient-based matching
      ├── js/cooking.js        – step-by-step cooking mode controller
      ├── js/app.js            – screen navigation + wires everything together
      │
      └── data/
           ├── recipes.json          – local recipe "database"
           └── ingredient-map.json   – MobileNet label → ingredient name
```

Each JS file is an IIFE that attaches a single namespaced object to `window`
(`SmartChefCamera`, `SmartChefRecognition`, `SmartChefRecipes`, `SmartChefCooking`).
`app.js` is the only file that touches the DOM outside its own screen and coordinates the
others — this keeps the camera, ML and recipe-matching logic independently testable and
reusable outside this specific UI.

## 3. The ingredient scanner, step by step

### 3.1 Requesting the camera (`camera.js`)

```js
const constraints = { video: { facingMode: { ideal: "environment" } }, audio: false };
activeStream = await navigator.mediaDevices.getUserMedia(constraints);
videoEl.srcObject = activeStream;
```

`facingMode: { ideal: "environment" }` prefers the rear camera on phones (better for
photographing ingredients on a bench) but degrades gracefully to any available camera if
the device doesn't support the hint. The stream is stored so it can be explicitly stopped
(`stream.getTracks().forEach(t => t.stop())`) the moment the user leaves the scan screen —
this matters for the **privacy** requirement in the proposal: the camera should never run
longer than the user needs it to.

### 3.2 Capturing a still frame

A hidden `<canvas>` is sized to match the live `<video>` element's resolution, and
`ctx.drawImage(videoEl, 0, 0, width, height)` copies the current frame into it. The
canvas is then handed directly to the recognition model — no image ever leaves the device.

### 3.3 Recognising ingredients, without a backend (`recognition.js`)

The proposal explicitly warns that **API credentials should not be exposed in client-side
JavaScript**. Since this prototype has no backend to hide a key behind, the cleanest way to
honour that constraint is to not use a keyed API at all: recognition runs **entirely in the
browser** using [TensorFlow.js](https://www.tensorflow.org/js) with a pre-trained
[MobileNet](https://github.com/tensorflow/tfjs-models/tree/master/mobilenet) image
classifier, loaded once from a CDN and cached by the browser:

```js
model = await mobilenet.load({ version: 2, alpha: 1.0 });
const predictions = await model.classify(canvas, topK); // runs on-device
```

**Known limitation (worth stating plainly, not hiding):** MobileNet is trained on the
general-purpose ImageNet dataset, which only contains a limited set of whole-food classes —
mostly fruit and vegetables such as banana, broccoli, mushroom, bell pepper and corn (the
full list is in `data/ingredient-map.json`). It cannot reliably recognise things like a
carton of eggs, a block of cheese or a clove of garlic, because ImageNet has no class for
them. This isn't a bug to be fixed by prompt-tweaking; it's a genuine constraint of using a
general-purpose, no-cost, client-side model instead of a paid, ingredient-specific vision
API. It's precisely *why* the original proposal's own flow never trusts recognition
blindly — every scan lands on a **Confirm ingredients** screen where the user can remove
wrong guesses and add anything the model missed, and a **manual entry** path exists for
when scanning isn't useful at all. The prototype leans into that design rather than working
around the model's limits.

Raw ImageNet labels are mapped to SmartChef's own ingredient vocabulary through
`ingredient-map.json`, and predictions below a confidence threshold are discarded:

```js
predictions.forEach(p => {
  if (p.probability < minConfidence) return;
  const name = ingredientMap[p.className];
  if (name) found.add(name);
});
```

### 3.4 Confirming and editing ingredients

The confirm screen renders every ingredient with a badge showing whether it was
`detected` (from the scan) or `added` (typed manually), each with a remove button, plus an
"add ingredient" input. This screen is shared by both the scan path and the manual-entry
path, so the rest of the app never needs to know which one the user took.

### 3.5 Matching recipes (`recipes.js`)

Recipes are stored locally in `data/recipes.json`, each tagged with the ingredients it
needs. Matching is a simple overlap score:

```js
const matched = recipe.ingredients.filter(i => have.has(i)).length;
score = matched / recipe.ingredients.length;
```

Recipes are sorted by score (highest ingredient-overlap first) and anything with zero
overlap is filtered out. In a production version, this is the point where a real recipe API
(e.g. Spoonacular or Edamam) would replace the local JSON file — the matching function's
interface (`ingredients in`, `ranked recipes out`) wouldn't need to change.

### 3.6 Interactive cooking mode (`cooking.js`)

A small state machine tracks `stepIndex` against `recipe.steps`, an array of plain-language
instructions. Progress dots and the "Next / Previous" buttons simply move that index and
re-render the current step's text — deliberately simple so it's easy to extend (e.g. adding
per-step timers) without restructuring anything.

## 4. Design factors from the proposal, and how they were addressed

| Factor | How it's addressed |
|---|---|
| **Usability** | Clear, single-action buttons per screen (Scan, Confirm, Find recipes) matching the proposal's five wireframe screens; one primary action per screen. |
| **Accessibility** | "Enter ingredients manually" is available from the home screen, the scan screen, and as the natural result of editing on the confirm screen — never a dead end if the camera can't be used. All interactive elements are real `<button>`/`<input>` elements with visible keyboard focus states and `aria-label`s on icon-only buttons. |
| **Performance** | The MobileNet model is loaded once (in the background, while the user is still on the home screen) and cached in memory for the rest of the session, rather than reloaded per scan. The camera stream is released as soon as it's not needed. |
| **Privacy** | The camera is only requested when the user taps "Scan my ingredients," the stream is stopped the moment they leave that screen, and no image is ever uploaded anywhere — classification happens entirely on-device. |
| **Security** | No API keys exist in this codebase at all, sidestepping the "don't expose credentials in client-side JS" risk entirely, by design rather than by obfuscation. |
| **Feasibility** | Built with nothing but browser APIs and static hosting — no backend to provision, deploy or pay for, which matches the proposal's note that the camera functionality "can be implemented using browser APIs." |

## 5. Extending this prototype

- **Swap in a real recipe API:** replace `loadRecipes()` in `recipes.js` with a `fetch()` to
  a recipe API, keeping `matchRecipes()`'s signature the same.
- **Improve recognition accuracy:** replace `mobilenet.load()` with a model fine-tuned on a
  food/ingredient dataset (e.g. via [teachablemachine.withgoogle.com](https://teachablemachine.withgoogle.com/))
  for far better coverage of pantry staples than generic ImageNet classes.
- **Persist favourites:** the heart icon in cooking mode currently just toggles visually;
  wiring it to `localStorage` would take a few lines in `app.js`.

## 6. Deploying (for the video walkthrough / repo link)

1. Push this folder to a GitHub repository.
2. In the repo settings, enable **GitHub Pages** for the `main` branch (root folder).
3. GitHub Pages serves over HTTPS by default, which satisfies the camera API's secure-origin
   requirement.
