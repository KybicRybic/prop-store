const STORAGE_KEYS = {
  cart: "propFactoryCart",
  favorites: "propFactoryFavorites",
};

function readCollection(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeCollection(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  syncHeaderCounters();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCatalogData() {
  return window.catalogData || { categories: {} };
}

function getCategory(categoryKey) {
  return getCatalogData().categories?.[categoryKey] || null;
}

function getProduct(categoryKey, productKey) {
  const category = getCategory(categoryKey);

  if (!category) {
    return null;
  }

  return category.items.find((item) => item.slug === productKey) || null;
}

function getProductUrl(categoryKey, productKey) {
  const params = new URLSearchParams({
    category: categoryKey,
    product: productKey,
  });

  return `product.html?${params.toString()}`;
}

function getStoredProductPayload(category, product) {
  return {
    id: `${category.key}:${product.slug}`,
    categoryKey: category.key,
    categoryTitle: category.title,
    slug: product.slug,
    name: product.name,
    type: product.type,
    code: product.code,
    lead: product.lead,
  };
}

function syncHeaderCounters() {
  const cartCount = readCollection(STORAGE_KEYS.cart).length;
  const favoriteCount = readCollection(STORAGE_KEYS.favorites).length;

  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = cartCount;
  });

  document.querySelectorAll("[data-fav-count]").forEach((node) => {
    node.textContent = favoriteCount;
  });
}

function isStored(key, productId) {
  return readCollection(key).some((item) => item.id === productId);
}

function addProductToCollection(key, payload) {
  const current = readCollection(key);

  if (current.some((item) => item.id === payload.id)) {
    return false;
  }

  writeCollection(key, [payload, ...current]);
  return true;
}

function toggleProductInCollection(key, payload) {
  const current = readCollection(key);
  const exists = current.some((item) => item.id === payload.id);

  if (exists) {
    writeCollection(
      key,
      current.filter((item) => item.id !== payload.id)
    );
    return false;
  }

  writeCollection(key, [payload, ...current]);
  return true;
}

function getMediaMarkup(category, product, className) {
  if (product.image) {
    return `
      <img class="${className}__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
    `;
  }

  return `
    <div class="${className}__placeholder">
      <span class="${className}__placeholder-copy">Пустая карточка</span>
      <strong class="${className}__placeholder-title">${escapeHtml(product.type)}</strong>
      <p class="${className}__placeholder-note">Фото и детали можно добавить позже.</p>
    </div>
  `;
}

function renderCatalogGrid() {
  const page = document.querySelector("[data-catalog-page]");

  if (!page) {
    return;
  }

  const categoryKey = page.dataset.catalogPage;
  const category = getCategory(categoryKey);
  const introNode = page.querySelector("[data-category-intro]");
  const countNode = page.querySelector("[data-category-count]");
  const gridNode = page.querySelector("[data-product-grid]");

  if (!category || !gridNode) {
    return;
  }

  if (introNode) {
    introNode.textContent = category.intro;
  }

  if (countNode) {
    countNode.textContent = `${category.items.length} товаров в наличии`;
  }

  gridNode.innerHTML = category.items
    .map((product) => {
      const accent = product.accent || category.accent;
      const accentSoft = product.accentSoft || category.accentSoft;

      return `
        <a
          class="product-card"
          href="${getProductUrl(category.key, product.slug)}"
          style="--card-accent:${escapeHtml(accent)};--card-accent-soft:${escapeHtml(accentSoft)};"
        >
          <div class="product-card__media">
            ${getMediaMarkup(category, product, "product-card")}
            <span class="product-card__badge">${escapeHtml(category.title)}</span>
          </div>
          <div class="product-card__content">
            <div class="product-card__meta">
              <span>${escapeHtml(product.code)}</span>
              <span>Пустая карточка</span>
            </div>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.lead)}</p>
            <span class="product-card__link">Открыть карточку товара</span>
          </div>
        </a>
      `;
    })
    .join("");
}

function setFeedback(message, tone = "neutral") {
  const feedback = document.querySelector("[data-feedback]");

  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.dataset.tone = tone;
}

function syncProductActions(productId) {
  const cartButton = document.querySelector("[data-add-to-cart]");
  const favoriteButton = document.querySelector("[data-toggle-favorite]");
  const isInCart = isStored(STORAGE_KEYS.cart, productId);
  const isFavorite = isStored(STORAGE_KEYS.favorites, productId);

  if (cartButton) {
    cartButton.textContent = isInCart ? "Уже в корзине" : "Добавить в корзину";
    cartButton.classList.toggle("is-complete", isInCart);
  }

  if (favoriteButton) {
    favoriteButton.textContent = isFavorite ? "Убрать из избранного" : "В избранное";
    favoriteButton.classList.toggle("is-active", isFavorite);
  }
}

