const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
// Remplace 'your_stripe_secret_key' par ta clé secrète Stripe ou utilise une variable d'environnement
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'your_stripe_secret_key');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONFIGURATION DE LA BASE DE DONNÉES SQLITE
// ==========================================
const dbFile = path.join(__dirname, 'data', 'majoleo.db');
const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error("Erreur d'ouverture de la base de données SQLite", err.message);
    } else {
        console.log("Connecté à la base de données SQLite.");
    }
});

// Création des tables si elles n'existent pas
db.serialize(() => {
    // Table des produits
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        fileUrl TEXT,
        category TEXT,
        active INTEGER DEFAULT 1,
        createdAt TEXT
    )`);

    // Table de configuration (dont le mot de passe admin)
    db.run(`CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // Table des achats / ventes
    db.run(`CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        productId TEXT,
        amount REAL,
        customerEmail TEXT,
        createdAt TEXT
    )`);
});

// ==========================================
// 2. MIDDLEWARES & CONFIGURATION EXPRESS
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Configuration des sessions (pour sécuriser l'admin)
app.use(session({
    secret: process.env.SESSION_SECRET || 'majoleo-secret-key-change-it',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 } // Session de 7 jours
}));

// Configuration de Multer pour l'upload des fichiers
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

// Middleware de protection Admin
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ error: "Accès non autorisé. Veuillez vous connecter." });
};

// ==========================================
// 3. ROUTES PUBLIQUES (CLIENTS)
// ==========================================

// Afficher les produits actifs
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products WHERE active = 1", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Configuration du site
app.get('/api/site-config', (req, res) => {
    db.all("SELECT key, value FROM config", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const config = {};
        rows.forEach(row => { config[row.key] = row.value; });
        res.json({
            name: config.name || "Majoléo",
            tagline: config.tagline || "Apprendre, c’est notre terrain de jeu",
            contactEmail: config.contactEmail || ""
        });
    });
});

// Création d'une session de paiement Stripe (Checkout)
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { items } = req.body; // Liste des produits achetés
        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Le panier est vide." });
        }

        // Construction des lignes pour Stripe
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'eur',
                product_data: { name: item.title },
                unit_amount: Math.round(item.price * 100), // Stripe attend des centimes
            },
            quantity: 1,
        }));

        const sessionStripe = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/index.html`,
        });

        res.json({ url: sessionStripe.url });
    } catch (error) {
        console.error("Erreur Stripe:", error);
        res.status(500).json({ error: "Erreur lors de la création du paiement." });
    }
});

// ==========================================
// 4. ROUTES D'AUTHENTIFICATION ADMIN
// ==========================================

app.get('/admin/session', (req, res) => {
    db.get("SELECT value FROM config WHERE key = 'password'", [], (err, row) => {
        const configured = !!row;
        res.json({
            configured: configured,
            authenticated: !!(req.session && req.session.isAdmin)
        });
    });
});

app.post('/admin/setup', (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères." });
    }

    db.run("INSERT OR REPLACE INTO config (key, value) VALUES ('password', ?)", [password], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        req.session.isAdmin = true;
        res.json({ success: true });
    });
});

app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    db.get("SELECT value FROM config WHERE key = 'password'", [], (err, row) => {
        if (err || !row) return res.status(401).json({ error: "Configuration introuvable." });

        if (password === row.value) {
            req.session.isAdmin = true;
            res.json({ success: true });
        } else {
            res.status(401).json({ error: "Mot de passe incorrect." });
        }
    });
});

app.post('/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// ==========================================
// 5. GESTION DES PRODUITS (PROTÉGÉ PAR ADMIN)
// ==========================================

app.get('/admin/products', requireAdmin, (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/admin/products', requireAdmin, upload.any(), (req, res) => {
    const { title, description, price, category } = req.body;
    let filePath = '';
    if (req.files && req.files.length > 0) {
        const mainFile = req.files.find(f => f.fieldname === 'file') || req.files[0];
        filePath = `/uploads/${mainFile.filename}`;
    }

    const id = Date.now().toString();
    const createdAt = new Date().toISOString();
    const numericPrice = parseFloat(price) || 0;

    const query = `INSERT INTO products (id, title, description, price, fileUrl, category, active, createdAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`;
    
    db.run(query, [id, title || "Sans titre", description || "", numericPrice, filePath, category || "Général", createdAt], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id, title, description, price: numericPrice, fileUrl: filePath, category, active: 1 });
    });
});

app.put('/admin/products/:id', requireAdmin, upload.any(), (req, res) => {
    const productId = req.params.id;
    const { title, description, price, active, category } = req.body;

    db.get("SELECT * FROM products WHERE id = ?", [productId], (err, product) => {
        if (err || !product) return res.status(404).json({ error: "Produit introuvable." });

        let filePath = product.fileUrl;
        if (req.files && req.files.length > 0) {
            const mainFile = req.files.find(f => f.fieldname === 'file') || req.files[0];
            filePath = `/uploads/${mainFile.filename}`;
            // Supprimer l'ancien fichier s'il existe
            if (product.fileUrl) {
                const oldPath = path.join(__dirname, 'public', product.fileUrl);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        const newTitle = title !== undefined ? title : product.title;
        const newDesc = description !== undefined ? description : product.description;
        const newPrice = price !== undefined ? parseFloat(price) : product.price;
        const newActive = active !== undefined ? (active ? 1 : 0) : product.active;
        const newCat = category !== undefined ? category : product.category;

        const query = `UPDATE products SET title = ?, description = ?, price = ?, fileUrl = ?, category = ?, active = ? WHERE id = ?`;
        db.run(query, [newTitle, newDesc, newPrice, filePath, newCat, newActive, productId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Produit mis à jour." });
        });
    });
});

app.delete('/admin/products/:id', requireAdmin, (req, res) => {
    const productId = req.params.id;
    db.get("SELECT fileUrl FROM products WHERE id = ?", [productId], (err, product) => {
        if (product && product.fileUrl) {
            const filePath = path.join(__dirname, 'public', product.fileUrl);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        db.run("DELETE FROM products WHERE id = ?", [productId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// ==========================================
// 6. LANCEMENT DU SERVEUR
// ==========================================
app.listen(PORT, () => {
    console.log(`Serveur Majoléo démarré sur le port ${PORT}`);
});
