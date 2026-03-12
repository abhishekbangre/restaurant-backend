const categories = [
  {
    id: "Starters",
    name: "Starters",
    image: "https://images.unsplash.com/photo-1541014741259-de529411b96a?w=800",
    description: "Delicious appetizers to begin your meal.",
  },
  {
    id: "Main Course",
    name: "Main Course",
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
    description: "Hearty and satisfying main dishes.",
  },
  {
    id: "Kids",
    name: "Kids Menu",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800",
    description: "Tasty portions for the little ones.",
  },
  {
    id: "Desserts",
    name: "Desserts",
    image: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800",
    description: "Sweet endings to your meal.",
  },
  {
    id: "Beverages",
    name: "Beverages",
    image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800",
    description: "Refreshing cold and hot drinks.",
  },
];

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("categoriesGrid");
  grid.innerHTML = categories
    .map(
      (cat) => `
          <div class="col-md-6 col-lg-3">
            <article class="category-card" onclick="goToMenu('${cat.id}')">
              <div class="card-img-wrapper"><img src="${cat.image}" alt="${cat.name}" loading="lazy"></div>
              <div class="category-body">
                <h3 class="category-name">${cat.name}</h3>
                <p class="text-muted small mb-3">${cat.description}</p>
                <span class="btn-premium">Explore</span>
              </div>
            </article>
          </div>
        `,
    )
    .join("");
});

function goToMenu(categoryId) {
  window.location.href = `menu.html?category=${encodeURIComponent(categoryId)}`;
}
