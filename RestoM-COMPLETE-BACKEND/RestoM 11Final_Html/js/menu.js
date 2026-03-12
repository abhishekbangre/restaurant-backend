let currentCategory = "all";
let totalCartQty = 0;
let itemsInCart = {};
let menuItemsData = {};
let categoryMap = {}; // Maps category name to id

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return "";
  if (
    String(imageUrl).startsWith("http://") ||
    String(imageUrl).startsWith("https://")
  ) {
    return imageUrl;
  }
  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
  return String(imageUrl).startsWith("/")
    ? `${apiOrigin}${imageUrl}`
    : `${apiOrigin}/${imageUrl}`;
}

function initCategoryFromQuery() {
  const params = new URLSearchParams(window.location.search || "");
  const category = (params.get("category") || "").trim();
  if (!category) return;

  currentCategory = category;

  const tabs = document.querySelectorAll(".category-tab");
  tabs.forEach((tab) => tab.classList.remove("active"));

  const matchedTab = Array.from(tabs).find(
    (tab) =>
      (tab.textContent || "").trim().toLowerCase() === category.toLowerCase(),
  );

  if (matchedTab) {
    matchedTab.classList.add("active");
  } else if (category.toLowerCase() === "all") {
    // Keep "All Dishes" selected when URL is ?category=all
    const allTab = Array.from(tabs).find((tab) =>
      (tab.textContent || "").trim().toLowerCase().includes("all"),
    );
    if (allTab) allTab.classList.add("active");
  }
}

function normalizeFoodType(type) {
  return String(type || "veg").toLowerCase() === "non-veg" ? "non-veg" : "veg";
}

