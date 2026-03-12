// Order tracking page - fetches orders from backend
let userOrders = [];
let refreshInterval;

// Get status class for styling
function getStatusClass(status) {
  if (!status) return "";
  const statusLower = status.toLowerCase();
  if (statusLower === "pending") return "bg-warning text-dark";
  if (statusLower === "confirmed") return "bg-info";
  if (statusLower === "preparing") return "bg-primary";
  if (statusLower === "out_for_delivery") return "bg-purple text-white";
  if (statusLower === "delivered") return "bg-success text-white";
  if (statusLower === "cancelled") return "bg-danger";
  return "bg-secondary";
}

// Format status for display
function formatStatus(status) {
  if (!status) return "N/A";
  const statusLower = status.toLowerCase();
  if (statusLower === "out_for_delivery") return "Ready to Serve";
  if (statusLower === "delivered") return "Served";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

// Get timeline steps based on status
function getTimelineSteps(status) {
  const steps = [
    { key: "pending", label: "Pending", icon: "bi-clock" },
    { key: "preparing", label: "Preparing", icon: "bi-fire" },
    { key: "out_for_delivery", label: "Ready to Serve", icon: "bi-cup-hot" },
    { key: "delivered", label: "Served", icon: "bi-check-circle" },
  ];

  const statusIndex = steps.findIndex((s) => s.key === status.toLowerCase());

  return steps.map((step, index) => {
    const isActive =
      index <= statusIndex && status.toLowerCase() !== "cancelled";
    const isCurrent = index === statusIndex;
    return { ...step, active: isActive, current: isCurrent };
  });
}

// Get progress line width based on status
function getProgressWidth(status) {
  const statusLower = status.toLowerCase();
  // Timeline spans from 12.5% to 87.5% = 75% width
  // Icons are at positions: 0%, 33%, 66%, 100% (effectively)
  // Progress line should go from Pending to current step
  if (statusLower === "pending") return "0%";
  if (statusLower === "preparing") return "21%";
  if (statusLower === "out_for_delivery") return "46%";
  if (statusLower === "delivered") return "75%";
  return "0%";
}

// Fetch orders from backend
async function fetchOrders() {
  if (!auth.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await apiRequest("/orders");
    if (response && response.data && response.data.orders) {
      userOrders = response.data.orders;
      displayOrders();
    }
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    document.getElementById("ordersContainer").innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-exclamation-triangle text-danger" style="font-size: 48px;"></i>
        <h4 class="mt-3">Failed to load orders</h4>
        <p class="text-muted">Please try again later</p>
      </div>
    `;
  }
}

// Display orders in the page
function displayOrders() {
  const container = document.getElementById("ordersContainer");

  if (userOrders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-bag-x text-muted" style="font-size: 48px;"></i>
        <h4 class="mt-3">No orders yet</h4>
        <p class="text-muted">Place your first order to start tracking</p>
        <a href="category.html" class="btn btn-primary rounded-pill px-4">Browse Menu</a>
      </div>
    `;
    return;
  }

  container.innerHTML = userOrders
    .map((order, index) => {
      const timelineSteps = getTimelineSteps(order.status);
      const itemsList = order.items
        ? order.items
            .map(
              (item) => `
      <tr>
        <td class="text-start">${item.name || "Item"}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-end">₹${item.subtotal || item.unit_price * item.quantity}</td>
      </tr>
    `,
            )
            .join("")
        : "";

      const orderDate = order.created_at
        ? new Date(order.created_at).toLocaleDateString()
        : "";

      return `
      <div class="order-card">
        <div class="row align-items-center g-3">
          <div class="col-6 col-lg-3">
            <span class="label-text">Order Number</span>
            <span class="order-value">#${order.order_number || order.id}</span>
          </div>
          <div class="col-6 col-lg-3">
            <span class="label-text">Date</span>
            <span class="order-value small">${orderDate}</span>
          </div>
          <div class="col-6 col-lg-2">
            <span class="label-text">Total Amount</span>
            <span class="order-value">₹${order.total_amount || 0}</span>
          </div>
          <div class="col-6 col-lg-2">
            <span class="label-text">Current Status</span>
            <div class="status-pill text-uppercase ${getStatusClass(order.status)}">${formatStatus(order.status)}</div>
          </div>
          <div class="col-12 col-lg-2 text-lg-end">
            <button class="btn-unified btn-sm px-3 py-1" data-bs-toggle="modal" data-bs-target="#billModal${index}">
              <i class="bi bi-receipt me-1"></i> View
            </button>
          </div>
        </div>

        <div class="tracking-timeline">
          <div class="tracking-progress-line" style="width: ${getProgressWidth(order.status)}"></div>
          ${timelineSteps
            .map(
              (step, stepIndex) => `
            <div class="timeline-step ${step.active ? "active" : ""} ${step.current ? "current" : ""}">
              <div class="step-icon"><i class="bi ${step.icon}"></i></div>
              <div class="step-label">${step.label}</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <!-- Bill Modal for Order #${order.order_number || order.id} -->
      <div class="modal fade" id="billModal${index}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow-lg">
            <div class="modal-body p-4">
              <table class="bill-table">
                <thead>
                  <tr>
                    <th class="text-start">Item Description</th>
                    <th class="text-center">Qty</th>
                    <th class="text-end">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
              </table>
              <div class="bill-footer">
                <div class="d-flex justify-content-between mb-1">
                  <span>Subtotal</span><span>₹${order.subtotal || order.total_amount || 0}</span>
                </div>
                <div class="d-flex justify-content-between mb-1">
                  <span>Tax (5%)</span><span>₹${order.tax || 0}</span>
                </div>
                <div class="d-flex justify-content-between mb-1">
                  <span>Delivery</span><span>₹${order.delivery_charge || 30}</span>
                </div>
                <div class="d-flex justify-content-between fw-bold h5">
                  <span>Total Amount</span><span class="text-danger">₹${order.total_amount || 0}</span>
                </div>
              </div>
            </div>
            <div class="modal-footer border-0 pb-4 px-4">
              <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  fetchOrders();
  // Auto-refresh every 5 seconds
  refreshInterval = setInterval(fetchOrders, 5000);
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
