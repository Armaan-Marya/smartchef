/**
 * recipes.js
 * ----------
 * Loads the local recipe dataset and matches it against the user's
 * confirmed ingredients. In a production version this "Recipe
 * Database/API" step (see the proposal's data-flow diagram) would
 * likely call a real recipe API; here it's a small local JSON file so
 * the whole prototype runs without a backend.
 */
(function () {
  let recipes = null;

  const THUMB_EMOJI = {
    "cheese-omelette": "🍳",
    "tomato-frittata": "🍅",
    "cheesy-toast": "🧀",
    "garlic-mushroom-pasta": "🍝",
    "veggie-stirfry": "🥦",
    "caprese-salad": "🥗",
    "mushroom-omelette": "🍄",
    "garlic-bread": "🥖",
    "fruit-salad": "🍓",
    "corn-salsa": "🌽"
  };

  async function loadRecipes() {
    if (recipes) return recipes;
    const res = await fetch("data/recipes.json");
    recipes = await res.json();
    return recipes;
  }

  /**
   * Scores every recipe by how many of its ingredients the user has,
   * then sorts by best match. Recipes with zero overlap are excluded.
   */
  function matchRecipes(allRecipes, userIngredients) {
    const have = new Set(userIngredients.map((i) => i.toLowerCase()));

    return allRecipes
      .map((recipe) => {
        const total = recipe.ingredients.length;
        const matched = recipe.ingredients.filter((i) => have.has(i.toLowerCase())).length;
        return { recipe, matched, total, score: matched / total };
      })
      .filter((r) => r.matched > 0)
      .sort((a, b) => b.score - a.score || b.matched - a.matched);
  }

  function renderRecipeList(listEl, matches, onSelect) {
    listEl.innerHTML = "";
    matches.forEach(({ recipe, matched, total }) => {
      const li = document.createElement("li");
      const card = document.createElement("button");
      card.type = "button";
      card.className = "recipe-card";
      card.innerHTML = `
        <div class="recipe-thumb">${THUMB_EMOJI[recipe.id] || "🍽"}</div>
        <div class="recipe-info">
          <h3>${recipe.name}</h3>
          <div class="recipe-meta">
            <span>${recipe.ingredients.length} ingredients</span>
            <span>⏱ ${recipe.time} min</span>
          </div>
        </div>
        <span class="match-badge">${matched}/${total} match</span>
      `;
      card.addEventListener("click", () => onSelect(recipe));
      li.appendChild(card);
      listEl.appendChild(li);
    });
  }

  function renderChips(listEl, ingredients) {
    listEl.innerHTML = "";
    ingredients.forEach((ing) => {
      const li = document.createElement("li");
      li.textContent = ing;
      listEl.appendChild(li);
    });
  }

  window.SmartChefRecipes = { loadRecipes, matchRecipes, renderRecipeList, renderChips, THUMB_EMOJI };
})();
