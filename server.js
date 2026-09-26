const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Configuration de Multer pour les fichiers pédagogiques
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Fichiers de données JSON
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PURCHASES_FILE = path.join(DATA_DIR, 'purchases.json');

// S'assurer que le dossier data existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Fonctions utilitaires
function readJson(file, defaultVal) {
  if (!fs.existsSync(file)) return defaultVal;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return defaultVal;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ------------------------------------------------------------------
// ROUTES PUBLIQUES
// ------------------------------------------------------------------

app.get('/api/products', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const activeProducts = products.filter(p => p.active !== false);
  res.json(activeProducts);
});

app.get('/api/site-config', (req, res) => {
  const config = readJson(CONFIG_FILE, {});
  res.json({
    name: config.name || "Boutique Pédagogique",
    tagline: config.tagline || "Ressources et contenus pour vos cours",
    contactEmail: config.contactEmail || ""
  });
});

// ------------------------------------------------------------------
// ROUTES ADMIN & SESSION
// ------------------------------------------------------------------

let adminSession = false;

app.get('/admin/session', (req, res) => {
  const config = readJson(CONFIG_FILE, {});
  const configured = !!config.password;
  res.json({
    configured: configured,
    authenticated: adminSession
  });
});

app.post('/admin/setup', (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    }
    const config = readJson(CONFIG_FILE, {});
    config.password = password;
    writeJson(CONFIG_FILE, config);
    adminSession = true;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la configuration." });
  }
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  const config = readJson(CONFIG_FILE, {});
  if (config.password && password === config.password) {
    adminSession = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Mot de passe incorrect." });
  }
});

app.post('/admin/logout', (req, res) => {
  adminSession = false;
  res.json({ success: true });
});

// ------------------------------------------------------------------
// GESTION DES PRODUITS (ESPACE CRÉATEUR)
// ------------------------------------------------------------------

app.get('/admin/products', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  res.json(products);
});

// Ajout d'un produit (gère tous les fichiers envoyés par le formulaire sans erreur)
app.post('/admin/products', upload.any(), (req, res) => {
  try {
    const { title, description, price, gumroadUrl, category } = req.body;
    
    let filePath = '';
    if (req.files && req.files.length > 0) {
      const mainFile = req.files.find(f => f.fieldname === 'file') || req.files[0];
      filePath = `/uploads/${mainFile.filename}`;
    }

    const newProduct = {
      id: Date.now().toString(),
      title: title || "Sans titre",
      description: description || "",
      price: Math.round(parseFloat(price) * 100) || 0,
      gumroadUrl: gumroadUrl || '#',
      fileUrl: filePath,
      category: category || "Général",
      active: true,
      createdAt: new Date().toISOString()
    };

    const products = readJson(PRODUCTS_FILE, []);
    products.push(newProduct);
    writeJson(PRODUCTS_FILE, products);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Erreur serveur:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du produit." });
  }
});

app.put('/admin/products/:id', (req, res) => {
  try {
    const productId = req.params.id;
    const products = readJson(PRODUCTS_FILE, []);
    const index = products.findIndex(p => p.id === productId);

    if (index === -1) {
      return res.status(404).json({ error: "Produit introuvable." });
    }

    const prod = products[index];
    if (req.body.title !== undefined) prod.title = req.body.title;
    if (req.body.description !== undefined) prod.description = req.body.description;
    if (req.body.price !== undefined) prod.price = Math.round(parseFloat(req.body.price) * 100);
    if (req.body.active !== undefined) prod.active = req.body.active;
    if (req.body.category !== undefined) prod.category = req.body.category;

    writeJson(PRODUCTS_FILE, products);
    res.json(prod);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
});

app.delete('/admin/products/:id', (req, res) => {
  try {
    const productId = req.params.id;
    let products = readJson(PRODUCTS_FILE, []);
    products = products.filter(p => p.id !== productId);
    writeJson(PRODUCTS_FILE, products);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
});

// ------------------------------------------------------------------
// STATS, VENTES ET PARAMÈTRES
// ------------------------------------------------------------------

app.get('/admin/stats', (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const purchases = readJson(PURCHASES_FILE, []);
  
  const totalRevenue = purchases.reduce((acc, s) => acc + (s.amount || 0), 0);
  
  res.json({
    totalProducts: products.length,
    totalSales: purchases.length,
    revenueFormatted: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalRevenue / 100)
  });
});

app.get('/admin/purchases', (req, res) => {
  const purchases = readJson(PURCHASES_FILE, []);
  res.json(purchases);
});

app.put('/admin/site-config', (req, res) => {
  try {
    const { name, tagline, contactEmail } = req.body;
    const config = readJson(CONFIG_FILE, {});
    if (name !== undefined) config.name = name;
    if (tagline !== undefined) config.tagline = tagline;
    if (contactEmail !== undefined) config.contactEmail = contactEmail;
    writeJson(CONFIG_FILE, config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la mise à jour des paramètres." });
  }
});

app.post('/admin/change-password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const config = readJson(CONFIG_FILE, {});
    
    if (config.password && currentPassword !== config.password) {
      return res.status(400).json({ error: "Ancien mot de passe incorrect." });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit faire au moins 8 caractères." });
    }

    config.password = newPassword;
    writeJson(CONFIG_FILE, config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du changement de mot de passe." });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
