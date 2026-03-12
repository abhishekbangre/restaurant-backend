let allMenuItems = [];
let allCategories = [];
let currentImageBase64 = "";
let currentPage = 1;
const itemsPerPage = 10;
let currentMenuView = [];
const menuModal = new bootstrap.Modal(document.getElementById("menuModal"));
let supportNotifications = [];
let notificationRefreshTimer = null;

function renderSupportNotifications() {
  const badge = document.getElementById("adminNotificationBadge");
  const listEl = document.getElementById("adminNotificationList");
  if (!badge || !listEl) return;

  const unreadCount = supportNotifications.filter(
    (item) => !item.is_read,
  ).length;

  badge.textContent = unreadCount;
  badge.style.display = unreadCount > 0 ? "flex" : "none";

  if (supportNotifications.length >= 4) {
    listEl.classList.add("has-scroll");
  } else {
    listEl.classList.remove("has-scroll");
  }

  if (!supportNotifications.length) {
    listEl.innerHTML = `<div class="notification-empty">No support messages</div>`;
    return;
  }

  listEl.innerHTML = supportNotifications
    .map(
      (item) => `
      <div class="notification-item" data-message-id="${item.id}">
        <button class="notification-close" onclick="dismissNotification(${item.id}, event)" title="Dismiss"><i class="bi bi-x"></i></button>
        <div class="name">${item.full_name || "Customer"}</div>
        <div class="email">${item.email || ""}</div>
        <div class="msg">${item.message || ""}</div>
      </div>
    `,
    )
    .join("");
}

async function fetchSupportNotifications() {
  const listEl = document.getElementById("adminNotificationList");
  if (!listEl) return;

  try {
    const response = await apiRequest("/support/messages");
    supportNotifications = response?.data?.messages || [];
    renderSupportNotifications();
  } catch (error) {
    console.error("Failed to fetch support notifications:", error);
  }
}

async function markSupportMessageRead(messageId) {
  try {
    await apiRequest(`/support/messages/${messageId}/read`, {
      method: "PUT",
    });
  } catch (error) {
    console.error("Failed to mark support message read:", error);
  }
}

async function dismissNotification(messageId, event) {
  if (event) {
    event.stopPropagation();
  }

  supportNotifications = supportNotifications.filter(
    (item) => item.id !== messageId,
  );
  renderSupportNotifications();
}

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

