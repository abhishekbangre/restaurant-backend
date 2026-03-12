document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".side-menu-link[data-tab]");
  const views = document.querySelectorAll(".tab-view");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      views.forEach((v) => {
        v.classList.add("d-none");
        if (v.id === target + "-view") v.classList.remove("d-none");
      });
    });
  });

  // Load user profile data
  loadUserProfile();
  loadUserOrders();
});

async function loadUserProfile() {
  if (!auth.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  try {
    const user = auth.getUser();
    if (user) {
      // Update avatar
      const avatarBox = document.querySelector(".avatar-box");
      if (avatarBox) {
        avatarBox.textContent = (user.name || user.email || "U")
          .charAt(0)
          .toUpperCase();
      }

      // Update name in sidebar
      const nameEl = document.querySelector(".profile-sidebar-card h5");
      if (nameEl) {
        nameEl.textContent = user.name || user.email.split("@")[0];
      }

      // Update Premium Member text with user's name
      const premiumEl = document.getElementById("premiumMember");
      if (premiumEl && user.name) {
        premiumEl.textContent = user.name;
      }

      // Update form fields
      const nameInput = document.getElementById("profileName");
      const emailInput = document.getElementById("profileEmail");
      const phoneInput = document.getElementById("profilePhone");

      if (nameInput) nameInput.value = user.name || "";
      if (emailInput) emailInput.value = user.email || "";
      if (phoneInput) phoneInput.value = user.phone || "";
    }
  } catch (error) {
    console.error("Failed to load profile:", error);
  }
}

async function loadUserOrders() {
  if (!auth.isLoggedIn()) return;

  try {
    const response = await apiRequest("/orders");
    if (response && response.data && response.data.orders) {
      displayOrders(response.data.orders);
    }
  } catch (error) {
    console.error("Failed to load orders:", error);
  }
}

function displayOrders(orders) {
  const ordersView = document.getElementById("orders-view");
  if (!ordersView) return;

  if (orders.length === 0) {
    ordersView.querySelector(".content-card").innerHTML = `
      <h4 class="section-header">Order History</h4>
      <div class="text-center py-5">
        <i class="bi bi-receipt text-muted" style="font-size: 48px;"></i>
        <p class="text-muted mt-3">No orders yet</p>
        <a href="category.html" class="btn btn-primary rounded-pill">Browse Menu</a>
      </div>
    `;
    return;
  }

  const orderHtml = orders
    .map((order, index) => {
      const orderDate = order.created_at
        ? new Date(order.created_at).toLocaleString()
        : "N/A";
      const statusClass = getStatusClass(order.status);

      let itemsHtml = "";
      if (order.items && Array.isArray(order.items)) {
        itemsHtml = order.items
          .map(
            (item) => `
        <div class="menu-item-row">
          <span>${item.name || "Item"} x${item.quantity}</span>
          <span>₹${item.subtotal || item.unit_price * item.quantity}</span>
        </div>
      `,
          )
          .join("");
      }

      return `
      <div class="order-item">
        <div class="d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-3">
            <button class="view-items-btn" onclick="toggleDetails(${index + 1})">
              <i class="bi bi-plus-circle-fill"></i>
            </button>
            <div>
              <span class="fw-bold d-block">ID #${order.order_number || order.id}</span>
              <small class="text-muted">${orderDate}</small>
            </div>
          </div>
          <div class="text-end">
            <span class="fw-bold d-block">₹${order.total_amount || 0}</span>
            <span class="badge-status ${statusClass}">${formatStatus(order.status)}</span>
          </div>
        </div>
        <div class="order-details-list" id="details-${index + 1}">
          ${itemsHtml}
        </div>
      </div>
    `;
    })
    .join("");

  ordersView.querySelector(".content-card").innerHTML = `
    <h4 class="section-header">Order History</h4>
    ${orderHtml}
  `;
}

function getStatusClass(status) {
  if (!status) return "bg-secondary";
  const statusLower = status.toLowerCase();
  if (statusLower === "pending") return "bg-warning text-dark";
  if (statusLower === "confirmed") return "bg-info";
  if (statusLower === "preparing") return "bg-primary";
  if (statusLower === "out_for_delivery") return "bg-purple";
  if (statusLower === "delivered") return "bg-success";
  if (statusLower === "cancelled") return "bg-danger";
  return "bg-secondary";
}

function formatStatus(status) {
  if (!status) return "N/A";
  const statusLower = status.toLowerCase();
  if (statusLower === "out_for_delivery") return "Ready to Serve";
  if (statusLower === "delivered") return "Served";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function toggleDetails(id) {
  const el = document.getElementById(`details-${id}`);
  el.classList.toggle("show");
  const btn = el.parentElement.querySelector(".view-items-btn i");
  if (el.classList.contains("show")) {
    btn.classList.replace("bi-plus-circle-fill", "bi-dash-circle-fill");
  } else {
    btn.classList.replace("bi-dash-circle-fill", "bi-plus-circle-fill");
  }
}

function logout() {
  if (confirm("Are you sure you want to sign out?")) {
    auth.logout();
    window.location.href = "login.html";
  }
}
