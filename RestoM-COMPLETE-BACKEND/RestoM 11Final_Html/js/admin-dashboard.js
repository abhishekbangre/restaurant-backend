let recentOrders = [];
let currentPage = 1;
const ordersPerPage = 10;
let showAllRecentOrders = false;
let dashboardRefreshTimer = null;
let supportNotifications = [];

function getStatusClass(status) {
  if (!status) return "";
  const statusLower = status.toLowerCase();
  if (statusLower === "pending") return "st-pending";
  if (statusLower === "preparing") return "st-preparing";
  if (statusLower === "out_for_delivery") return "st-out-for-delivery";
  if (statusLower === "delivered") return "st-delivered";
  if (statusLower === "cancelled") return "st-cancelled";
  return "";
}

function formatStatus(status) {
  if (!status) return "N/A";
  const statusLower = status.toLowerCase();
  if (statusLower === "out_for_delivery") return "Ready to Serve";
  if (statusLower === "delivered") return "Served";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

// Fetch dashboard data from API
async function fetchDashboardData() {
  try {
    const response = await apiRequest("/admin/dashboard");
    if (response && response.data) {
      // Calculate active orders (pending + confirmed + preparing)
      const activeOrders =
        (response.data.orders_by_status?.pending || 0) +
        (response.data.orders_by_status?.confirmed || 0) +
        (response.data.orders_by_status?.preparing || 0);

      // Update stat cards with actual values
      const revenueEl = document.querySelector(
        '.stat-value[data-type="revenue"]',
      );
      const ordersEl = document.querySelector(
        '.stat-value[data-type="orders"]',
      );
      const activeEl = document.querySelector(
        '.stat-value[data-type="active"]',
      );
      const customersEl = document.querySelector(
        '.stat-value[data-type="customers"]',
      );

      if (revenueEl)
        revenueEl.textContent =
          "₹" + (response.data.today_revenue || 0).toLocaleString();
      if (ordersEl) ordersEl.textContent = response.data.total_orders || 0;
      if (activeEl) activeEl.textContent = activeOrders;
      if (customersEl) customersEl.textContent = response.data.total_users || 0;

      // Set recent orders
      if (response.data.recent_orders) {
        recentOrders = response.data.recent_orders;
        displayRecentOrders();
      }
    }
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
  }
}

function renderSupportNotifications() {
  const badge = document.getElementById("adminNotificationBadge");
  const listEl = document.getElementById("adminNotificationList");
  if (!badge || !listEl) return;

  const unreadCount = supportNotifications.filter(
    (item) => !item.is_read,
  ).length;

  badge.textContent = unreadCount;
  badge.style.display = unreadCount > 0 ? "flex" : "none";

  // Add scroll class when there are 4 or more notifications
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
  // Remove the notification from the local array
  supportNotifications = supportNotifications.filter(
    (item) => item.id !== messageId,
  );
  // Re-render the notifications
  renderSupportNotifications();
}

// Format order items for display
function formatOrderItems(order) {
  if (order.items && Array.isArray(order.items)) {
    return order.items
      .map((item) => `${item.name} (${item.quantity})`)
      .join(", ");
  }
  return "N/A";
}

function displayRecentOrders() {
  const tbody = document.getElementById("recentOrdersBody");
  if (!tbody) return;

  if (recentOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No orders yet</td></tr>`;
    return;
  }

  // Calculate rows to show
  const ordersToRender = showAllRecentOrders
    ? recentOrders
    : recentOrders.slice(
        (currentPage - 1) * ordersPerPage,
        currentPage * ordersPerPage,
      );

  tbody.innerHTML = ordersToRender
    .map(
      (order, index) => `
    <tr>
      <td><span class="fw-bold text-muted">#${order.order_number || order.id}</span></td>
      <td><span class="fw-semibold">${order.user?.name || "Guest"}</span></td>
      <td>${order.delivery_phone || "N/A"}</td>
      <td><small class="text-muted">${formatOrderItems(order)}</small></td>
      <td><span class="fw-bold">₹${order.total_amount || 0}</span></td>
      <td><span class="status-pill ${getStatusClass(order.status)}">${formatStatus(order.status)}</span></td>
      <td class="text-end">
        <select class="form-select action-select d-inline-block" onchange="updateOrderStatus(${order.id}, this.value)">
          <option value="pending" ${order.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>Preparing</option>
          <option value="out_for_delivery" ${order.status === "out_for_delivery" ? "selected" : ""}>Ready to Serve</option>
          <option value="delivered" ${order.status === "delivered" ? "selected" : ""}>Served</option>
        </select>
      </td>
    </tr>
  `,
    )
    .join("");

  // Add pagination
  displayPagination();
}

function displayPagination() {
  if (showAllRecentOrders) {
    const paginationContainer = document.getElementById("paginationContainer");
    if (paginationContainer) paginationContainer.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(recentOrders.length / ordersPerPage);
  const paginationContainer = document.getElementById("paginationContainer");

  if (!paginationContainer) return;

  if (totalPages <= 1) {
    paginationContainer.innerHTML = "";
    return;
  }

  let paginationHtml = `<nav><ul class="pagination justify-content-end">`;

  // Previous button
  paginationHtml += `<li class="page-item ${currentPage === 1 ? "disabled" : ""}">
    <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">Previous</a>
  </li>`;

  // Page numbers - show max 3 at a time
  const maxVisiblePages = 3;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  // Adjust start if we're near the end
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  // Show first page and ellipsis if needed
  if (startPage > 1) {
    paginationHtml += `<li class="page-item">
      <a class="page-link" href="#" onclick="changePage(1); return false;">1</a>
    </li>`;
    if (startPage > 2) {
      paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
  }

  // Show visible pages
  for (let i = startPage; i <= endPage; i++) {
    paginationHtml += `<li class="page-item ${i === currentPage ? "active" : ""}">
      <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
    </li>`;
  }

  // Show last page and ellipsis if needed
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    paginationHtml += `<li class="page-item">
      <a class="page-link" href="#" onclick="changePage(${totalPages}); return false;">${totalPages}</a>
    </li>`;
  }

  // Next button
  paginationHtml += `<li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
    <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Next</a>
  </li>`;

  paginationHtml += `</ul></nav>`;
  paginationContainer.innerHTML = paginationHtml;
}

function changePage(page) {
  const totalPages = Math.ceil(recentOrders.length / ordersPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  displayRecentOrders();
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    await apiRequest(`/admin/orders/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus }),
    });
    // Refresh dashboard
    await fetchDashboardData();
  } catch (error) {
    console.error("Failed to update order status:", error);
    alert("Failed to update order status");
    // Refresh to reset the dropdown
    await fetchDashboardData();
  }
}

