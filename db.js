// Stockage simple par fichiers JSON. Suffisant pour démarrer / petit volume.
// Pour un gros volume, remplacer par une vraie base (Postgres, SQLite, etc.)
// sans changer l'API de ce module (getProducts, saveProducts, ...).
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const PURCHASES_FILE = path.join(DATA_DIR, "purchases.json");

function ensureFile(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  }
}

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  ensureFile(PRODUCTS_FILE, []);
  ensureFile(PURCHASES_FILE, []);
}

// Verrou d'écriture très simple pour éviter deux écritures concurrentes
// sur le même fichier (le webhook Stripe et l'admin peuvent écrire en même temps).
let writeChain = Promise.resolve();
function readJSON(file) {
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`Erreur de lecture ${file}:`, err.message);
    return [];
  }
}
function writeJSON(file, data) {
  writeChain = writeChain.then(
    () =>
      new Promise((resolve, reject) => {
        const tmp = file + ".tmp";
        fs.writeFile(tmp, JSON.stringify(data, null, 2), (err) => {
          if (err) return reject(err);
          fs.rename(tmp, file, (err2) => (err2 ? reject(err2) : resolve()));
        });
      })
  );
  return writeChain;
}

init();

module.exports = {
  getProducts: () => readJSON(PRODUCTS_FILE),
  saveProducts: (list) => writeJSON(PRODUCTS_FILE, list),
  getPurchases: () => readJSON(PURCHASES_FILE),
  savePurchases: (list) => writeJSON(PURCHASES_FILE, list),
};
