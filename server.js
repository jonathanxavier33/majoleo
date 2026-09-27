const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURATION & MIDDLEWARES
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Pour servir le front-end et les uploads

// Configuration de Multer pour l'upload des fichiers pédagogiques et images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/uploads';
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

// ==========================================
// GESTION DE LA SESSION ADMIN (Sécurisée)
// ==========================================
// Utilisation d'un objet d'état ou d'un token simple en mémoire (à coupler avec des cookies/JWT en prod)
let adminState = {
    isAuthenticated: false,
    lastLogin: null
};

// Middleware pour protéger les routes administrateur
const requireAdmin = (req, res, next) => {
    if (!adminState.isAuthenticated) {
        return res.status(401).json({ error: "Accès refusé. Veuillez vous connecter en tant qu'administrateur." });
    }
    next();
};

// ==========================================
// BASE DE DONNÉES TEMPORAIRE (Simulation)
// ==========================================
let products = [
    { id: 1, title: "Escape Game Cuisine - Niveau 1", price: 9.99, file: "escape_cuisine.zip" },
    { id: 2, title: "Fiche Vocabulaire Boucher-Charcutier", price: 4.99, file: "boucherie_vocab.pdf" }
];

// ==========================================
// ROUTES PUBLIQUES
// ==========================================

// Récupérer tous les produits
app.get('/api/products', (req, res) => {
    res.json(products);
});

// Récupérer un produit par son ID
app.get('/api/products/:id', (req, res) => {
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: "Produit introuvable." });
    res.json(product);
});

// ==========================================
// ROUTES D'AUTHENTIFICATION ADMIN
// ==========================================

// Connexion Admin
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    // Remplace ces valeurs par tes propres identifiants sécurisés (ou variables d'environnement)
    const ADMIN_USER = process.env.ADMIN_USER || "admin";
    const ADMIN_PASS = process.env.ADMIN_PASS || "lingoskill2026";

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        adminState.isAuthenticated = true;
        adminState.lastLogin = new Date();
        return res.json({ success: true, message: "Connexion administrateur réussie." });
    }
    
    res.status(401).json({ success: false, error: "Identifiants incorrects." });
});

// Déconnexion Admin
app.post('/admin/logout', requireAdmin, (req, res) => {
    adminState.isAuthenticated = false;
    adminState.lastLogin = null;
    res.json({ success: true, message: "Déconnexion réussie." });
});

// Vérifier l'état de la session admin
app.get('/admin/session', (req, res) => {
    res.json({ isAuthenticated: adminState.isAuthenticated });
});

// ==========================================
// ROUTES ADMINISTRATEUR (PROTÉGÉES)
// ==========================================

// Créer un produit (avec upload de fichier optionnel)
app.post('/admin/products', requireAdmin, upload.single('resourceFile'), (req, res) => {
    const { title, price } = req.body;
    
    if (!title || !price) {
        return res.status(400).json({ error: "Le titre et le prix sont obligatoires." });
    }

    const newProduct = {
        id: products.length > 0 ? products[products.length - 1].id + 1 : 1,
        title,
        price: parseFloat(price),
        file: req.file ? req.file.filename : null
    };

    products.push(newProduct);
    res.status(201).json({ message: "Produit créé avec succès", product: newProduct });
});

// Modifier un produit existant
app.put('/admin/products/:id', requireAdmin, upload.single('resourceFile'), (req, res) => {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);

    if (!product) {
        return res.status(404).json({ error: "Produit introuvable." });
    }

    const { title, price } = req.body;
    if (title) product.title = title;
    if (price) product.price = parseFloat(price);
    
    // Si un nouveau fichier est uploadé, on met à jour le nom du fichier
    if (req.file) {
        // Optionnel : supprimer l'ancien fichier du disque pour faire du ménage
        if (product.file && fs.existsSync(path.join('public/uploads', product.file))) {
            fs.unlinkSync(path.join('public/uploads', product.file));
        }
        product.file = req.file.filename;
    }

    res.json({ message: "Produit mis à jour avec succès", product });
});

// Supprimer un produit
app.delete('/admin/products/:id', requireAdmin, (req, res) => {
    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ error: "Produit introuvable." });
    }

    // Supprimer le fichier associé du serveur si besoin
    const product = products[productIndex];
    if (product.file && fs.existsSync(path.join('public/uploads', product.file))) {
        fs.unlinkSync(path.join('public/uploads', product.file));
    }

    products.splice(productIndex, 1);
    res.json({ message: "Produit supprimé avec succès." });
});

// ==========================================
// LANCEMENT DU SERVEUR
// ==========================================
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
