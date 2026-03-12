let allBills = [];
let currentFilter = "all";
let currentViewedBillId = null;
let currentPage = 1;
const billsPerPage = 10;
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

document.addEventListener("DOMContentLoaded", () => {
  if (!requireAdminAuth()) {
    window.location.href = "login.html";
    return;
  }

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

  fetchBillingData();
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

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function normalizePaymentMethod(method) {
  const val = String(method || "").toLowerCase();
  if (val === "cash") return "Cash";
  if (val === "upi") return "UPI";
  if (val === "card") return "Card";
  return method || "—";
}

async function fetchBillingData() {
  try {
    const response = await apiRequest("/admin/orders");
    const orders = Array.isArray(response?.data?.orders)
      ? response.data.orders
      : [];

    allBills = orders.map((order) => {
      const payment = order.payment || {};
      const paymentStatus = String(payment.status || "pending").toLowerCase();
      return {
        id: order.id,
        _id: order.order_number || order.id,
        customerName: order.user?.name || "Guest",
        customerPhone: order.delivery_phone || order.user?.phone || "N/A",
        customerEmail: order.user?.email || "N/A",
        deliveryAddress: order.delivery_address || "N/A",
        notes: order.notes || "—",
        items: Array.isArray(order.items) ? order.items : [],
        totalAmount: Number(order.total_amount || 0),
        isPaid: paymentStatus === "completed",
        paymentMethod: normalizePaymentMethod(payment.payment_method),
        paymentId: payment.id || null,
        paymentStatus,
        date: order.created_at,
      };
    });

    renderLedger(currentFilter);
    updateSummary();
  } catch (error) {
    console.error("Failed to fetch billing data:", error);
    allBills = [];
    renderLedger(currentFilter);
    updateSummary();
  }
}

function updateSummary() {
  const billed = allBills.reduce((s, b) => s + b.totalAmount, 0);
  const paid = allBills
    .filter((b) => b.isPaid)
    .reduce((s, b) => s + b.totalAmount, 0);
  document.getElementById("totalBilled").textContent = formatCurrency(billed);
  document.getElementById("totalPaid").textContent = formatCurrency(paid);
  document.getElementById("totalPending").textContent = formatCurrency(
    billed - paid,
  );
}

function renderLedger(filter) {
  currentFilter = filter;
  currentPage = 1;
  const tbody = document.getElementById("billingTableBody");
  let data = allBills;
  if (filter === "unpaid") data = allBills.filter((b) => !b.isPaid);
  if (filter === "paid") data = allBills.filter((b) => b.isPaid);

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No billing records found</td></tr>`;
    displayPagination(data);
    return;
  }

  // Calculate rows for current page
  const startIndex = (currentPage - 1) * billsPerPage;
  const endIndex = startIndex + billsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  tbody.innerHTML = paginatedData
    .map(
      (b) => `
                <tr>
                    <td><span class="fw-bold text-muted">#${b._id}</span></td>
                    <td><span class="fw-semibold">${b.customerName}</span></td>
                    <td><span class="text-muted small fw-bold">${b.customerPhone}</span></td>
                    <td><span class="fw-bold">${formatCurrency(b.totalAmount)}</span></td>
                    <td><span class="text-muted small fw-bold">${b.paymentMethod || "—"}</span></td>
                    <td><span class="badge-elite ${b.isPaid ? "bg-paid" : "bg-pending"}">${b.isPaid ? "Cleared" : "Pending"}</span></td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn-action-elite btn-view-elite" onclick="viewDetails('${b._id}')"><i class="bi bi-eye-fill"></i></button>
                            ${b.isPaid ? `<button class="btn-action-elite btn-print-elite" onclick="viewDetails('${b._id}')"><i class="bi bi-printer-fill"></i></button>` : ""}
                            ${!b.isPaid ? `<button class="btn-action-elite btn-pay-elite" onclick="showPaymentModal('${b._id}')"><i class="bi bi-wallet2"></i></button>` : ""}
                        </div>
                    </td>
                </tr>
            `,
    )
    .join("");

  displayPagination(data);
}

function displayPagination(data) {
  const totalPages = Math.ceil(data.length / billsPerPage);
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
  let data = allBills;
  if (currentFilter === "unpaid") data = allBills.filter((b) => !b.isPaid);
  if (currentFilter === "paid") data = allBills.filter((b) => b.isPaid);

  const totalPages = Math.ceil(data.length / billsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;

  const tbody = document.getElementById("billingTableBody");
  const startIndex = (currentPage - 1) * billsPerPage;
  const endIndex = startIndex + billsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  tbody.innerHTML = paginatedData
    .map(
      (b) => `
                <tr>
                    <td><span class="fw-bold text-muted">#${b._id}</span></td>
                    <td><span class="fw-semibold">${b.customerName}</span></td>
                    <td><span class="text-muted small fw-bold">${b.customerPhone}</span></td>
                    <td><span class="fw-bold">${formatCurrency(b.totalAmount)}</span></td>
                    <td><span class="text-muted small fw-bold">${b.paymentMethod || "—"}</span></td>
                    <td><span class="badge-elite ${b.isPaid ? "bg-paid" : "bg-pending"}">${b.isPaid ? "Cleared" : "Pending"}</span></td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn-action-elite btn-view-elite" onclick="viewDetails('${b._id}')"><i class="bi bi-eye-fill"></i></button>
                            ${b.isPaid ? `<button class="btn-action-elite btn-print-elite" onclick="viewDetails('${b._id}')"><i class="bi bi-printer-fill"></i></button>` : ""}
                            ${!b.isPaid ? `<button class="btn-action-elite btn-pay-elite" onclick="showPaymentModal('${b._id}')"><i class="bi bi-wallet2"></i></button>` : ""}
                        </div>
                    </td>
                </tr>
            `,
    )
    .join("");

  displayPagination(data);
}

function viewDetails(id) {
  const b = allBills.find((x) => x._id === id);
  if (!b) return;
  currentViewedBillId = b._id;
  const formattedDate = b.date
    ? new Date(b.date).toLocaleString("en-IN")
    : "N/A";
  const printBtn = document.getElementById("printBillBtn");
  if (printBtn) {
    printBtn.style.display = b.isPaid ? "inline-flex" : "none";
  }

  const itemsHtml = b.items.length
    ? b.items
        .map(
          (item) => `
            <div class="receipt-item-row">
              <div class="receipt-item-name">${item.name || "Item"}</div>
              <div class="receipt-item-qty">${item.quantity || 0}</div>
              <div class="receipt-item-rate">${formatCurrency(item.unit_price || 0)}</div>
              <div class="receipt-item-amount">${formatCurrency(item.subtotal || 0)}</div>
            </div>
          `,
        )
        .join("")
    : `<div class="text-muted small">No item details available</div>`;

  document.getElementById("viewDetailsBody").innerHTML = `
                <div class="receipt-card">
                    <div class="receipt-header">
                        <h6 class="mb-1 restaurant-name">RESTOM RESTAURANT</h6>
                        <small>Restaurant Bill Receipt</small>
                    </div>
                    <div class="receipt-meta">
                      <div class="receipt-row"><span class="receipt-label">Bill No</span><span class="receipt-value">#${b._id}</span></div>
                      <div class="receipt-row"><span class="receipt-label">Date</span><span class="receipt-value">${formattedDate}</span></div>
                      <div class="receipt-row"><span class="receipt-label">Customer</span><span class="receipt-value">${b.customerName}</span></div>
                      <div class="receipt-row"><span class="receipt-label">Phone</span><span class="receipt-value">${b.customerPhone}</span></div>
                      <div class="receipt-row"><span class="receipt-label">Payment</span><span class="receipt-value">${b.paymentMethod || "Awaiting"}</span></div>
                      <div class="receipt-row"><span class="receipt-label">Status</span><span class="receipt-value">${b.isPaid ? "Cleared" : "Pending"}</span></div>
                    </div>
                    <div class="receipt-items-wrap">
                      <div class="receipt-item-head receipt-item-row">
                        <div>ITEM</div>
                        <div>QTY</div>
                        <div>RATE</div>
                        <div>AMT</div>
                      </div>
                      ${itemsHtml}
                    </div>
                    <div class="receipt-total d-flex justify-content-between align-items-center">
                        <span>TOTAL</span>
                        <h4 class="mb-0">${formatCurrency(b.totalAmount)}</h4>
                    </div>
                    <div class="receipt-note">${b.notes !== "—" ? `Note: ${b.notes}` : "Thank you for dining with us."}</div>
                </div>
            `;
  new bootstrap.Modal(document.getElementById("viewDetailsModal")).show();
}

function printCurrentBill() {
  if (!currentViewedBillId) return;
  const b = allBills.find((x) => x._id === currentViewedBillId);
  if (!b || !b.isPaid) return;
  window.print();
}

function showPaymentModal(id) {
  document.getElementById("paymentBillId").value = id;
  new bootstrap.Modal(document.getElementById("paymentModal")).show();
}

async function confirmPayment() {
  const id = document.getElementById("paymentBillId").value;
  const idx = allBills.findIndex((b) => b._id === id);
  if (idx === -1) return;
  const bill = allBills[idx];

  if (!bill.paymentId) {
    alert("Payment record not found for this order.");
    return;
  }

  try {
    await apiRequest(`/admin/payments/${bill.paymentId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: "completed" }),
    });

    const modalElement = document.getElementById("paymentModal");
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) modalInstance.hide();

    alert("Payment Successful! Invoice #" + id + " has been settled.");
    await fetchBillingData();
  } catch (error) {
    console.error("Failed to update payment:", error);
    alert("Unable to update payment status. Please try again.");
  }
}

function toggleSidebar() {
  document.getElementById("adminSidebar").classList.toggle("show");
}
