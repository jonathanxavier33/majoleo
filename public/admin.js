(function () {
  "use strict";

  const setupShell = document.getElementById("setup-shell");
  const loginShell = document.getElementById("login-shell");
  const adminShell = document.getElementById("admin-shell");
  const logoutBtn = document.getElementById("logout-btn");

  function euros(cents) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
  }
  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function showToast(msg, isError) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.toggle("toast-error", !!isError);
    t.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove("show"), 3200);
  }

  // Certaines erreurs (fichier trop volumineux pour un proxy, timeout, coupure
  // réseau...) renvoient une page d'erreur HTML au lieu du JSON attendu. Sans
  // cette protection, res.json() plante avec un message obscur du type
  // "Unexpected token '<'". On lit le texte brut et on ne tente le JSON.parse
  // que si ça y ressemble, pour toujours donner un message compréhensible.
  async function parseResponse(res) {
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch (e) { /* on tombe sur le message générique ci-dessous */ }
    }
    const hint =
      res.status === 413
        ? "Le fichier est trop volumineux pour être envoyé tel quel ici."
        : res.status === 502 || res.status === 504
        ? "Le serveur (ou l'aperçu StackBlitz) a mis trop de temps à répondre."
        : `Réponse inattendue du serveur (code ${res.status}).`;
    return { error: hint };
  }

  async function loadBrand() {
    try {
      const res = await fetch("/api/site-config");
      const site = await parseResponse(res);
      document.getElementById("brand-name").textContent = site.name;
      document.getElementById("brand-mark").textContent = (site.name || "?").trim().slice(0, 2).toUpperCase();
      document.title = "Espace créateur — " + site.name;
    } catch (e) { /* on garde les valeurs par défaut si la config n'a pas pu être chargée */ }
  }

  async function boot() {
    await loadBrand();
    const res = await fetch("/admin/session");
    const data = await parseResponse(res);
    if (!data.configured) {
      setupShell.style.display = "block";
      loginShell.style.display = "none";
      return;
    }
    if (data.authenticated) {
      loginShell.style.display = "none";
      adminShell.classList.add("ready");
      logoutBtn.style.display = "inline-flex";
      initAdmin();
    }
  }

  // ---------- Configuration initiale (premier lancement) ----------
  document.getElementById("setup-btn").addEventListener("click", async () => {
    const pwd = document.getElementById("setup-password").value;
    const confirmPwd = document.getElementById("setup-password-confirm").value;
    const errorEl = document.getElementById("setup-error");
    errorEl.style.display = "none";
    if (pwd.length < 8) {
      errorEl.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
      errorEl.style.display = "block";
      return;
    }
    if (pwd !== confirmPwd) {
      errorEl.textContent = "Les deux mots de passe ne correspondent pas.";
      errorEl.style.display = "block";
      return;
    }
    try {
      const res = await fetch("/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error || "Erreur lors de la création du compte.");
      location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = "block";
    }
  });

  // ---------- Connexion ----------
  document.getElementById("login-btn").addEventListener("click", async () => {
    const password = document.getElementById("admin-password").value;
    const errorEl = document.getElementById("login-error");
    errorEl.style.display = "none";
    try {
      const res = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error || "Connexion refusée.");
      location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = "block";
    }
  });
  document.getElementById("admin-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("login-btn").click();
  });
  logoutBtn.addEventListener("click", async () => {
    await fetch("/admin/logout", { method: "POST" });
    location.reload();
  });

  function initAdmin() {
    document.querySelectorAll(".tabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      });
    });
    loadStats();
    loadProducts();
    loadSales();
    loadSettings();

    document.getElementById("product-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const errorEl = document.getElementById("product-error");
      errorEl.style.display = "none";
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.textContent = "Publication…";
      try {
        const fd = new FormData(form);
        const res = await fetch("/admin/products", { method: "POST", body: fd });
        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.error || "Erreur lors de la création.");
        form.reset();
        loadProducts();
        loadStats();
        document.querySelector('.tabs button[data-tab="products"]').click();
        showToast(`« ${data.title} » a bien été publiée et est en ligne ✓`);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
        showToast(err.message, true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Publier la ressource";
      }
    });

    document.getElementById("site-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errorEl = document.getElementById("site-error");
      const successEl = document.getElementById("site-success");
      errorEl.style.display = "none";
      successEl.style.display = "none";
      try {
        const res = await fetch("/admin/site-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(fd)),
        });
        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.error || "Erreur lors de l'enregistrement.");
        successEl.style.display = "block";
        loadBrand();
        showToast("Paramètres de la boutique enregistrés ✓");
        setTimeout(() => (successEl.style.display = "none"), 2500);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
        showToast(err.message, true);
      }
    });

    document.getElementById("password-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const fd = new FormData(form);
      const errorEl = document.getElementById("password-error");
      const successEl = document.getElementById("password-success");
      errorEl.style.display = "none";
      successEl.style.display = "none";
      try {
        const res = await fetch("/admin/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(fd)),
        });
        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.error || "Erreur lors du changement de mot de passe.");
        successEl.style.display = "block";
        form.reset();
        showToast("Mot de passe créateur mis à jour ✓");
        setTimeout(() => (successEl.style.display = "none"), 2500);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
        showToast(err.message, true);
      }
    });
  }

  async function loadSettings() {
    try {
      const res = await fetch("/admin/site-config");
      const site = await parseResponse(res);
      document.getElementById("site-name-input").value = site.name || "";
      document.getElementById("site-tagline-input").value = site.tagline || "";
      document.getElementById("site-email-input").value = site.contactEmail || "";
    } catch (e) { /* ignore */ }
  }

  async function loadStats() {
    const res = await fetch("/admin/stats");
    if (!res.ok) return;
    const data = await parseResponse(res);
    document.getElementById("stat-row").innerHTML = `
      <div class="stat-box"><b>${data.totalProducts}</b><span>ressources publiées</span></div>
      <div class="stat-box"><b>${data.totalSales}</b><span>ventes réalisées</span></div>
      <div class="stat-box"><b>${data.revenueFormatted}</b><span>chiffre d'affaires cumulé</span></div>`;
  }

  async function loadProducts() {
    const res = await fetch("/admin/products");
    const products = await parseResponse(res);
    const body = document.getElementById("products-body");
    if (!products.length) {
      body.innerHTML = `<tr><td colspan="5">Aucune ressource publiée pour l'instant.</td></tr>`;
      return;
    }
    body.innerHTML = products
      .map(
        (p) => `
      <tr data-id="${p.id}">
        <td>${escapeHtml(p.title)}</td>
        <td>${escapeHtml(p.category || "—")}</td>
        <td>${euros(p.price)}</td>
        <td><span class="badge ${p.active !== false ? "on" : "off"}">${p.active !== false ? "En ligne" : "Masquée"}</span></td>
        <td class="row-actions">
          <button data-action="toggle">${p.active !== false ? "Masquer" : "Publier"}</button>
          <button data-action="edit">Modifier</button>
          <button data-action="delete">Supprimer</button>
        </td>
      </tr>`
      )
      .join("");

    body.querySelectorAll("tr").forEach((row) => {
      const id = row.dataset.id;
      const product = products.find((p) => p.id === id);
      row.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
        try {
          const res = await fetch("/admin/products/" + id, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: product.active === false }),
          });
          const data = await parseResponse(res);
          if (!res.ok) throw new Error(data.error || "Erreur lors de la mise à jour.");
          showToast(product.active === false ? `« ${product.title} » est de nouveau en ligne ✓` : `« ${product.title} » est masquée ✓`);
          loadProducts();
        } catch (err) {
          showToast(err.message, true);
        }
      });
      row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        if (!confirm(`Supprimer définitivement « ${product.title} » ?`)) return;
        try {
          const res = await fetch("/admin/products/" + id, { method: "DELETE" });
          const data = await parseResponse(res);
          if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression.");
          showToast(`« ${product.title} » a été supprimée ✓`);
          loadProducts();
          loadStats();
        } catch (err) {
          showToast(err.message, true);
        }
      });
      row.querySelector('[data-action="edit"]').addEventListener("click", async () => {
        const title = prompt("Titre :", product.title);
        if (title === null || !title.trim()) return;
        const priceStr = prompt("Prix en euros :", (product.price / 100).toFixed(2));
        if (priceStr === null) return;
        const priceValue = parseFloat(String(priceStr).replace(",", "."));
        if (!Number.isFinite(priceValue) || priceValue < 0.5) {
          showToast("Prix invalide : indiquez un nombre d'au moins 0,50 €.", true);
          return;
        }
        const description = prompt("Description :", product.description);
        if (description === null || !description.trim()) return;
        try {
          const res = await fetch("/admin/products/" + id, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, price: priceValue, description }),
          });
          const data = await parseResponse(res);
          if (!res.ok) throw new Error(data.error || "Erreur lors de la modification.");
          showToast(`« ${data.title} » a été mise à jour ✓`);
          loadProducts();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });
  }

  async function loadSales() {
    const res = await fetch("/admin/purchases");
    const sales = await parseResponse(res);
    const body = document.getElementById("sales-body");
    if (!sales.length) {
      body.innerHTML = `<tr><td colspan="6">Aucune vente pour l'instant.</td></tr>`;
      return;
    }
    body.innerHTML = sales
      .map(
        (s) => `
      <tr>
        <td>${escapeHtml(s.code)}</td>
        <td>${escapeHtml(s.productTitle)}</td>
        <td>${euros(s.amount)}</td>
        <td>${escapeHtml(s.email || "—")}</td>
        <td>${new Date(s.createdAt).toLocaleString("fr-FR")}</td>
        <td>${s.downloadCount || 0}</td>
      </tr>`
      )
      .join("");
  }

  boot();
})();
