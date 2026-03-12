document.addEventListener("DOMContentLoaded", function () {
  const authSlot = document.getElementById("authButtons");
  if (typeof auth !== "undefined" && auth.isAuthenticated()) {
    const user = auth.getUser();
    authSlot.innerHTML = `<button class="btn btn-dark rounded-pill px-4">Hi, ${user.name.split(" ")[0]}</button>`;
  } else {
    authSlot.innerHTML = `<a href="index.html" class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm">Sign In</a>`;
  }
});
