document.addEventListener("DOMContentLoaded", () => {
  const state = {
    author: "",
    category: "",
    currentSpotlightQuote: null,
    totalQuotes: 100,
  };

  // DOM Elements
  const totalBadge = document.getElementById("total-badge");
  const poolIndicator = document.getElementById("pool-indicator");
  const spotlightCard = document.getElementById("spotlight-card");
  const spotlightText = document.getElementById("spotlight-text");
  const spotlightAuthor = document.getElementById("spotlight-author");
  const spotlightCategories = document.getElementById("spotlight-categories");
  const newRandomBtn = document.getElementById("new-random-btn");
  const copyQuoteBtn = document.getElementById("copy-quote-btn");

  const authorInput = document.getElementById("author-input");
  const clearAuthorBtn = document.getElementById("clear-author-btn");
  const authorsDatalist = document.getElementById("authors-datalist");
  const categorySelect = document.getElementById("category-select");
  const categoryPills = document.getElementById("category-pills");
  const clearFiltersBtn = document.getElementById("clear-filters-btn");

  const resultsCount = document.getElementById("results-count");
  const quotesGrid = document.getElementById("quotes-grid");
  const emptyState = document.getElementById("empty-state");
  const emptyResetBtn = document.getElementById("empty-reset-btn");

  let debounceTimer = null;

  // Initialize application
  async function init() {
    await loadMetadata();
    await refreshAll(true);
  }

  // Fetch authors and categories metadata
  async function loadMetadata() {
    try {
      const response = await fetch("/api/meta");
      if (!response.ok) return;
      const data = await response.json();

      state.totalQuotes = data.total_quotes || 100;
      totalBadge.textContent = `${state.totalQuotes} Curated Quotes`;

      // Populate Authors datalist
      authorsDatalist.innerHTML = "";
      data.authors.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.name;
        option.label = `${item.name} (${item.count})`;
        authorsDatalist.appendChild(option);
      });

      // Populate Category select dropdown
      categorySelect.textContent = "";
      const allOption = document.createElement("option");
      allOption.value = "";
      allOption.textContent = `All Categories (${state.totalQuotes})`;
      categorySelect.appendChild(allOption);

      data.categories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat.name;
        option.textContent = `${capitalize(cat.name)} (${cat.count})`;
        categorySelect.appendChild(option);
      });

      // Populate Category pills
      renderCategoryPills(data.categories);
    } catch (err) {
      console.error("Failed to load metadata:", err);
    }
  }

  function createPillContent(button, label, count) {
    button.textContent = `${label} `;
    const countSpan = document.createElement("span");
    countSpan.className = "pill-count";
    countSpan.textContent = `(${count})`;
    button.appendChild(countSpan);
  }

  function renderCategoryPills(categories) {
    categoryPills.textContent = "";

    const allPill = document.createElement("button");
    allPill.type = "button";
    allPill.className = `category-pill ${state.category === "" ? "active" : ""}`;
    allPill.dataset.category = "";
    createPillContent(allPill, "All", state.totalQuotes);
    allPill.addEventListener("click", () => setCategoryFilter(""));
    categoryPills.appendChild(allPill);

    categories.forEach((cat) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = `category-pill ${state.category === cat.name ? "active" : ""}`;
      pill.dataset.category = cat.name;
      createPillContent(pill, cat.name, cat.count);
      pill.addEventListener("click", () => {
        const nextCat = state.category === cat.name ? "" : cat.name;
        setCategoryFilter(nextCat);
      });
      categoryPills.appendChild(pill);
    });
  }

  function updateFilterUI() {
    // Sync category pills active state
    const pills = categoryPills.querySelectorAll(".category-pill");
    pills.forEach((pill) => {
      if (pill.dataset.category === state.category) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    // Sync select dropdown
    if (categorySelect.value !== state.category) {
      categorySelect.value = state.category;
    }

    // Sync author input
    if (authorInput.value !== state.author) {
      authorInput.value = state.author;
    }

    // Toggle clear buttons
    clearAuthorBtn.classList.toggle("hidden", !state.author);
    const hasFilters = Boolean(state.author || state.category);
    clearFiltersBtn.classList.toggle("hidden", !hasFilters);
  }

  async function fetchRandomQuote() {
    const params = new URLSearchParams();
    if (state.author) params.set("author", state.author);
    if (state.category) params.set("category", state.category);
    if (state.currentSpotlightQuote && state.currentSpotlightQuote.id) {
      params.set("exclude_id", state.currentSpotlightQuote.id);
    }

    try {
      const response = await fetch(`/api/quotes/random?${params.toString()}`);
      if (!response.ok) {
        renderEmptySpotlight();
        return;
      }
      const data = await response.json();
      renderSpotlight(data.quote, data.matching_count);
    } catch (err) {
      console.error("Failed to fetch random quote:", err);
    }
  }

  async function fetchMatchingQuotes() {
    const params = new URLSearchParams();
    if (state.author) params.set("author", state.author);
    if (state.category) params.set("category", state.category);

    try {
      const response = await fetch(`/api/quotes?${params.toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      renderQuotesGrid(data.quotes, data.count);
    } catch (err) {
      console.error("Failed to fetch quotes list:", err);
    }
  }

  async function refreshAll(updateSpotlight = true) {
    updateFilterUI();
    const tasks = [fetchMatchingQuotes()];
    if (updateSpotlight) {
      tasks.push(fetchRandomQuote());
    }
    await Promise.all(tasks);
  }

  function renderSpotlight(quote, matchingCount) {
    state.currentSpotlightQuote = quote;

    // Pool indicator description
    const parts = [];
    if (state.author) parts.push(`author "${state.author}"`);
    if (state.category) parts.push(`category "${state.category}"`);
    if (parts.length > 0) {
      poolIndicator.textContent = `Random quote from ${matchingCount} matching (${parts.join(" + ")})`;
    } else {
      poolIndicator.textContent = `Drawing randomly from all ${state.totalQuotes} quotes`;
    }

    spotlightText.textContent = quote.text;
    spotlightAuthor.textContent = `— ${quote.author}`;
    spotlightAuthor.onclick = () => setAuthorFilter(quote.author);

    spotlightCategories.innerHTML = "";
    (quote.categories || []).forEach((cat) => {
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "tag tag-dark";
      badge.textContent = cat;
      badge.title = `Filter by category: ${cat}`;
      badge.addEventListener("click", () => setCategoryFilter(cat));
      spotlightCategories.appendChild(badge);
    });
  }

  function renderEmptySpotlight() {
    state.currentSpotlightQuote = null;
    poolIndicator.textContent = "0 matching quotes for current filters";
    spotlightText.textContent = "No quotes match your current filter combination. Try clearing a filter!";
    spotlightAuthor.textContent = "";
    spotlightCategories.innerHTML = "";
  }

  function renderQuotesGrid(quotes, count) {
    const noun = count === 1 ? "quote" : "quotes";
    resultsCount.textContent = `Showing ${count} ${noun}`;

    if (count === 0) {
      quotesGrid.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    quotesGrid.innerHTML = "";

    quotes.forEach((quote) => {
      const card = document.createElement("article");
      card.className = "quote-card";

      const textEl = document.createElement("p");
      textEl.className = "quote-card-text";
      textEl.textContent = `“${quote.text}”`;

      const footer = document.createElement("div");
      footer.className = "quote-card-footer";

      const metaRow = document.createElement("div");
      metaRow.className = "quote-card-meta";

      const authorBtn = document.createElement("button");
      authorBtn.type = "button";
      authorBtn.className = "quote-card-author";
      authorBtn.textContent = `— ${quote.author}`;
      authorBtn.title = `Filter by ${quote.author}`;
      authorBtn.addEventListener("click", () => setAuthorFilter(quote.author));

      const featureBtn = document.createElement("button");
      featureBtn.type = "button";
      featureBtn.className = "feature-btn";
      featureBtn.textContent = "Spotlight ↑";
      featureBtn.title = "Display this quote in the main card";
      featureBtn.addEventListener("click", () => {
        renderSpotlight(quote, count);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      metaRow.appendChild(authorBtn);
      metaRow.appendChild(featureBtn);

      const tagsRow = document.createElement("div");
      tagsRow.className = "quote-card-tags";
      (quote.categories || []).forEach((cat) => {
        const tag = document.createElement("button");
        tag.type = "button";
        tag.className = `tag tag-light ${state.category === cat ? "active" : ""}`;
        tag.textContent = cat;
        tag.addEventListener("click", () => setCategoryFilter(cat));
        tagsRow.appendChild(tag);
      });

      footer.appendChild(metaRow);
      footer.appendChild(tagsRow);

      card.appendChild(textEl);
      card.appendChild(footer);
      quotesGrid.appendChild(card);
    });
  }

  function setAuthorFilter(author) {
    state.author = author.trim();
    refreshAll(true);
  }

  function setCategoryFilter(category) {
    state.category = category.trim().toLowerCase();
    refreshAll(true);
  }

  function resetAllFilters() {
    state.author = "";
    state.category = "";
    refreshAll(true);
  }

  // Event Listeners
  newRandomBtn.addEventListener("click", () => {
    fetchRandomQuote();
  });

  copyQuoteBtn.addEventListener("click", async () => {
    if (!state.currentSpotlightQuote) return;
    const textToCopy = `"${state.currentSpotlightQuote.text}" — ${state.currentSpotlightQuote.author}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      const original = copyQuoteBtn.textContent;
      copyQuoteBtn.textContent = "Copied!";
      setTimeout(() => {
        copyQuoteBtn.textContent = original;
      }, 1500);
    } catch {
      // Fallback if clipboard API is restricted
    }
  });

  authorInput.addEventListener("input", (e) => {
    const value = e.target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.author = value.trim();
      refreshAll(true);
    }, 200);
  });

  clearAuthorBtn.addEventListener("click", () => {
    setAuthorFilter("");
    authorInput.focus();
  });

  categorySelect.addEventListener("change", (e) => {
    setCategoryFilter(e.target.value);
  });

  clearFiltersBtn.addEventListener("click", resetAllFilters);
  emptyResetBtn.addEventListener("click", resetAllFilters);

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  init();
});
