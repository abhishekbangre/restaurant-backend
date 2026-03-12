function logout() {
  auth.logout();
  window.location.href = "login.html";
}

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

function requireAdminAuth() {
  const user = auth.getUser();
  if (!user || user.role !== "admin") {
    return false;
  }
  return true;
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

  loadAnalytics();
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

function toggleSidebar() {
  document.getElementById("adminSidebar").classList.toggle("show");
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

async function loadAnalytics() {
  try {
    const [dashboardRes, monthlySalesRes, topItemsRes, menuRes] =
      await Promise.all([
        apiRequest("/admin/dashboard"),
        apiRequest("/admin/monthly-sales"),
        apiRequest("/admin/top-items"),
        apiRequest("/admin/menu"),
      ]);

    const dashboard = dashboardRes?.data || {};
    const monthlySales = Array.isArray(monthlySalesRes?.data)
      ? monthlySalesRes.data
      : [];
    const topItems = Array.isArray(topItemsRes?.data) ? topItemsRes.data : [];
    const menuItems = Array.isArray(menuRes?.data) ? menuRes.data : [];

    const totalRevenue = Number(dashboard.total_revenue || 0);
    const totalOrders = Number(dashboard.total_orders || 0);
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const activeMenuCount = menuItems.filter(
      (item) => item.is_available,
    ).length;

    const revVal = document.getElementById("revVal");
    const ordVal = document.getElementById("ordVal");
    const avgVal = document.getElementById("avgVal");
    const menuVal = document.getElementById("menuVal");

    if (revVal) revVal.textContent = formatCurrency(totalRevenue);
    if (ordVal) ordVal.textContent = totalOrders.toLocaleString("en-IN");
    if (avgVal) avgVal.textContent = formatCurrency(avgTicket);
    if (menuVal) menuVal.textContent = `${activeMenuCount} Items`;

    renderCharts({
      monthlySales,
      ordersByStatus: dashboard.orders_by_status || {},
      topItems,
      menuItems,
    });
  } catch (error) {
    console.error("Failed to load analytics:", error);
  }
}

function renderCharts({ monthlySales, ordersByStatus, topItems, menuItems }) {
  // 1) Revenue Forecast & Trend
  const revenueLabels =
    monthlySales.length > 0
      ? monthlySales.map((row) => row.month)
      : ["No Data"];
  const revenueData =
    monthlySales.length > 0 ? monthlySales.map((row) => row.revenue || 0) : [0];

  new Chart(document.getElementById("revenueChart"), {
    type: "line",
    data: {
      labels: revenueLabels,
      datasets: [
        {
          data: revenueData,
          borderColor: "#ff4757",
          backgroundColor: "rgba(255, 71, 87, 0.1)",
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  // 2) Order Fulfillment
  const statusLabels = [
    "Pending",
    "Preparing",
    "Ready to Serve",
    "Served",
    "Cancelled",
  ];
  const statusData = [
    Number(ordersByStatus.pending || 0) + Number(ordersByStatus.confirmed || 0),
    Number(ordersByStatus.preparing || 0),
    Number(ordersByStatus.out_for_delivery || 0),
    Number(ordersByStatus.delivered || 0),
    Number(ordersByStatus.cancelled || 0),
  ];

  new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: statusLabels,
      datasets: [
        {
          data: statusData,
          backgroundColor: [
            "#f59e0b",
            "#3b82f6",
            "#a855f7",
            "#22c55e",
            "#ef4444",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      cutout: "75%",
    },
  });

  // 3) Category Intelligence
  const menuItemMap = Object.fromEntries(
    menuItems.map((item) => [item.id, item]),
  );
  const categoryTotals = {};
  topItems.forEach((item) => {
    const menuItem = menuItemMap[item.id] || {};
    const categoryName = menuItem.category_name || "Others";
    categoryTotals[categoryName] =
      (categoryTotals[categoryName] || 0) + Number(item.total_revenue || 0);
  });

  const categoryEntries = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1],
  );
  const categoryLabels =
    categoryEntries.length > 0
      ? categoryEntries.map((entry) => entry[0])
      : ["No Data"];
  const categoryData =
    categoryEntries.length > 0 ? categoryEntries.map((entry) => entry[1]) : [0];

  new Chart(document.getElementById("categoryChart"), {
    type: "bar",
    data: {
      labels: categoryLabels,
      datasets: [
        {
          data: categoryData,
          backgroundColor: "#3b82f6",
          borderRadius: 10,
          barThickness: 30,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = Number(context.parsed?.y ?? context.parsed ?? 0);
              return `Revenue: ${formatCurrency(value)}`;
            },
          },
        },
      },
    },
  });

  // 4) Top Performing Dishes
  const topDishLabels = topItems.length
    ? topItems.slice(0, 5).map((item) => item.name)
    : ["No Data"];
  const topDishData = topItems.length
    ? topItems.slice(0, 5).map((item) => Number(item.total_sold || 0))
    : [0];

  new Chart(document.getElementById("topItemsChart"), {
    type: "bar",
    data: {
      labels: topDishLabels,
      datasets: [
        {
          data: topDishData,
          backgroundColor: "#ff4757",
          borderRadius: 10,
          barThickness: 20,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}