function buildCard(item) {
  const safeName = item.name || "Item";
  const safeCategory = item.category || "Others";
  const safeType = normalizeFoodType(item.food_type);
  const safePrice = Number(item.price || 0);
  const safeImage =
    item.image ||
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600";
  const qty = itemsInCart[item.id] || 0;

  return `
    <div class="col-md-6 col-lg-4 menu-item" data-category="${safeCategory}" data-type="${safeType}" data-name="${safeName}">
      <div class="menu-card">
        <div class="menu-card-image">
          <img src="${safeImage}" alt="${safeName}" />
        </div>
        <div class="menu-card-body">
          <h5 class="menu-card-title">${safeName}</h5>
          <div class="d-flex justify-content-between align-items-center">
            <span class="menu-card-price">₹${safePrice}</span>
            <div class="add-btn-container" id="item-${item.id}">
              <button class="btn-add" onclick="updateQty(${item.id}, 1)" style="display:${qty > 0 ? "none" : "block"}">Add +</button>
              <div class="counter-btn" style="display:${qty > 0 ? "flex" : "none"}">
                <button onclick="updateQty(${item.id}, -1)">-</button>
                <span class="qty-label">${qty}</span>
                <button onclick="updateQty(${item.id}, 1)">+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMenu(items) {
  const grid = document.getElementById("menuGrid");
  if (!grid) return;
  grid.innerHTML = items.map((item) => buildCard(item)).join("");
  applyFilters();
}

function toggleNoMenuMessage(visibleCount) {
  const noMenuMessage = document.getElementById("noMenuMessage");
  if (!noMenuMessage) return;
  noMenuMessage.style.display = visibleCount === 0 ? "block" : "none";
}

function refreshCartFromStorage() {
  itemsInCart = {};
  cart.getCart().forEach((item) => {
    itemsInCart[item.id] = item.quantity;
  });
  calculateTotalCart();
}

async function fetchCategories() {
  try {
    const res = await apiRequest("/categories");
    const categories = Array.isArray(res?.data) ? res.data : [];

    // Build category map (name -> id)
    categoryMap = {};
    categories.forEach((cat) => {
      categoryMap[cat.name.toLowerCase()] = cat.id;
    });

    return categoryMap;
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return {};
  }
}

async function fetchMenuItems() {
  try {
    // First fetch categories to get category ID mapping
    await fetchCategories();

    // Build API path with category filter
    let apiPath = "/menu";
    if (
      currentCategory !== "all" &&
      categoryMap[currentCategory.toLowerCase()]
    ) {
      const categoryId = categoryMap[currentCategory.toLowerCase()];
      apiPath = `/menu?category_id=${categoryId}`;
    }

    const res = await apiRequest(apiPath);
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];

    menuItemsData = {};
    items.forEach((item) => {
      menuItemsData[item.id] = {
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        image:
          resolveImageUrl(item.image_url) ||
          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600",
        category: item.category_name || "Others",
        food_type: normalizeFoodType(item.food_type),
      };
    });

    renderMenu(Object.values(menuItemsData));
  } catch (error) {
    console.error("Failed to fetch menu items:", error);
    alert(error.message || "Unable to load menu from server");
  }
}

function updateQty(itemId, change) {
  if (!menuItemsData[itemId]) return;
  const oldQty = itemsInCart[itemId] || 0;
  const nextQty = Math.max(0, oldQty + change);
  itemsInCart[itemId] = nextQty;

  if (nextQty === 0) {
    delete itemsInCart[itemId];
    cart.removeFromCart(itemId);
  } else if (oldQty === 0 && nextQty === 1) {
    cart.addToCart(menuItemsData[itemId]);
  } else {
    cart.updateQuantity(itemId, nextQty);
  }

  const container = document.getElementById(`item-${itemId}`);
  if (container) {
    const addBtn = container.querySelector(".btn-add");
    const counter = container.querySelector(".counter-btn");
    const label = container.querySelector(".qty-label");
    if (nextQty > 0) {
      addBtn.style.display = "none";
      counter.style.display = "flex";
      label.innerText = nextQty;
    } else {
      addBtn.style.display = "block";
      counter.style.display = "none";
      label.innerText = "0";
    }
  }

  calculateTotalCart();
}

function calculateTotalCart() {
  totalCartQty = Object.values(itemsInCart).reduce((a, b) => a + b, 0);
  const badge = document.getElementById("cartBadgeCount");
  if (badge) {
    badge.innerText = totalCartQty;
    badge.style.display = totalCartQty > 0 ? "block" : "none";
  }

  const floatingBtn = document.getElementById("floatingCartBtn");
  const floatingCount = document.getElementById("floatingCartCount");
  if (floatingBtn && floatingCount) {
    const wasHidden = floatingBtn.style.display === "none" || !floatingBtn.style.display;
    floatingCount.innerText = totalCartQty;
    floatingBtn.style.display = totalCartQty > 0 ? "inline-flex" : "none";
    if (totalCartQty > 0 && wasHidden) {
      floatingBtn.classList.remove("btn-pop-in");
      // Reflow to restart animation when button appears again
      void floatingBtn.offsetWidth;
      floatingBtn.classList.add("btn-pop-in");
    }
    if (totalCartQty === 0) {
      floatingBtn.classList.remove("btn-pop-in");
    }
  }
}

function setCategory(category, element) {
  document
    .querySelectorAll(".category-tab")
    .forEach((tab) => tab.classList.remove("active"));
  if (element) element.classList.add("active");
  currentCategory = category;

  // Fetch new menu items for the selected category
  fetchMenuItems();
}

function applyFilters() {
  const searchVal = (
    document.getElementById("searchInput")?.value || ""
  ).toLowerCase();
  const dietVal = document.getElementById("dietaryFilter")?.value || "all";
  const sortVal = document.getElementById("sortFilter")?.value || "default";
  const grid = document.getElementById("menuGrid");
  if (!grid) return;

  const items = Array.from(grid.querySelectorAll(".menu-item"));
  let visibleCount = 0;

  items.forEach((item) => {
    const cat = item.getAttribute("data-category");
    const type = item.getAttribute("data-type");
    const name = (item.getAttribute("data-name") || "").toLowerCase();

    // For category: if "all", show all; otherwise check if item's category matches
    // When items come from API (already filtered by category), currentCategory matches the category
    const matchesCat =
      currentCategory === "all" ||
      cat.toLowerCase() === currentCategory.toLowerCase();
    const matchesSearch = name.includes(searchVal);
    const matchesDiet = dietVal === "all" || type === dietVal;

    const isVisible = matchesCat && matchesSearch && matchesDiet;
    item.style.display = isVisible ? "block" : "none";
    if (isVisible) visibleCount += 1;
  });

  if (sortVal === "az") {
    items
      .sort((a, b) =>
        (a.getAttribute("data-name") || "").localeCompare(
          b.getAttribute("data-name") || "",
        ),
      )
      .forEach((item) => grid.appendChild(item));
  }

  toggleNoMenuMessage(visibleCount);
}

document.addEventListener("DOMContentLoaded", async () => {
  initCategoryFromQuery();
  refreshCartFromStorage();
  await fetchMenuItems();
});
