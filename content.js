(() => {
  const HINT_CHARS = "asdfghjkleriuwo";
  let state = null; // null = inactive, { overlay, hints, typed }

  // --- Hint generation ---

  function generateHints(count) {
    if (count === 0) return [];
    const chars = HINT_CHARS.split("");
    const base = chars.length;
    let length = 1;
    while (base ** length < count) length++;

    const hints = [];
    const build = (prefix, depth) => {
      if (hints.length >= count) return;
      if (depth === 0) {
        hints.push(prefix);
        return;
      }
      for (const c of chars) {
        if (hints.length >= count) return;
        build(prefix + c, depth - 1);
      }
    };
    build("", length);
    return hints;
  }

  // --- Element discovery ---

  function getClickableElements() {
    const selector = 'a[href], button, [onclick], [role="button"]';
    const candidates = document.querySelectorAll(selector);
    const visible = [];

    for (const el of candidates) {
      if (el.disabled || el.getAttribute("aria-hidden") === "true") continue;
      if (el.closest("[inert]")) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.right < 0 || rect.left > window.innerWidth) continue;

      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;

      visible.push({ el, rect });
    }

    return visible;
  }

  // --- Rendering ---

  function activate() {
    if (state) return; // already active

    const elements = getClickableElements();
    if (elements.length === 0) return;

    const keys = generateHints(elements.length);
    const overlay = document.createElement("div");
    overlay.className = "km-overlay";

    const hints = elements.map(({ el, rect }, i) => {
      const label = document.createElement("span");
      label.className = "km-hint";
      label.textContent = keys[i];
      label.dataset.key = keys[i];

      // Position at top-left of element
      label.style.left = `${rect.left}px`;
      label.style.top = `${rect.top}px`;

      overlay.appendChild(label);
      return { el, key: keys[i], label };
    });

    document.documentElement.appendChild(overlay);
    state = { overlay, hints, typed: "" };
  }

  function deactivate() {
    if (!state) return;
    state.overlay.remove();
    state = null;
  }

  function updateHints() {
    if (!state) return;
    const { hints, typed } = state;

    for (const hint of hints) {
      if (!hint.key.startsWith(typed)) {
        hint.label.className = "km-hint km-hint--dim";
        hint.label.innerHTML = hint.key;
      } else {
        hint.label.className = "km-hint";
        // Highlight the typed portion
        const matched = hint.key.slice(0, typed.length);
        const remaining = hint.key.slice(typed.length);
        hint.label.innerHTML = `<span class="km-hint--matched">${matched}</span>${remaining}`;
      }
    }
  }

  // --- Input handling ---

  function onKeyDown(e) {
    if (!state) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (e.key === "Escape") {
      deactivate();
      return;
    }

    // Only accept single letter/digit keys, ignore modifiers
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

    const char = e.key.toLowerCase();
    if (!HINT_CHARS.includes(char)) {
      deactivate();
      return;
    }

    state.typed += char;

    // Check for exact match
    const match = state.hints.find((h) => h.key === state.typed);
    if (match) {
      const el = match.el;
      deactivate();
      el.focus();
      el.click();
      return;
    }

    // Check if any hints still match the prefix
    const hasPrefix = state.hints.some((h) => h.key.startsWith(state.typed));
    if (!hasPrefix) {
      deactivate();
      return;
    }

    updateHints();
  }

  // --- Event listeners ---

  document.addEventListener(
    "keydown",
    (e) => {
      // Option+Shift+M to toggle hint mode
      if (e.altKey && e.shiftKey && e.code === "KeyM") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (state) {
          deactivate();
        } else {
          activate();
        }
        return;
      }

      if (state) {
        onKeyDown(e);
      }
    },
    true
  );

  // Listen for activation from background script (commands API)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "activate") {
      if (state) {
        deactivate();
      } else {
        activate();
      }
    }
  });
})();
