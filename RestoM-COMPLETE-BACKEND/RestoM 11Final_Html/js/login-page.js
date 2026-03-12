document.addEventListener("DOMContentLoaded", () => {
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = loginForm.querySelector('input[type="email"]').value.trim();
      const password = loginForm.querySelector('input[type="password"]').value;

      if (!isValidEmail(email)) {
        alert("Please enter a valid email address");
        return;
      }

      try {
        const response = await auth.login({ email, password });
        const user = auth.getUser();
        // Check if user is admin and redirect accordingly
        if (user && user.role === "admin") {
          window.location.href = "admin-dashboard.html";
        } else {
          window.location.href = "index.html";
        }
      } catch (error) {
        alert(error.message || "Login failed");
      }
    });
  }

  window.attachRegisterFormHandler = function () {
    const registerForm = document.getElementById("registerForm");
    if (!registerForm || registerForm.dataset.bound === "1") return;

    // OTP flow is handled inline in login.html (user-requested HTML flow)
    if (registerForm.dataset.otpFlow === "1") return;

    registerForm.dataset.bound = "1";

    const mobileInput = document.getElementById("registerMobile");
    if (mobileInput) {
      mobileInput.addEventListener("input", () => {
        mobileInput.value = mobileInput.value.replace(/\D/g, "").slice(0, 10);
      });
    }

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = registerForm
        .querySelector('input[type="text"]')
        .value.trim();
      const email = registerForm
        .querySelector('input[type="email"]')
        .value.trim();
      const mobileInput = document.getElementById("registerMobile");
      const passwordInput = document.getElementById("registerPassword");
      const confirmInput = document.getElementById("registerConfirmPassword");

      const mobile = (mobileInput?.value || "").replace(/\D/g, "");
      if (!/^\d{10}$/.test(mobile)) {
        alert("Mobile number must be exactly 10 digits");
        return;
      }

      if (!isValidEmail(email)) {
        alert("Please enter a valid email address");
        return;
      }

      if (
        !passwordInput ||
        !confirmInput ||
        passwordInput.value !== confirmInput.value
      ) {
        alert("New Password and Confirm Password must be same");
        return;
      }

      const nameParts = name.split(" ");
      const firstName = nameParts.shift() || name;
      const lastName = nameParts.join(" ");

      try {
        await auth.signup({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: mobile,
          password: passwordInput.value,
        });
        window.location.href = "index.html";
      } catch (error) {
        alert(error.message || "Signup failed");
      }
    });
  };

  attachRegisterFormHandler();
});
