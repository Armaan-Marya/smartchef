/**
 * recognition.js
 * --------------
 * The "image-recognition service" from the Task 7.3HD proposal.
 *
 * The proposal notes that API credentials should never be exposed in
 * client-side JavaScript. Since this is a static front-end prototype
 * with no backend, we satisfy that constraint by running image
 * recognition entirely in the browser with TensorFlow.js + a
 * pre-trained MobileNet model (loaded once, cached by the browser,
 * no API key involved at all).
 *
 * Limitation worth being upfront about (and worth discussing in the
 * walkthrough video): MobileNet is trained on the general-purpose
 * ImageNet dataset, which only contains a limited set of whole-food
 * classes (mostly fruit and vegetables — see data/ingredient-map.json).
 * It will not reliably recognise things like a carton of eggs, a block
 * of cheese or a garlic clove. That's precisely why the proposal's own
 * flow always shows a confirm/edit screen and a manual-entry fallback
 * rather than trusting recognition blindly.
 */
(function () {
  let model = null;
  let ingredientMap = null;

  async function loadModel(onStatus) {
    if (model) return model;
    onStatus && onStatus("Loading ingredient recognition model…");
    model = await mobilenet.load({ version: 2, alpha: 1.0 });
    onStatus && onStatus("Ready to scan.");
    return model;
  }

  async function loadIngredientMap() {
    if (ingredientMap) return ingredientMap;
    const res = await fetch("data/ingredient-map.json");
    ingredientMap = await res.json();
    return ingredientMap;
  }

  /**
   * Classifies an image element/canvas and returns SmartChef ingredient
   * names (deduplicated), mapping raw ImageNet labels through
   * ingredient-map.json. Predictions with low confidence are discarded.
   */
  async function recogniseIngredients(imageEl, { topK = 8, minConfidence = 0.08 } = {}) {
    const [net, map] = await Promise.all([loadModel(), loadIngredientMap()]);
    const predictions = await net.classify(imageEl, topK);

    const found = new Set();
    predictions.forEach((p) => {
      if (p.probability < minConfidence) return;
      // ImageNet labels often look like "pineapple, ananas" — try the
      // full label first, then each comma-separated alternative.
      const candidates = [p.className, ...p.className.split(",").map((s) => s.trim())];
      for (const c of candidates) {
        if (map[c]) {
          found.add(map[c]);
          break;
        }
      }
    });

    return Array.from(found);
  }

  window.SmartChefRecognition = { loadModel, loadIngredientMap, recogniseIngredients };
})();
