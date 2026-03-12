const API_BASE_URL = "http://localhost:5000/api";

function getStoredValue(key) {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

function setStoredValue(key, value) {
  if (value === undefined || value === null) return;
  sessionStorage.setItem(key, value);
  // Remove old shared-tab storage to avoid admin/customer tab collision
  localStorage.removeItem(key);
}

function removeStoredValue(key) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

function getCartStorageKey() {
  try {
    const rawUser = getStoredValue("restom_user");
    if (rawUser) {
      const user = JSON.parse(rawUser);
      if (user && (user.id || user.email)) {
        return `restom_cart_${user.id || user.email}`;
      }
    }
  } catch (_) {}
  return "restom_cart_guest";
}

async function apiRequest(url, options = {}) {
  // Check for both old and new token keys for compatibility
  const token =
    getStoredValue("token") || getStoredValue("restom_access_token");

  options.headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: "Bearer " + token }),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(API_BASE_URL + url, options);
  } catch (error) {
    throw new Error(
      "Unable to connect to server. Please make sure backend is running on http://localhost:5000",
    );
  }

  if (response.status === 401) {
    alert("Invalid token");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }
  return payload;
}

// Cart Management (frontend persistence)
const cart = {
  getCart() {
    const scopedKey = getCartStorageKey();
    let data = localStorage.getItem(scopedKey);

    // One-time migration from old shared cart key
    if (!data) {
      const legacy = localStorage.getItem("restom_cart");
      if (legacy) {
        localStorage.setItem(scopedKey, legacy);
        localStorage.removeItem("restom_cart");
        data = legacy;
      }
    }

    return data ? JSON.parse(data) : [];
  },

  addToCart(item) {
    const cartItems = this.getCart();
    const existing = cartItems.find((i) => i.id === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cartItems.push({ ...item, quantity: 1 });
    }
    localStorage.setItem(getCartStorageKey(), JSON.stringify(cartItems));
  },

  removeFromCart(id) {
    const cartItems = this.getCart().filter((i) => i.id !== id);
    localStorage.setItem(getCartStorageKey(), JSON.stringify(cartItems));
  },

  updateQuantity(id, quantity) {
    const cartItems = this.getCart();
    const item = cartItems.find((i) => i.id === id);
    if (item) {
      item.quantity = quantity;
      localStorage.setItem(getCartStorageKey(), JSON.stringify(cartItems));
    }
  },

  getItemQuantity(id) {
    const item = this.getCart().find((i) => i.id === id);
    return item ? item.quantity : 0;
  },

  clearCart() {
    localStorage.removeItem(getCartStorageKey());
  },
};

const auth = {
  isLoggedIn() {
    // Check for both old and new token keys for compatibility
    return !!(getStoredValue("token") || getStoredValue("restom_access_token"));
  },

  getUser() {
    const data = getStoredValue("restom_user");
    return data ? JSON.parse(data) : null;
  },

  getToken() {
    return getStoredValue("token") || getStoredValue("restom_access_token");
  },

  setSession(user, accessToken, refreshToken = null) {
    setStoredValue("restom_user", JSON.stringify(user || {}));
    setStoredValue("token", accessToken || "");
    if (refreshToken) {
      setStoredValue("restom_refresh_token", refreshToken);
    }
  },

  async signup(payload) {
    const res = await apiRequest("/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res?.data?.access_token) {
      this.setSession(
        res.data.user,
        res.data.access_token,
        res.data.refresh_token,
      );
    }
    return res;
  },

  async login(payload) {
    const res = await apiRequest("/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res?.data?.access_token) {
      this.setSession(
        res.data.user,
        res.data.access_token,
        res.data.refresh_token,
      );
    }
    return res;
  },

  logout() {
    removeStoredValue("restom_user");
    removeStoredValue("token");
    removeStoredValue("restom_refresh_token");
  },
};