function renderProductPage() {
  const page = document.querySelector("[data-product-page]");

  if (!page) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const categoryKey = params.get("category");
  const productKey = params.get("product");
  const category = getCategory(categoryKey);
  const product = getProduct(categoryKey, productKey);

  if (!category || !product) {
    page.innerHTML = `
      <section class="empty-state">
        <p class="eyebrow">Карточка не найдена</p>
        <h1>Такой товар пока не создан</h1>
        <p>Вернитесь в каталог и откройте одну из подготовленных карточек.</p>
        <a class="text-link" href="../index.html">Вернуться к разделам каталога</a>
      </section>
    `;
    return;
  }

  const accent = product.accent || category.accent;
  const accentSoft = product.accentSoft || category.accentSoft;
  const payload = getStoredProductPayload(category, product);

  page.innerHTML = `
    <a class="text-link text-link--top" href="${escapeHtml(category.key)}.html">Назад в раздел ${escapeHtml(category.title)}</a>
    <section class="product-layout" style="--card-accent:${escapeHtml(accent)};--card-accent-soft:${escapeHtml(accentSoft)};">
      <div class="product-visual">
        <div class="product-visual__frame">
          ${getMediaMarkup(category, product, "product-visual")}
          <div class="product-visual__footer">
            <span>${escapeHtml(product.code)}</span>
            <span>${escapeHtml(product.type)}</span>
          </div>
        </div>
      </div>
      <div class="product-panel">
        <p class="eyebrow">${escapeHtml(category.title)}</p>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-panel__lead">${escapeHtml(product.description)}</p>
        <div class="product-panel__chips">
          <span class="chip">Цена по запросу</span>
          <span class="chip">Пустая карточка</span>
          <span class="chip">${escapeHtml(product.code)}</span>
        </div>
        <div class="product-specs">
          <article class="product-spec">
            <span>Материалы</span>
            <strong>${escapeHtml(product.material)}</strong>
          </article>
          <article class="product-spec">
            <span>Размеры</span>
            <strong>${escapeHtml(product.dimensions)}</strong>
          </article>
          <article class="product-spec">
            <span>Состояние</span>
            <strong>${escapeHtml(product.condition)}</strong>
          </article>
          <article class="product-spec">
            <span>Заметки</span>
            <strong>${escapeHtml(product.note)}</strong>
          </article>
        </div>
        <div class="product-actions">
          <button class="action-button action-button--primary" type="button" data-add-to-cart>Добавить в корзину</button>
          <button class="action-button action-button--ghost" type="button" data-toggle-favorite>В избранное</button>
        </div>
        <p class="feedback" data-feedback data-tone="neutral">Карточка готова для наполнения: добавьте фото, характеристики и цену, когда определитесь с товаром.</p>
      </div>
    </section>
  `;

  const cartButton = page.querySelector("[data-add-to-cart]");
  const favoriteButton = page.querySelector("[data-toggle-favorite]");

  syncProductActions(payload.id);

  cartButton?.addEventListener("click", () => {
    const added = addProductToCollection(STORAGE_KEYS.cart, payload);

    if (added) {
      setFeedback(`"${product.name}" добавлен в корзину.`, "success");
    } else {
      setFeedback(`"${product.name}" уже находится в корзине.`, "neutral");
    }

    syncProductActions(payload.id);
  });

  favoriteButton?.addEventListener("click", () => {
    const isActive = toggleProductInCollection(STORAGE_KEYS.favorites, payload);

    if (isActive) {
      setFeedback(`"${product.name}" добавлен в избранное.`, "success");
    } else {
      setFeedback(`"${product.name}" удален из избранного.`, "neutral");
    }

    syncProductActions(payload.id);
  });
}

function toggleTheme() {
  document.body.classList.toggle("dark");
}

function initHeroSlider() {
  const slider = document.querySelector("[data-hero-slider]");

  if (!slider) {
    return;
  }

  const slides = Array.from(slider.querySelectorAll("[data-hero-slide]"));
  const prevButton = slider.querySelector("[data-hero-prev]");
  const nextButton = slider.querySelector("[data-hero-next]");
  let currentIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));
  let autoplayId = null;

  if (slides.length === 0) {
    return;
  }

  if (currentIndex < 0) {
    currentIndex = 0;
  }

  function showSlide(index) {
    currentIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === currentIndex);
    });
  }

  function startAutoplay() {
    if (slides.length < 2) {
      return;
    }

    if (autoplayId) {
      window.clearInterval(autoplayId);
    }

    autoplayId = window.setInterval(() => {
      showSlide(currentIndex + 1);
    }, 4000);
  }

  prevButton?.addEventListener("click", () => {
    showSlide(currentIndex - 1);
    startAutoplay();
  });

  nextButton?.addEventListener("click", () => {
    showSlide(currentIndex + 1);
    startAutoplay();
  });

  startAutoplay();
}

function addToCart(name) {
  setFeedback(`"${name}" добавлен в корзину.`, "success");
}

function addToFav(name) {
  setFeedback(`"${name}" добавлен в избранное.`, "success");
}

window.toggleTheme = toggleTheme;
window.addToCart = addToCart;
window.addToFav = addToFav;

document.addEventListener("DOMContentLoaded", () => {
  initHeroSlider();
  syncHeaderCounters();
  renderCatalogGrid();
  renderProductPage();
});
