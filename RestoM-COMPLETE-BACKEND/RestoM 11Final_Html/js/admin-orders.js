let orders = [];
let currentOrderId = null;
let currentPage = 1;
const ordersPerPage = 10;
let supportNotifications = [];
let notificationRefreshTimer = null;

function logout() {
  auth.logout();
  window.location.href = "login.html";
}

function requireAdminAuth() {
  const user = auth.getUser();
  if (!user || user.role !== "admin") {
    return false;
  }
  return true;
}

// Fetch all orders from API
async function fetchOrders() {
  try {
    const response = await apiRequest("/admin/orders");
    if (response && response.data && response.data.orders) {
      orders = response.data.orders;
      renderOrders();
    }
  } catch (error) {
    console.error("Failed to fetch orders:", error);
  }
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

// Format status for display
function formatStatus(status) {
  if (!status) return "N/A";
  const statusLower = status.toLowerCase();
  if (statusLower === "out_for_delivery") return "Ready to Serve";
  if (statusLower === "delivered") return "Served";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

// Get status class for badge
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

function renderOrders() {
  const searchInput = document.getElementById("orderSearch");
  const searchTerm = (searchInput?.value || "").trim().toLowerCase();
  const filteredOrders = searchTerm
    ? orders.filter((o) => {
        const orderId = String(o.order_number || o.id || "").toLowerCase();
        const customerName = String(o.user?.name || "").toLowerCase();
        const normalizedTerm = searchTerm.replace(/^#/, "");
        return (
          orderId.includes(normalizedTerm) ||
          customerName.includes(normalizedTerm)
        );
      })
    : orders;

  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  if (filteredOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No orders found</td></tr>`;
    displayPagination(filteredOrders);
    return;
  }

  // Calculate rows for current page
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  tbody.innerHTML = paginatedOrders
    .map(
      (o) => `
        <tr>
          <td><span class="fw-bold text-muted">#${o.order_number || o.id}</span></td>
          <td><span class="fw-semibold">${o.user?.name || "Guest"}</span></td>
          <td><span class="small text-muted">${o.delivery_phone || "N/A"}</span></td>
          <td><span class="small text-muted">${formatOrderItems(o)}</span></td>
          <td><span class="fw-bold">₹${o.total_amount || 0}</span></td>
          <td><span class="badge-elite ${getStatusClass(o.status)}">${formatStatus(o.status)}</span></td>
          <td class="text-end">
            <button class="btn-action-elite btn-view ms-auto" onclick="viewOrder(${o.id})">
              <i class="bi bi-eye-fill"></i>
            </button>
          </td>
        </tr>
      `,
    )
    .join("");

  displayPagination(filteredOrders);
}

function displayPagination(filteredOrders) {
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
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
  const searchInput = document.getElementById("orderSearch");
  const searchTerm = (searchInput?.value || "").trim().toLowerCase();
  const filteredOrders = searchTerm
    ? orders.filter((o) => {
        const orderId = String(o.order_number || o.id || "").toLowerCase();
        const customerName = String(o.user?.name || "").toLowerCase();
        const normalizedTerm = searchTerm.replace(/^#/, "");
        return (
          orderId.includes(normalizedTerm) ||
          customerName.includes(normalizedTerm)
        );
      })
    : orders;

  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderOrders();
}

async function viewOrder(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;

  currentOrderId = orderId;
  const body = document.getElementById("orderDetailBody");
  const orderRef = document.getElementById("orderRef");

  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleString()
    : "N/A";
  orderRef.textContent = `#${order.order_number || order.id} • ${orderDate}`;

  let itemsHtml = "";
  if (order.items && Array.isArray(order.items)) {
    itemsHtml = order.items
      .map(
        (item) => `
          <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <span>${item.name} x ${item.quantity}</span>
            <span class="text-muted">₹${item.subtotal || item.unit_price * item.quantity}</span>
          </div>
        `,
      )
      .join("");
  } else {
    itemsHtml = '<div class="text-muted">No items</div>';
  }

  body.innerHTML = `
    <div class="row mb-4">
      <div class="col-6">
        <div class="p-3 bg-light rounded-4">
          <p class="small text-muted mb-1">Customer</p>
          <h6 class="mb-0 fw-bold">${order.user?.name || "Guest"}</h6>
        </div>
      </div>
      <div class="col-6">
        <div class="p-3 bg-light rounded-4">
          <p class="small text-muted mb-1">Phone</p>
          <h6 class="mb-0 fw-bold">${order.delivery_phone || "N/A"}</h6>
        </div>
      </div>
      <div class="col-6 mt-3">
        <div class="p-3 bg-light rounded-4">
          <p class="small text-muted mb-1">Payment Method</p>
          <h6 class="mb-0 fw-bold">${order.payment?.payment_method || "N/A"}</h6>
        </div>
      </div>
    </div>
    <div class="mb-3">
      <h6 class="fw-bold text-uppercase small text-muted mb-3">Ordered Items</h6>
      ${itemsHtml}
    </div>
    <div class="p-4 bg-dark text-white rounded-4 d-flex justify-content-between align-items-center">
      <span class="fw-bold">Order Total</span>
      <h4 class="mb-0 fw-bold">₹${order.total_amount || 0}</h4>
    </div>
  `;

  new bootstrap.Modal(document.getElementById("orderDetailModal")).show();
}

async function updateOrderStatus(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;

  // Cycle through statuses
  const statusFlow = ["pending", "preparing", "out_for_delivery", "delivered"];
  const currentIndex = statusFlow.indexOf(order.status);
  const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];

  try {
    const response = await apiRequest(
      `/admin/orders/${orderId}/status`,
      "PUT",
      { status: nextStatus },
    );
    if (response) {
      // Refresh orders list
      await fetchOrders();
      // Close modal
      bootstrap.Modal.getInstance(
        document.getElementById("orderDetailModal"),
      ).hide();
    }
  } catch (error) {
    console.error("Failed to update order status:", error);
    alert("Failed to update order status");
  }
}

function toggleSidebar() {
  document.getElementById("adminSidebar").classList.toggle("show");
}

function logout() {
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  // Load user info from sessionStorage
  const user = auth.getUser();
  if (user) {
    const headerName = document.querySelector(".profile-btn .text-end h6");
    const headerAvatar = document.querySelector(".profile-btn .bg-dark");
    const profileName = user.full_name || user.name || "Abishek Bangre";
    const nameInitial = profileName.charAt(0).toUpperCase();

    if (headerName) headerName.textContent = profileName;
    if (headerAvatar) headerAvatar.textContent = nameInitial;
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

  const orderSearch = document.getElementById("orderSearch");
  if (orderSearch) {
    orderSearch.addEventListener("input", () => {
      currentPage = 1;
      renderOrders();
    });
  }

  fetchOrders();
  fetchSupportNotifications();

  notificationRefreshTimer = setInterval(() => {
    fetchSupportNotifications();
  }, 5000);
});

window.addEventListener("beforeunload", () => {
  if (notificationRefreshTimer) {
    clearInterval(notificationRefreshTimer);
    notificationRefreshTimer = null;
  }
});
