# CTS Coaching — Site Vitrine

Site vitrine officiel de **CTS Coaching** (City To Summit), fondé par Juliette VINOT et Romain LETERME — kinésithérapeutes du sport et coachs trail à Rennes, kinés officiels de l'UTMB Mont-Blanc.

> **On accompagne des personnes, pas des kilomètres.**

---

## Stack technique

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — palette officielle CTS configurée
- **Framer Motion** — animations sobres (scroll reveal, parallaxe Hero)
- **next/font** — Montserrat (Google Fonts) servi en local
- **next/image** — optimisation AVIF / WebP automatique
- Aucune dépendance backend — formulaire en `mailto:`
- Déploiement agnostique : **Vercel** ou **Netlify** (instructions plus bas)

---

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de dev (http://localhost:3000)
npm run dev

# 3. Build de production
npm run build
npm run start
```

Pré-requis : Node.js 18.18+ (recommandé 20 LTS).

---

## Architecture des fichiers

```
CTS-site-web/
├── app/
│   ├── layout.tsx          # Métadonnées SEO globales, fonts, viewport
│   ├── page.tsx            # Composition de la page (assemblage des sections)
│   ├── globals.css         # Styles globaux + helpers (.btn, .eyebrow, etc.)
│   ├── sitemap.ts          # Génère /sitemap.xml automatiquement
│   └── robots.ts           # Génère /robots.txt automatiquement
│
├── components/
│   ├── Nav.tsx             # Header sticky (transparent → solide au scroll, menu mobile)
│   ├── Hero.tsx            # Section 1 — full screen + parallaxe
│   ├── Problem.tsx         # Section 2 — 3 colonnes traileur citadin
│   ├── About.tsx           # Section 3 — Juliette & Romain + UTMB credential + stats
│   ├── Offer.tsx           # Section 4 — Carte 80€/mois
│   ├── Testimonials.tsx    # Section 5 — 3 cas anonymisés
│   ├── Instagram.tsx       # Section 6 — Grille 6 posts
│   ├── Contact.tsx         # Section 7 — Formulaire + infos
│   ├── ContactForm.tsx     # Formulaire client (mailto:)
│   ├── Footer.tsx          # Footer avec navigation et contact
│   └── Reveal.tsx          # Helper Framer Motion pour scroll reveal
│
├── lib/
│   └── content.ts          # 🔑 TOUS LES TEXTES DU SITE — édite ici
│
├── public/
│   ├── logo/cts-logo.png   # Logo CTS (fond transparent)
│   ├── photos/             # Photos terrain (DSC_*.jpg)
│   ├── lifestyle/          # Juliette & Romain (IMG_*.jpeg)
│   └── instagram/          # (vide — réservé pour vrais posts IG)
│
├── tailwind.config.ts      # Palette officielle CTS
├── next.config.mjs         # Config Next + optimisation images
└── tsconfig.json
```

---

## Personnaliser le contenu

### Textes
**Tous les textes du site sont dans un seul fichier : `lib/content.ts`.**

Édite ce fichier, sauvegarde — Next.js recharge automatiquement.

```ts
// Exemple : modifier le titre du Hero
export const hero = {
  title: 'Du bitume',
  titleAccent: 'au sommet.',
  // ...
};
```

### Photos

Toutes les photos sont dans `public/`. Pour remplacer une photo :

1. **Hero** : remplace le fichier `public/photos/DSC_8334.jpg`,
   ou modifie `hero.background` dans `lib/content.ts`.
2. **Coachs** : modifie `about.juliette.photo` et `about.romain.photo`
   dans `lib/content.ts`.
3. **Témoignages** : modifie `testimonials.items[i].photo` dans `lib/content.ts`.
4. **Posts Instagram** : modifie `instagram.posts` (tableau de 6 chemins) dans `lib/content.ts`.

Les images sont automatiquement optimisées (AVIF/WebP) par Next.js — pas besoin de pré-traitement.

### Couleurs

La palette officielle est figée dans `tailwind.config.ts` :

| Variable Tailwind | HEX     | Usage                                     |
|-------------------|---------|-------------------------------------------|
| `teal`            | #0C6E5F | Titres forts, CTA, accents                |
| `teal-light`      | #138F7C | Hover, accents secondaires                |
| `indigo`          | #2F2D4E | Fonds sombres, textes, nav                |
| `indigo-dark`     | #1F1D38 | Footer, dégradés                          |
| `sand`            | #F3F7F0 | Fonds clairs (sections respiration)       |

### Logo

Pour ajouter les versions blanches du logo (mentionnées dans le brief mais non fournies) :
- Dépose `Logo_CTS_fond_blanc_pur.png` dans `public/logo/`
- Met à jour les références dans `Nav.tsx` et `Footer.tsx` au besoin

---

## SEO — Checklist

| Élément                | Statut | Localisation                              |
|------------------------|--------|-------------------------------------------|
| `<title>`              | ✅     | `app/layout.tsx` → `metadata.title`       |
| Meta description       | ✅     | `app/layout.tsx` → `metadata.description` |
| Mots-clés              | ✅     | `app/layout.tsx` → `metadata.keywords`    |
| Open Graph             | ✅     | `app/layout.tsx` → `metadata.openGraph`   |
| og:image               | ✅     | `/photos/DSC_8334.jpg` (1200×630 recommandé) |
| Twitter Card           | ✅     | `app/layout.tsx` → `metadata.twitter`     |
| `lang="fr"`            | ✅     | `app/layout.tsx`                          |
| `theme-color`          | ✅     | `app/layout.tsx` → `viewport`             |
| `sitemap.xml`          | ✅     | `app/sitemap.ts` (auto-généré)            |
| `robots.txt`           | ✅     | `app/robots.ts` (auto-généré)             |
| Canonical URL          | ✅     | `app/layout.tsx` → `alternates.canonical` |
| Favicons / Apple icon  | ✅     | Logo CTS                                   |
| Images optimisées      | ✅     | `next/image` AVIF + WebP                  |
| Lazy loading           | ✅     | Default Next.js (sauf Hero `priority`)    |
| Headings hiérarchisés  | ✅     | Un `<h1>` (Hero) + `<h2>` par section     |
| Smooth scroll          | ✅     | `globals.css`                             |
| Reduced motion         | ✅     | `useReducedMotion()` dans Reveal & Hero    |

> ⚠️ **À faire avant mise en ligne** : remplacer `https://www.cts-coaching.com` dans `lib/content.ts` (`site.url`) par l'URL réelle si différente.

---

## Déploiement

### Option 1 — Vercel (recommandé)

```bash
# Avec la CLI Vercel
npm i -g vercel
vercel
```

Ou via l'interface : importe le repo GitHub sur [vercel.com](https://vercel.com).
Aucune config supplémentaire requise. Vercel détecte Next.js automatiquement.

### Option 2 — Netlify

1. Connecte le repo sur [netlify.com](https://netlify.com).
2. Build command : `npm run build`
3. Publish directory : `.next` (avec [@netlify/plugin-nextjs](https://docs.netlify.com/integrations/frameworks/next-js/overview/) — auto-installé)

### Option 3 — Export statique (GitHub Pages, OVH, etc.)

1. Décommente la ligne `output: 'export'` dans `next.config.mjs`.
2. Lance `npm run build`.
3. Le dossier `out/` contient le site statique à déposer sur ton hébergement.

> ⚠️ En mode export statique, l'optimisation d'images Next.js est désactivée. Les images servies sont les originales. Si nécessaire, pré-optimise-les avec [squoosh.app](https://squoosh.app) ou [sharp-cli](https://github.com/vseventer/sharp-cli).

---

## Domaine personnalisé

Une fois déployé :
- **Vercel** : Settings → Domains → ajoute `cts-coaching.com` et `www.cts-coaching.com`
- **Netlify** : Domain settings → Add custom domain
- Configure les DNS chez ton registrar selon les instructions affichées (CNAME ou A records)

---

## Performance

Le site est conçu pour atteindre **90+ sur tous les axes Lighthouse** :
- HTML statique pré-rendu (SSG)
- Images servies en AVIF/WebP, lazy-loaded
- Fonts chargées via `next/font` (zéro CLS)
- JavaScript côté client minimal (Framer Motion uniquement où nécessaire)
- CSS purgé par Tailwind en production

Pour tester : `npm run build && npm run start`, puis Lighthouse sur Chrome DevTools.

---

## Notes éditoriales

- Le formulaire de contact est en `mailto:` — pas de backend, le client mail s'ouvre avec le contenu pré-rempli. Pour passer à un service hébergé, voir **Formspree** (`<form action="https://formspree.io/f/xxxx" method="POST">`) ou **Resend** (route API).
- Les **témoignages** sont fictifs (M., L., A. — anonymisés). À remplacer par de vrais cas dès que le consentement est obtenu.
- Les **6 posts Instagram** affichés sont des photos terrain en placeholder. Quand de vraies captures de posts seront disponibles, dépose-les dans `public/instagram/` et met à jour `instagram.posts` dans `lib/content.ts`.

---

## Contacts éditoriaux

- Juliette VINOT — juliette@cts-coaching.com (à confirmer)
- Romain LETERME — romain@cts-coaching.com (à confirmer)
- Email général : ctscoaching35@gmail.com
- Instagram : [@cts.coaching](https://instagram.com/cts.coaching)

---

© CTS Coaching — Rennes
