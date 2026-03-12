// Admin Profile JavaScript

// Toggle password visibility
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const button = input.nextElementSibling;
  const icon = button.querySelector("i");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("bi-eye-fill");
    icon.classList.add("bi-eye-slash-fill");
  } else {
    input.type = "password";
    icon.classList.remove("bi-eye-slash-fill");
    icon.classList.add("bi-eye-fill");
  }
}

// Show toast notification
function showToast(toastId, message, duration = 3000) {
  const toast = document.getElementById(toastId);
  const messageEl = toast.querySelector("span");

  if (toastId === "successMessage") {
    document.getElementById("successMessage").textContent = message;
  } else {
    document.getElementById("errorMessage").textContent = message;
  }

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

// Toggle sidebar (for mobile)
function toggleSidebar() {
  document.getElementById("adminSidebar").classList.toggle("show");
}

// Logout function
function logout() {
  auth.logout();
  window.location.href = "login.html";
}

// Load admin profile data
async function loadAdminProfile() {
  try {
    const response = await apiRequest("/admin/profile");

    if (response && response.data) {
      const admin = response.data;

      // Update header info
      const headerName = document.getElementById("headerAdminName");
      const headerAvatar = document.getElementById("headerAdminAvatar");

      // Update profile page info
      const profileName = document.getElementById("profileName");
      const profileAvatar = document.getElementById("profileAvatar");

      // Update form fields
      const adminName = document.getElementById("adminName");
      const adminMobile = document.getElementById("adminMobile");
      const adminEmail = document.getElementById("adminEmail");

      const fullName = admin.full_name || "Abishek Bangre";
      const nameInitial = fullName.charAt(0).toUpperCase();

      if (headerName) headerName.textContent = fullName;
      if (headerAvatar) headerAvatar.textContent = nameInitial;
      if (profileName) profileName.textContent = fullName;
      if (profileAvatar) profileAvatar.textContent = nameInitial;

      if (adminName) adminName.value = admin.full_name || "";
      if (adminMobile) adminMobile.value = admin.phone || "";
      if (adminEmail) adminEmail.value = admin.email || "";
    }
  } catch (error) {
    console.error("Failed to load admin profile:", error);
    // Use default values
    const nameInitial = "A";
    const profileName = document.getElementById("profileName");
    const profileAvatar = document.getElementById("profileAvatar");
    const headerName = document.getElementById("headerAdminName");
    const headerAvatar = document.getElementById("headerAdminAvatar");

    if (profileName) profileName.textContent = "Abishek Bangre";
    if (profileAvatar) profileAvatar.textContent = nameInitial;
    if (headerName) headerName.textContent = "Abishek Bangre";
    if (headerAvatar) headerAvatar.textContent = nameInitial;

    document.getElementById("adminName").value = "Abishek Bangre";
    document.getElementById("adminMobile").value = "";
    document.getElementById("adminEmail").value = "admin@restom.com";
  }
}

// Update admin profile
async function updateAdminProfile(event) {
  event.preventDefault();

  const name = document.getElementById("adminName").value.trim();
  const mobile = document.getElementById("adminMobile").value.trim();
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // Validate required fields
  if (!name) {
    showToast("errorMessage", "Please enter your name");
    alert("Please enter your name");
    return;
  }

  // Validate password change if attempted
  if (newPassword || confirmPassword) {
    if (!currentPassword) {
      showToast(
        "errorMessage",
        "Please enter your current password to change password",
      );
      alert("Please enter your current password to change password");
      return;
    }

    if (newPassword.length < 6) {
      showToast("errorMessage", "New password must be at least 6 characters");
      alert("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast(
        "errorMessage",
        "New password and confirm password do not match",
      );
      alert("New password and confirm password do not match");
      return;
    }
  }

  // Prepare data
  const data = {
    full_name: name,
    phone: mobile,
  };

  if (newPassword) {
    data.current_password = currentPassword;
    data.new_password = newPassword;
  }

  try {
    const response = await apiRequest("/admin/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });

    if (response && response.success) {
      showToast("successMessage", "Profile updated successfully!");
      alert("Profile updated successfully!");

      // Update displayed name and avatar
      const nameInitial = name.charAt(0).toUpperCase();
      document.getElementById("profileName").textContent = name;
      document.getElementById("profileAvatar").textContent = nameInitial;
      document.getElementById("headerAdminName").textContent = name;
      document.getElementById("headerAdminAvatar").textContent = nameInitial;

      // Update user in sessionStorage
      const user = auth.getUser();
      if (user) {
        user.full_name = name;
        user.name = name;
        sessionStorage.setItem("restom_user", JSON.stringify(user));
      }

      // Clear password fields
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";
    } else {
      showToast(
        "errorMessage",
        response?.message || "Failed to update profile",
      );
      alert(response?.message || "Failed to update profile");
    }
  } catch (error) {
    console.error("Failed to update profile:", error);
    showToast("errorMessage", "Failed to update profile. Please try again.");
    alert("Failed to update profile. Please try again.");
  }
}

// Notification dropdown functionality
function setupNotificationDropdown() {
  const notificationBtn = document.getElementById("adminNotificationBtn");
  const notificationDropdown = document.getElementById(
    "adminNotificationDropdown",
  );

  if (notificationBtn && notificationDropdown) {
    notificationBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      notificationDropdown.classList.toggle("show");

      // Close profile dropdown if open
      const profileDropdown = document.getElementById("adminProfileDropdown");
      if (profileDropdown) profileDropdown.classList.remove("show");
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
}

// Profile dropdown functionality
function setupProfileDropdown() {
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
}

// Check authentication
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

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  if (!requireAdminAuth()) return;

  // Load admin profile
  loadAdminProfile();

  // Setup form submission
  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", updateAdminProfile);
  }

  // Setup dropdowns
  setupNotificationDropdown();
  setupProfileDropdown();
});
