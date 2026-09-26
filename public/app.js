document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  updateCartUI();

  document.getElementById('checkout-btn').addEventListener('click', proceedToCheckout);
});

let cart = JSON.parse(localStorage.getItem('cart')) || [];

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    const products = await response.json();
    const container = document.getElementById('products-container');
    
    if (!container) return;
    container.innerHTML = '';

    if (products.length === 0) {
      container.innerHTML = '<p>Aucun contenu pédagogique disponible pour le moment.</p>';
      return;
    }

    products.forEach(product => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <h3>${product.title}</h3>
        <p>${product.description}</p>
        <p class="price"><strong>${product.price} €</strong></p>
        <button onclick='addToCart(${JSON.stringify(product)})'>Ajouter au panier</button>
        <a href="${product.gumroadUrl}" target="_blank" class="gumroad-direct">Acheter direct sur Gumroad</a>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Erreur chargement produits:', error);
  }
}

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  saveCart();
  updateCartUI();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartUI() {
  const cartItemsContainer = document.getElementById('cart-items');
  const cartTotalElement = document.getElementById('cart-total');
  if (!cartItemsContainer) return;

  cartItemsContainer.innerHTML = '';
  let total = 0;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<li>Votre panier est vide.</li>';
    if (cartTotalElement) cartTotalElement.textContent = '0.00 €';
    return;
  }

  cart.forEach(item => {
    total += item.price * item.quantity;
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.title} (x${item.quantity}) - ${(item.price * item.quantity).toFixed(2)} €</span>
      <button onclick="removeFromCart('${item.id}')">Supprimer</button>
    `;
    cartItemsContainer.appendChild(li);
  });

  if (cartTotalElement) {
    cartTotalElement.textContent = total.toFixed(2) + ' €';
  }
}

function proceedToCheckout() {
  if (cart.length === 0) {
    alert('Votre panier est vide !');
    return;
  }
  // Redirection vers le premier lien Gumroad du panier ou page de paiement globale
  // Note: Gumroad gère un produit par lien, l'idéal est de rediriger vers le lien du produit principal ou configurer un bundle.
  const primaryProduct = cart[0];
  if (primaryProduct && primaryProduct.gumroadUrl && primaryProduct.gumroadUrl !== '#') {
    window.location.href = primaryProduct.gumroadUrl;
  } else {
    alert("Veuillez configurer un lien Gumroad valide pour ce produit.");
  }
}