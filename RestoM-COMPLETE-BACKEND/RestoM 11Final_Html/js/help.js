function searchFAQ() {
  let input = document.getElementById("faqSearchInput").value.toLowerCase();
  let items = document.getElementsByClassName("faq-item");
  let noResults = document.getElementById("noResults");
  let visibleCount = 0;
  for (let i = 0; i < items.length; i++) {
    let text = items[i].innerText.toLowerCase();
    if (text.includes(input)) {
      items[i].style.display = "";
      visibleCount++;
    } else {
      items[i].style.display = "none";
    }
  }
  noResults.style.display = visibleCount === 0 ? "block" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("helpContactForm");
  if (!form || typeof auth === "undefined") return;

  const user = auth.getUser();
  if (!user) return;

  const fullNameInput = form.querySelector('input[type="text"]');
  const emailInput = form.querySelector('input[type="email"]');

  const fullName = user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim();
  if (fullNameInput && fullName) fullNameInput.value = fullName;
  if (emailInput && user.email) emailInput.value = user.email;
});

document
  .getElementById("helpContactForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const fullNameInput = this.querySelector('input[type="text"]');
    const emailInput = this.querySelector('input[type="email"]');
    const messageInput = this.querySelector("textarea");

    const payload = {
      full_name: (fullNameInput?.value || "").trim(),
      email: (emailInput?.value || "").trim(),
      message: (messageInput?.value || "").trim(),
    };

    if (!payload.full_name || !payload.email || !payload.message) {
      alert("Please fill all fields.");
      return;
    }

    const fullNameRegex = /^[A-Za-z\s]+$/;
    if (!fullNameRegex.test(payload.full_name)) {
      alert("Full Name should contain only alphabets.");
      fullNameInput?.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      alert("Please enter a valid email address.");
      emailInput?.focus();
      return;
    }

    try {
      await apiRequest("/support/messages", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert("Thank you! Your request has been submitted.");
      this.reset();
    } catch (error) {
      alert(error.message || "Failed to submit support request.");
    }
  });

function startChat() {
  alert("Connecting you to a RestoM Support Agent...");
}
