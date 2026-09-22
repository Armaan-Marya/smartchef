/**
 * cooking.js
 * ----------
 * Drives the interactive step-by-step cooking guide shown in
 * "Screen 5" of the lo-fi prototype: a progress indicator, one step
 * of instruction text at a time, and Previous/Next controls.
 */
(function () {
  let recipe = null;
  let stepIndex = 0;

  const els = {};

  function init(elements) {
    Object.assign(els, elements);
    els.prevBtn.addEventListener("click", () => goTo(stepIndex - 1));
    els.nextBtn.addEventListener("click", () => goTo(stepIndex + 1));
  }

  function start(selectedRecipe) {
    recipe = selectedRecipe;
    stepIndex = 0;
    els.title.textContent = recipe.name;
    renderDots();
    render();
  }

  function renderDots() {
    els.dots.innerHTML = "";
    recipe.steps.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "dot";
      els.dots.appendChild(dot);
    });
  }

  function updateDots() {
    Array.from(els.dots.children).forEach((dot, i) => {
      dot.classList.toggle("is-done", i < stepIndex);
      dot.classList.toggle("is-current", i === stepIndex);
    });
  }

  function render() {
    const total = recipe.steps.length;
    els.count.textContent = `Step ${stepIndex + 1} of ${total}`;
    els.text.textContent = recipe.steps[stepIndex];
    els.visual.textContent = SmartChefRecipes.THUMB_EMOJI[recipe.id] || "🍽";
    updateDots();

    els.prevBtn.disabled = stepIndex === 0;
    els.nextBtn.textContent = stepIndex === total - 1 ? "Done ✓" : "Next ›";
  }

  function goTo(index) {
    const total = recipe.steps.length;
    if (index < 0) return;
    if (index >= total) {
      els.onFinish && els.onFinish();
      return;
    }
    stepIndex = index;
    render();
  }

  window.SmartChefCooking = { init, start };
})();
