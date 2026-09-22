/**
 * app.js
 * ------
 * Ties together camera.js, recognition.js, recipes.js and cooking.js
 * and drives navigation between the app's screens (matching the 5
 * screens from the Task 7.3HD lo-fi prototype), plus the manual-entry
 * accessibility fallback described in the proposal's user flow.
 */
(function () {
  const screens = Array.from(document.querySelectorAll(".screen"));
  const screenHistory = [];
  let currentScreen = "home";

  // App state: the single source of truth for what ingredients the
  // user currently has, and any recipes matched against them.
  const state = {
    ingredients: [], // [{ name, source: 'scan' | 'manual' }]
    matches: [],
    activeRecipe: null
  };

  // ---------------- Screen navigation ----------------
  function showScreen(name, { push = true } = {}) {
    if (push && currentScreen && currentScreen !== name) {
      screenHistory.push(currentScreen);
    }
    screens.forEach((s) => {
      s.hidden = s.dataset.screen !== name;
    });
    if (currentScreen === "scan" && name !== "scan") {
      SmartChefCamera.stop(); // privacy: don't keep the camera running once we leave
    }
    currentScreen = name;
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.nav === name || (name === "home" && btn.dataset.nav === "home"));
    });
  }

  function goBack(fallback) {
    const prev = screenHistory.pop();
    showScreen(prev || fallback || "home", { push: false });
  }

  // ---------------- Toast helper ----------------
  let toastTimer = null;
  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2600);
  }

  // ---------------- Model preload ----------------
  const modelStatusEl = document.getElementById("model-status");
  SmartChefRecognition.loadModel((msg) => (modelStatusEl.textContent = msg))
    .then(() => {
      modelStatusEl.textContent = "Ready — tap \u201cScan my ingredients\u201d to try it.";
    })
    .catch((err) => {
      console.error(err);
      modelStatusEl.textContent = "Recognition model unavailable right now — you can still add ingredients manually.";
    });

  // ---------------- Home screen ----------------
  document.getElementById("btn-scan").addEventListener("click", enterScanScreen);
  document.getElementById("btn-manual-search").addEventListener("click", () => {
    manualScreen.reset();
    showScreen("manual");
  });

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (target === "home") showScreen("home");
      else if (target === "recipes-all") {
        manualScreen.reset();
        showScreen("manual");
      } else {
        toast("Not part of this prototype — see the write-up for what's next.");
      }
    });
  });

  // ---------------- Generic back buttons ----------------
  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => goBack(btn.dataset.back));
  });

  // ---------------- Scan screen ----------------
  const video = document.getElementById("camera-video");
  const canvas = document.getElementById("camera-canvas");
  const placeholder = document.getElementById("camera-placeholder");

  async function enterScanScreen() {
    showScreen("scan");
    if (!SmartChefCamera.isSupported()) {
      placeholder.querySelector("p").textContent = "Camera not available on this device.";
      placeholder.hidden = false;
      return;
    }
    try {
      placeholder.hidden = true;
      await SmartChefCamera.start(video);
    } catch (err) {
      console.warn("Camera permission denied or unavailable:", err);
      placeholder.querySelector("p").textContent = "Camera access was blocked — you can still enter ingredients manually.";
      placeholder.hidden = false;
    }
  }

  document.getElementById("btn-take-photo").addEventListener("click", async () => {
    if (video.readyState < 2) {
      toast("Camera isn't ready yet — one moment.");
      return;
    }
    const frame = SmartChefCamera.capture(video, canvas);
    toast("Recognising ingredients…");
    try {
      const found = await SmartChefRecognition.recogniseIngredients(frame);
      if (found.length === 0) {
        toast("Couldn't confidently identify anything — try again or add manually.");
        return;
      }
      state.ingredients = found.map((name) => ({ name, source: "scan" }));
      enterConfirmScreen("We detected these ingredients. Please confirm or remove any.");
    } catch (err) {
      console.error(err);
      toast("Recognition failed — please enter ingredients manually.");
    }
  });

  document.getElementById("btn-enter-manually").addEventListener("click", () => {
    manualScreen.reset();
    showScreen("manual");
  });

  document.getElementById("btn-scan-help").addEventListener("click", () => {
    toast("Centre your ingredients in the frame with good lighting, then tap Take Photo.");
  });

  // ---------------- Manual entry screen ----------------
  const manualScreen = (function () {
    let items = [];
    const input = document.getElementById("manual-input");
    const list = document.getElementById("manual-tag-list");
    const emptyHint = document.getElementById("manual-empty-hint");
    const continueBtn = document.getElementById("btn-manual-continue");

    function reset() {
      items = [];
      render();
    }

    function add() {
      const value = input.value.trim().toLowerCase();
      if (!value) return;
      if (!items.includes(value)) items.push(value);
      input.value = "";
      render();
      input.focus();
    }

    function remove(name) {
      items = items.filter((i) => i !== name);
      render();
    }

    function render() {
      list.innerHTML = "";
      items.forEach((name) => {
        const li = document.createElement("li");
        li.textContent = name + " ";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-label", `Remove ${name}`);
        btn.textContent = "✕";
        btn.addEventListener("click", () => remove(name));
        li.appendChild(btn);
        list.appendChild(li);
      });
      emptyHint.hidden = items.length > 0;
      continueBtn.disabled = items.length === 0;
    }

    document.getElementById("btn-add-manual").addEventListener("click", add);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add();
      }
    });
    continueBtn.addEventListener("click", () => {
      state.ingredients = items.map((name) => ({ name, source: "manual" }));
      enterConfirmScreen("Here's what you entered. Add or remove anything before we find recipes.");
    });

    return { reset, get items() { return items; } };
  })();

  // ---------------- Confirm screen ----------------
  const confirmList = document.getElementById("confirm-list");
  const confirmInstruction = document.getElementById("confirm-instruction");
  const confirmAddInput = document.getElementById("confirm-add-input");

  function enterConfirmScreen(instruction) {
    confirmInstruction.textContent = instruction;
    renderConfirmList();
    showScreen("confirm");
  }

  function renderConfirmList() {
    confirmList.innerHTML = "";
    state.ingredients.forEach((ing, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="ing-emoji" aria-hidden="true">${ing.source === "scan" ? "\u{1F4F7}" : "\u2328\uFE0F"}</span>
        <span class="ing-name">${ing.name}</span>
        <span class="ing-source">${ing.source === "scan" ? "detected" : "added"}</span>
      `;
      const removeBtn = document.createElement("button");
      removeBtn.className = "ing-remove";
      removeBtn.setAttribute("aria-label", `Remove ${ing.name}`);
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => {
        state.ingredients.splice(idx, 1);
        renderConfirmList();
      });
      li.appendChild(removeBtn);
      confirmList.appendChild(li);
    });
  }

  document.getElementById("btn-confirm-add").addEventListener("click", addConfirmIngredient);
  confirmAddInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addConfirmIngredient();
    }
  });
  function addConfirmIngredient() {
    const value = confirmAddInput.value.trim().toLowerCase();
    if (!value) return;
    if (!state.ingredients.some((i) => i.name === value)) {
      state.ingredients.push({ name: value, source: "manual" });
    }
    confirmAddInput.value = "";
    renderConfirmList();
  }

  document.getElementById("btn-confirm-edit").addEventListener("click", () => confirmAddInput.focus());

  document.getElementById("btn-confirm-continue").addEventListener("click", async () => {
    if (state.ingredients.length === 0) {
      toast("Add at least one ingredient first.");
      return;
    }
    const allRecipes = await SmartChefRecipes.loadRecipes();
    const names = state.ingredients.map((i) => i.name);
    state.matches = SmartChefRecipes.matchRecipes(allRecipes, names);

    document.getElementById("recipe-empty-hint").hidden = state.matches.length > 0;
    SmartChefRecipes.renderChips(document.getElementById("recipe-ingredient-chips"), names);
    SmartChefRecipes.renderRecipeList(document.getElementById("recipe-list"), state.matches, openRecipe);

    showScreen("recipes");
  });

  // ---------------- Recipes screen ----------------
  document.getElementById("btn-edit-ingredients").addEventListener("click", () => {
    enterConfirmScreen("Update your ingredients, then confirm again.");
  });

  function openRecipe(recipe) {
    state.activeRecipe = recipe;
    SmartChefCooking.start(recipe);
    showScreen("cooking");
  }

  // ---------------- Cooking screen ----------------
  SmartChefCooking.init({
    title: document.getElementById("cooking-title"),
    count: document.getElementById("step-count"),
    dots: document.getElementById("progress-dots"),
    visual: document.getElementById("step-visual"),
    text: document.getElementById("step-text"),
    prevBtn: document.getElementById("btn-prev-step"),
    nextBtn: document.getElementById("btn-next-step"),
    onFinish: () => {
      toast(`Nice work — ${state.activeRecipe.name} is ready! \u{1F37D}\uFE0F`);
    }
  });

  document.getElementById("btn-favourite").addEventListener("click", (e) => {
    e.target.textContent = e.target.textContent.trim() === "♡" ? "♥" : "♡";
  });

  // ---------------- Initial screen ----------------
  showScreen("home", { push: false });
})();
