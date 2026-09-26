# Boutique de ressources pédagogiques numériques

Site complet pour vendre **tout type de fichier** (PDF, Word, HTML, Excel, images, ZIP...), avec paiement unique par carte (Stripe) et génération automatique d'un **code d'accès** permettant de télécharger le fichier (à volonté, pas de limite de nombre de téléchargements).

- Boutique publique : catalogue, fiche produit, paiement, page « j'ai un code »
- Espace créateur protégé par un mot de passe **que vous choisissez depuis le site lui-même** (pas dans le code), avec gestion des produits, suivi des ventes et personnalisation du nom de la boutique
- Stockage simple par fichiers JSON (aucune base de données à installer pour démarrer)
- Aucune donnée bancaire ne transite par votre serveur : c'est Stripe qui gère le paiement
- **Conçu pour être publié tel quel sur GitHub** : aucun mot de passe ni secret n'est écrit dans le code (voir section 0)

Le site est livré avec le nom **MAJOLÉO** par défaut (modifiable en un clic depuis l'onglet Paramètres de l'espace créateur, voir section 3). Avant de communiquer largement sous ce nom, une vérification rapide et gratuite est recommandée : la base [INPI](https://data.inpi.fr/marques) pour les marques françaises déjà déposées, et la disponibilité du nom de domaine (majoleo.fr, majoleo.com...) auprès d'un registrar comme [OVH](https://www.ovhcloud.com/fr/domains/) ou [Gandi](https://www.gandi.net/fr).

---

## 0. Publier ce projet sur GitHub

Ce dépôt est prêt à être publié tel quel, y compris en **dépôt public** : le `.gitignore` exclut déjà `.env`, `node_modules/` et `data/` (qui contiendra vos produits, vos ventes et le mot de passe haché de votre espace créateur). Rien de sensible ne part sur GitHub.

```bash
cd edu-store
git init
git add .
git commit -m "Premier envoi de la boutique"
```

Puis sur [github.com](https://github.com/new), créez un nouveau dépôt (vide, sans README ni licence — vous les avez déjà), et suivez les commandes qu'il vous propose, du type :

```bash
git remote add origin https://github.com/votre-compte/votre-depot.git
git branch -M main
git push -u origin main
```

**Votre mot de passe créateur ne se configure pas dans le code.** À la toute première ouverture de `/admin.html` sur votre serveur (local ou en ligne), un écran vous demandera de créer ce mot de passe ; il sera stocké haché dans `data/config.json`, un fichier qui ne sera jamais envoyé sur GitHub. Vous pourrez le changer à tout moment depuis l'onglet « Paramètres » de l'espace créateur — et changer aussi à ce même endroit le nom de la boutique, le slogan et l'e-mail de contact affichés sur le site, sans toucher au code.

Si vous forkez ou clonez ce dépôt sur un nouveau serveur, l'écran de création de mot de passe réapparaîtra automatiquement puisque `data/config.json` n'existe pas encore à cet endroit.

### Utiliser StackBlitz

Ce projet fonctionne sur [StackBlitz](https://stackblitz.com) (Node.js dans le navigateur). Deux points d'attention propres à cet environnement :

- **Structure des dossiers** : `package.json`, `server.js`, etc. doivent se trouver à la **racine** du projet StackBlitz, pas dans un sous-dossier. Si vous importez ce zip en le glissant dans l'explorateur de fichiers, assurez-vous d'ouvrir le dossier `edu-store` et d'en glisser le **contenu**, pas le dossier lui-même — sinon tout se retrouve imbriqué d'un niveau de trop et le serveur ne retrouve plus ses fichiers (`public/`, `data/`...).
- **`crypto.scryptSync` ne fonctionne pas sur StackBlitz** (bug connu de leur environnement Node "WebContainer", qui déclenche une erreur du type `TypeError: p.run is not a function` — voir [ce ticket](https://github.com/stackblitz/webcontainer-core/issues/1851)). Ce projet utilise donc `crypto.pbkdf2Sync` à la place pour le hachage du mot de passe créateur, qui fonctionne aussi bien sur StackBlitz qu'en local ou sur un vrai serveur.

---

## 1. Installation locale

Prérequis : [Node.js](https://nodejs.org) version 18 ou plus récente.

```bash
cd edu-store
npm install
cp .env.example .env
```

Ouvrez `.env` et renseignez au minimum `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` (voir section 2 ci-dessous). Il n'y a rien à faire pour le mot de passe créateur : il se configure depuis le site (voir section 0).

Puis démarrez :

```bash
npm start
```

Le site est accessible sur http://localhost:3000, l'espace créateur sur http://localhost:3000/admin.html (un écran de création de mot de passe s'affiche au tout premier accès).

Sans clé Stripe valide, tout fonctionne (catalogue, espace créateur) sauf le bouton « Acheter », qui renverra une erreur propre tant que Stripe n'est pas configuré.

---

## 2. Configurer Stripe (paiement réel)

1. Créez un compte sur [stripe.com](https://stripe.com) (gratuit, commission uniquement sur les ventes réalisées).
2. Dans le Tableau de bord Stripe, activez le **mode test** (interrupteur en haut à droite) pour vos premiers essais.
3. Allez dans **Développeurs > Clés API** et copiez la « Clé secrète » (`sk_test_...`) dans `STRIPE_SECRET_KEY`.
4. Configurez le webhook, qui prévient votre serveur qu'un paiement a réussi :
   - **En local**, le plus simple est le [Stripe CLI](https://stripe.com/docs/stripe-cli) :
     ```bash
     stripe listen --forward-to localhost:3000/webhook/stripe
     ```
     La commande affiche un secret `whsec_...` à copier dans `STRIPE_WEBHOOK_SECRET`.
   - **En production**, dans le Tableau de bord Stripe : **Développeurs > Webhooks > Ajouter un endpoint**, avec pour URL `https://votre-domaine.fr/webhook/stripe` et l'événement `checkout.session.completed`. Stripe vous donne alors un « Signing secret » à mettre dans `STRIPE_WEBHOOK_SECRET`.
5. Pour tester un vrai paiement en mode test, utilisez la carte `4242 4242 4242 4242`, une date future et n'importe quel CVC.
6. Une fois prêt, repassez en clés `sk_live_...` / webhook live pour encaisser de vrais paiements.

**Important : sans webhook correctement configuré, le code d'accès n'est jamais généré**, même si le client a payé. Testez toujours l'achat complet (jusqu'à voir le code s'afficher) avant de mettre le site en ligne pour de vrai.

---

## 3. Ajouter vos ressources

1. Allez sur `/admin.html`, connectez-vous avec votre mot de passe créateur.
2. Onglet « Ajouter une ressource » : titre, description, catégorie, formats affichés (`pdf`, `html`, `docx`, `xlsx`, `zip`... — c'est juste indicatif pour les visiteurs), prix, et le fichier à vendre. **N'importe quel type de fichier est accepté**, pas seulement PDF/HTML/Word. Une image de couverture est optionnelle.
3. Le produit apparaît aussitôt dans le catalogue public.
4. Onglet « Ventes » : suivez en temps réel les achats, les codes générés et le nombre de téléchargements par vente.
5. Onglet « Paramètres » : changez le nom de la boutique, le slogan, l'e-mail de contact, ou votre mot de passe créateur, directement depuis le site.

---

## 4. Déploiement en ligne

N'importe quel hébergeur qui exécute Node.js fonctionne (Render, Railway, Fly.io, un VPS classique, etc.). Étapes générales :

1. Déployez le contenu de ce dossier (hors `node_modules`, régénéré automatiquement par l'hébergeur via `npm install`).
2. Définissez les variables d'environnement du fichier `.env` dans l'interface de votre hébergeur (jamais dans le code ou sur GitHub).
3. Mettez à jour `BASE_URL` avec l'adresse réelle de votre site (`https://...`), sinon les redirections de paiement pointeront vers `localhost`.
4. Ajoutez le webhook Stripe en production comme indiqué en section 2.
5. **Sauvegardez régulièrement le dossier `data/` (et `uploads/`)** : c'est là que vivent vos produits et l'historique des ventes. Sur un hébergeur à système de fichiers éphémère (certains plans gratuits), ces dossiers peuvent être réinitialisés à chaque déploiement — dans ce cas, montez un volume persistant ou migrez vers une vraie base de données (voir section 6).

---

## 5. Ce qu'il faut savoir avant de vendre pour de vrai (sécurité)

Ce projet est fonctionnel et testé, mais quelques points méritent votre attention avant un usage commercial sérieux :

- **Mot de passe créateur unique** : `/admin.html` protège l'accès par un seul mot de passe partagé (pas de comptes multiples, pas de double authentification). Choisissez un mot de passe long (8 caractères minimum imposés, mais visez plutôt 12+) et ne le partagez qu'avec des personnes de confiance. Il est haché (jamais stocké en clair) dans `data/config.json`.
- **HTTPS obligatoire en production** : la plupart des hébergeurs (Render, Railway...) le fournissent automatiquement. Sans HTTPS, mot de passe admin et cookies de session circuleraient en clair.
- **Stockage par fichiers JSON** : très bien pour démarrer et jusqu'à quelques milliers de ventes/produits. Au-delà, ou si vous avez plusieurs administrateurs simultanés, migrez vers une vraie base de données (PostgreSQL, MySQL...).
- **Codes d'accès non expirables et réutilisables** : un client peut retélécharger indéfiniment avec son code. C'est un choix délibéré (confort client), mais cela veut aussi dire qu'un code divulgué permet à quelqu'un d'autre de télécharger le fichier. Si vous voulez limiter le nombre de téléchargements par code, c'est une modification simple dans `server.js` (voir la route `/download/:code`, variable `downloadCount`).
- **Pas d'envoi d'e-mail automatique** : le code s'affiche sur la page de confirmation après paiement, mais n'est pas renvoyé par e-mail. Si le client ferme l'onglet trop vite, il devra utiliser Stripe (reçu de paiement, resend receipt) ou vous contacter. Ajouter un envoi d'e-mail automatique (ex. avec [Resend](https://resend.com) ou [Nodemailer](https://nodemailer.com)) est une amélioration simple à greffer dans la fonction `handlePaidSession` de `server.js`.

---

## 6. Pour aller plus loin (idées d'amélioration)

- Envoi automatique du code par e-mail après achat
- Compte client pour retrouver tous ses achats sans ressaisir de code à chaque fois
- Codes promo / réductions
- Aperçu partiel du PDF avant achat
- Migration vers une vraie base de données pour un gros catalogue
- Plusieurs comptes administrateurs avec des rôles différents
- Statistiques de vente plus poussées (par période, par catégorie)

---

## 7. Structure du projet

```
edu-store/
├── server.js            Serveur Express : API, paiement, webhook, admin
├── db.js                 Petite couche de stockage JSON
├── data/                 products.json et purchases.json (créés automatiquement)
├── uploads/               Fichiers vendus (PDF/HTML/Word) — jamais accessibles directement
├── public/
│   ├── index.html         Boutique
│   ├── merci.html          Page de confirmation après paiement
│   ├── admin.html         Espace vendeur
│   ├── style.css           Habillage visuel
│   ├── app.js               Logique de la boutique
│   ├── admin.js            Logique de l'espace vendeur
│   └── uploads/             Images de couverture (publiques)
├── .env.example
└── package.json
```
