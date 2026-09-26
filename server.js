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

// Configuration de Multer pour corriger le bug de téléchargement des fichiers
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
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');

// Route pour récupérer les produits
app.get('/api/products', (req, res) => {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    return res.json([]);
  }
  const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
  res.json(JSON.parse(data));
});

// Route admin pour ajouter un produit avec un fichier pédagogique
app.post('/api/products', upload.single('file'), (req, res) => {
  try {
    const { title, description, price, gumroadUrl } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : '';

    const newProduct = {
      id: Date.now().toString(),
      title,
      description,
      price: parseFloat(price) || 0,
      gumroadUrl: gumroadUrl || '#',
      fileUrl: filePath
    };

    let products = [];
    if (fs.existsSync(PRODUCTS_FILE)) {
      products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    }
    products.push(newProduct);
    
    // S'assurer que le dossier data existe
    const dataDir = path.dirname(PRODUCTS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));

    res.status(201).json({ success: true, product: newProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du produit." });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});