function requireAdminAuth() {
  if (!auth.isLoggedIn()) {
    alert("Please login as admin");
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function toUiFoodType(apiType) {
  return String(apiType || "veg").toLowerCase() === "non-veg"
    ? "Non-Veg"
    : "Veg";
}

function toApiFoodType(uiType) {
  return String(uiType || "Veg").toLowerCase() === "non-veg"
    ? "non-veg"
    : "veg";
}

function displayMenuItems(items) {
  currentMenuView = Array.isArray(items) ? items : [];
  const tbody = document.getElementById("menuTableBody");
  if (!currentMenuView.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No menu items found</td></tr>`;
    displayPagination();
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = currentMenuView.slice(startIndex, endIndex);

  tbody.innerHTML = paginatedItems
    .map(
      (item) => `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-3">
              <img src="${item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100"}" class="dish-avatar" alt="">
              <span class="fw-bold">${item.name}</span>
            </div>
          </td>
          <td><span class="text-muted small fw-bold">${item.category}</span></td>
          <td><span class="badge rounded-pill ${item.foodType === "Veg" ? "bg-success" : "bg-danger"}">${item.foodType}</span></td>
          <td><span class="fw-bold">₹${item.price}</span></td>
          <td><span class="badge-status ${item.isAvailable ? "bg-available" : "bg-soldout"}">${item.isAvailable ? "Available" : "Sold Out"}</span></td>
          <td>
            <div class="d-flex gap-2 justify-content-end">
              <button class="btn-action btn-edit" onclick="editMenuItem('${item._id}')"><i class="bi bi-pencil-fill"></i></button>
              <button class="btn-action btn-delete" onclick="deleteMenuItem('${item._id}')"><i class="bi bi-trash3-fill"></i></button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");

  displayPagination();
}

function displayPagination() {
  const paginationContainer = document.getElementById("paginationContainer");
  if (!paginationContainer) return;

  const totalPages = Math.ceil(currentMenuView.length / itemsPerPage);
  if (totalPages <= 1) {
    paginationContainer.innerHTML = "";
    return;
  }

  let paginationHtml = `<nav><ul class="pagination justify-content-end">`;

  paginationHtml += `<li class="page-item ${currentPage === 1 ? "disabled" : ""}">
    <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">Previous</a>
  </li>`;

  const maxVisiblePages = 3;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationHtml += `<li class="page-item">
      <a class="page-link" href="#" onclick="changePage(1); return false;">1</a>
    </li>`;
    if (startPage > 2) {
      paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationHtml += `<li class="page-item ${i === currentPage ? "active" : ""}">
      <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
    </li>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    paginationHtml += `<li class="page-item">
      <a class="page-link" href="#" onclick="changePage(${totalPages}); return false;">${totalPages}</a>
    </li>`;
  }

  paginationHtml += `<li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
    <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Next</a>
  </li>`;

  paginationHtml += `</ul></nav>`;
  paginationContainer.innerHTML = paginationHtml;
}

function changePage(page) {
  const totalPages = Math.ceil(currentMenuView.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  displayMenuItems(currentMenuView);
}

function populateCategoryDropdown() {
  const select = document.getElementById("itemCategory");
  if (!select) return;
  select.innerHTML = allCategories
    .map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
    .join("");
}

async function fetchCategories() {
  const res = await apiRequest("/categories");
  allCategories = Array.isArray(res?.data) ? res.data : [];
  populateCategoryDropdown();
}

async function fetchMenuItems() {
  const res = await apiRequest("/menu/admin/items");
  const items = Array.isArray(res?.data?.items) ? res.data.items : [];
  allMenuItems = items.map((item) => ({
    _id: String(item.id),
    name: item.name,
    category: item.category_name || "Others",
    categoryId: item.category_id,
    price: Number(item.price || 0),
    foodType: toUiFoodType(item.food_type),
    isAvailable: !!item.is_available,
    image:
      resolveImageUrl(item.image_url) ||
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100",
  }));
  currentPage = 1;
  displayMenuItems(allMenuItems);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAdminAuth()) return;

  // Load user info from sessionStorage
  const userInfo = auth.getUser();
  if (userInfo) {
    const headerName = document.querySelector(".profile-btn .text-end h6");
    const headerAvatar = document.querySelector(".profile-btn .bg-dark");
    const profileName = userInfo.full_name || userInfo.name || "Abishek Bangre";
    const nameInitial = profileName.charAt(0).toUpperCase();

    if (headerName) headerName.textContent = profileName;
    if (headerAvatar) headerAvatar.textContent = nameInitial;
  }

  // Check if user is admin
  const user = auth.getUser();
  if (!user || user.role !== "admin") {
    alert("Please login as admin to access this page");
    window.location.href = "login.html";
    return;
  }

  const imageInput = document.getElementById("itemImageFile");
  if (imageInput) {
    imageInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        currentImageBase64 = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const notificationBtn = document.getElementById("adminNotificationBtn");
  const notificationDropdown = document.getElementById(
    "adminNotificationDropdown",
  );
  const notificationList = document.getElementById("adminNotificationList");

  if (notificationBtn && notificationDropdown) {
    notificationBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      notificationDropdown.classList.toggle("show");

      // Close profile dropdown if open
      const profileDropdown = document.getElementById("adminProfileDropdown");
      if (profileDropdown) profileDropdown.classList.remove("show");

      if (notificationDropdown.classList.contains("show")) {
        await fetchSupportNotifications();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        !notificationDropdown.contains(event.target) &&
        event.target !== notificationBtn
      ) {
        notificationDropdown.classList.remove("show");
      }
    });
  }

  if (notificationList) {
    notificationList.addEventListener("click", async (event) => {
      const card = event.target.closest(".notification-item");
      if (!card) return;

      const messageId = card.getAttribute("data-message-id");
      if (!messageId) return;

      await markSupportMessageRead(messageId);
      await fetchSupportNotifications();
    });
  }

  // Profile Dropdown Functionality
  const profileBtn = document.getElementById("adminProfileBtn");
  const profileDropdown = document.getElementById("adminProfileDropdown");

  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      profileDropdown.classList.toggle("show");

      // Close notification dropdown if open
      if (notificationDropdown) notificationDropdown.classList.remove("show");
    });

    document.addEventListener("click", (event) => {
      if (
        !profileDropdown.contains(event.target) &&
        event.target !== profileBtn
      ) {
        profileDropdown.classList.remove("show");
      }
    });
  }

  try {
    await fetchCategories();
    await fetchMenuItems();
    await fetchSupportNotifications();

    notificationRefreshTimer = setInterval(() => {
      fetchSupportNotifications();
    }, 5000);
  } catch (error) {
    alert(error.message || "Failed to load admin menu data");
  }
});

window.addEventListener("beforeunload", () => {
  if (notificationRefreshTimer) {
    clearInterval(notificationRefreshTimer);
    notificationRefreshTimer = null;
  }
});

function showAddMenuModal() {
  document.getElementById("menuModalTitle").textContent = "Add New Dish";
  document.getElementById("menuForm").reset();
  document.getElementById("menuItemId").value = "";
  currentImageBase64 = "";
  menuModal.show();
}

function editMenuItem(id) {
  const item = allMenuItems.find((i) => i._id === id);
  if (!item) return;

  document.getElementById("menuModalTitle").textContent = "Edit Dish";
  document.getElementById("menuItemId").value = item._id;
  document.getElementById("itemName").value = item.name;
  document.getElementById("itemCategory").value = String(item.categoryId || "");
  document.getElementById("itemPrice").value = item.price;
  document.getElementById("itemFoodType").value = item.foodType;
  document.getElementById("itemAvailable").checked = item.isAvailable;
  currentImageBase64 = item.image || "";
  menuModal.show();
}

async function saveMenuItem() {
  const id = document.getElementById("menuItemId").value;
  const name = document.getElementById("itemName").value.trim();
  const categoryId = Number(document.getElementById("itemCategory").value);
  const price = Number(document.getElementById("itemPrice").value);
  const foodType = document.getElementById("itemFoodType").value;
  const isAvailable = document.getElementById("itemAvailable").checked;

  if (!name || !categoryId || !price) {
    alert("Please fill all required details");
    return;
  }

  const payload = {
    name,
    category_id: categoryId,
    price,
    food_type: toApiFoodType(foodType),
    is_available: isAvailable,
    image_url: currentImageBase64 || undefined,
  };

  try {
    if (id) {
      await apiRequest(`/menu/admin/items/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      alert("Menu item updated successfully");
    } else {
      await apiRequest("/menu/admin/items", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      alert("Menu item added successfully");
    }

    await fetchMenuItems();
    menuModal.hide();
  } catch (error) {
    alert(error.message || "Failed to save menu item");
  }
}

async function deleteMenuItem(id) {
  if (!confirm("Are you sure you want to delete this dish?")) return;

  try {
    await apiRequest(`/menu/admin/items/${id}`, { method: "DELETE" });
    await fetchMenuItems();
  } catch (error) {
    alert(error.message || "Failed to delete item");
  }
}

function toggleSidebar() {
  document.getElementById("adminSidebar").classList.toggle("show");
}

function logout() {
  auth.logout();
  window.location.href = "login.html";
}

function filterMenuItems() {
  const search =
    document.getElementById("searchInput")?.value.toLowerCase() || "";
  currentPage = 1;
  displayMenuItems(
    allMenuItems.filter((i) => i.name.toLowerCase().includes(search)),
  );
}
