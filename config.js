// Configuration modifiable depuis le site lui-même (nom de la boutique, mot de passe
// créateur...), stockée dans data/config.json — un fichier volontairement exclu du
// dépôt Git (.gitignore) puisqu'il contient un secret (le hash du mot de passe).
// Cela permet de publier tout le code sur GitHub sans jamais y exposer de mot de passe.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CONFIG_FILE = path.join(__dirname, "data", "config.json");

const DEFAULT_SITE = {
  name: "MAJOLÉO",
  tagline: "Des ressources pédagogiques prêtes à enseigner, en un clic.",
  contactEmail: "contact@majoleo.fr",
};

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return { site: { ...DEFAULT_SITE }, admin: null };
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    return { site: { ...DEFAULT_SITE, ...(raw.site || {}) }, admin: raw.admin || null };
  } catch (err) {
    console.error("Erreur de lecture de la configuration :", err.message);
    return { site: { ...DEFAULT_SITE }, admin: null };
  }
}

function writeConfig(config) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Nombre d'itérations PBKDF2 : plus c'est élevé, plus c'est lent à casser par force
// brute, mais aussi plus lent à vérifier à chaque connexion. 120 000 est un bon
// compromis pour un usage mono-utilisateur (recommandation OWASP pour SHA-256).
const PBKDF2_ITERATIONS = 120000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, "sha256").toString("hex");
  return `${salt}:${PBKDF2_ITERATIONS}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) return false;
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const [salt, iterationsStr, hash] = parts;
  const iterations = parseInt(iterationsStr, 10) || PBKDF2_ITERATIONS;
  const computed = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha256").toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(computed, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  getSite: () => readConfig().site,
  saveSite: (site) => {
    const config = readConfig();
    config.site = { ...config.site, ...site };
    writeConfig(config);
    return config.site;
  },
  isConfigured: () => !!readConfig().admin,
  setPassword: (password) => {
    const config = readConfig();
    config.admin = { passwordHash: hashPassword(password) };
    writeConfig(config);
  },
  checkPassword: (password) => {
    const config = readConfig();
    return !!config.admin && verifyPassword(password, config.admin.passwordHash);
  },
};