function toggleSidebar() {
  document.getElementById("adminSidebar").classList.toggle("show");
}

function logout() {
  auth.logout();
  window.location.href = "login.html";
}

// Load admin profile info
async function loadAdminProfileInfo() {
  try {
    const response = await apiRequest("/admin/profile");
    if (response && response.data) {
      const admin = response.data;
      const fullName = admin.full_name || "Abishek Bangre";
      const nameInitial = fullName.charAt(0).toUpperCase();

      // Update header
      const headerName = document.getElementById("headerAdminName");
      const headerAvatar = document.getElementById("headerAdminAvatar");
      if (headerName) headerName.textContent = fullName;
      if (headerAvatar) headerAvatar.textContent = nameInitial;

      // Also update in sessionStorage
      const user = auth.getUser();
      if (user) {
        user.full_name = fullName;
        user.name = fullName;
        sessionStorage.setItem("restom_user", JSON.stringify(user));
      }
    }
  } catch (error) {
    console.error("Failed to load admin profile:", error);
  }
}

function requireAdminAuth() {
  if (!auth.isLoggedIn()) {
    window.location.href = "login.html";
    return false;
  }

  const user = auth.getUser();
  if (!user || user.role !== "admin") {
    alert("Please login as admin");
    auth.logout();
    window.location.href = "login.html";
    return false;
  }
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!requireAdminAuth()) return;

  // Load user info from localStorage
  const user = auth.getUser();
  if (user) {
    const headerName = document.querySelector(".profile-btn .text-end h6");
    const headerAvatar = document.querySelector(".profile-btn .bg-dark");
    const profileName = user.full_name || user.name || "Abishek Bangre";
    const nameInitial = profileName.charAt(0).toUpperCase();

    if (headerName) headerName.textContent = profileName;
    if (headerAvatar) headerAvatar.textContent = nameInitial;
  }

  // Load admin profile info from API
  loadAdminProfileInfo();

  const viewAllRecentOrdersBtn = document.getElementById(
    "viewAllRecentOrdersBtn",
  );
  if (viewAllRecentOrdersBtn) {
    viewAllRecentOrdersBtn.addEventListener("click", (event) => {
      event.preventDefault();
      showAllRecentOrders = true;
      currentPage = 1;
      displayRecentOrders();
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

  // Profile Dropdown Functionality
  const profileBtn = document.getElementById("adminProfileBtn");
  const profileDropdown = document.getElementById("adminProfileDropdown");

  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      profileDropdown.classList.toggle("show");

      // Close notification dropdown if open
      const notificationDropdown = document.getElementById(
        "adminNotificationDropdown",
      );
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

  fetchDashboardData();
  fetchSupportNotifications();

  // Live dashboard refresh
  dashboardRefreshTimer = setInterval(() => {
    fetchDashboardData();
    fetchSupportNotifications();
  }, 5000);
});

window.addEventListener("beforeunload", () => {
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = null;
  }
});
