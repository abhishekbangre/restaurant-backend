const DELIVERY_CHARGE = 30;
const TAX_RATE = 0.05;

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
});

function renderCart() {
  const items = cart.getCart();
  const container = document.getElementById("cartItems");

  if (items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-cart-x display-1 text-light"></i>
        <h4 class="mt-4 fw-bold text-muted">Your cart is currently empty</h4>
        <a href="category.html" class="btn btn-primary rounded-pill px-5 mt-3">Discover Menu</a>
      </div>`;
    document.getElementById("checkoutBtn").disabled = true;
    return;
  }

  document.getElementById("checkoutBtn").disabled = false;

  container.innerHTML = items
    .map(
      (item) => `
    <div class="cart-card">
      <img src="${item.image}" alt="${item.name}" class="cart-image">
      <div class="cart-info">
        <h5 class="mb-1">${item.name}</h5>
        <span class="text-muted small">${item.category || "Main Course"}</span>
        <div class="mt-2 fw-bold text-danger">₹${item.price}</div>
      </div>
      <div class="quantity-group">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
        <span class="px-3 fw-bold">${item.quantity}</span>
        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <div class="text-end">
        <div class="fw-bold fs-5 mb-1">₹${item.price * item.quantity}</div>
        <button class="btn btn-sm text-danger p-0 fw-bold" onclick="remove(${item.id})">Remove</button>
      </div>
    </div>`,
    )
    .join("");

  calculateTotals(items);
}

function changeQty(id, delta) {
  const current = cart.getItemQuantity(id);
  if (current + delta < 1) return;
  cart.updateQuantity(id, current + delta);
  renderCart();
}

function remove(id) {
  cart.removeFromCart(id);
  renderCart();
}

function calculateTotals(items) {
  const sub = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = Math.round(sub * TAX_RATE);
  document.getElementById("subtotal").textContent = "₹" + sub;
  document.getElementById("tax").textContent = "₹" + tax;
  document.getElementById("total").textContent =
    "₹" + (sub + tax + DELIVERY_CHARGE);
}

function generateOrderId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "#RM";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function handlePlaceOrder() {
  if (!auth.isLoggedIn()) {
    alert("Please sign in to your RestoM account to complete your order.");
    window.location.href = "login.html";
    return;
  }

  const btn = document.getElementById("checkoutBtn");
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm me-2"></span> Processing...';

  // Get cart items from localStorage
  const items = cart.getCart();
  if (items.length === 0) {
    alert("Your cart is empty");
    btn.disabled = false;
    btn.innerHTML = "Place Order";
    return;
  }

  // Format items for API
  const orderItems = items.map((item) => ({
    menu_item_id: item.id,
    quantity: item.quantity,
  }));

  try {
    // Call the backend API to create order
    const response = await apiRequest("/orders/create", {
      method: "POST",
      body: JSON.stringify({
        delivery_phone: "",
        delivery_address: "",
        notes: "",
        payment_method: "cash",
        items: orderItems,
      }),
    });

    if (response && response.success) {
      const orderData = response.data;
      document.getElementById("orderId").textContent =
        orderData.order_number || orderData.id;

      // Show success modal
      const modal = new bootstrap.Modal(
        document.getElementById("orderSuccessModal"),
      );
      modal.show();

      // Clear cart after successful order
      cart.clearCart();

      // Redirect to order-tracking after delay
      setTimeout(() => {
        modal.hide();
        window.location.href = "order-tracking.html";
      }, 2500);
    }
  } catch (error) {
    console.error("Order failed:", error);
    alert("Failed to place order: " + (error.message || "Please try again"));
    btn.disabled = false;
    btn.innerHTML = "Place Order";
  }
}
