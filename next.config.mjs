/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // L'indicateur de développement de Next couvrait l'onglet « Aujourd'hui » de l'app (/app),
  // dont la barre d'onglets occupe le bas de l'écran. Développement seulement.
  devIndicators: false,
  // Essayer l'app sur un téléphone du même Wi-Fi pendant le développement : Next 16 refuse par
  // défaut les appareils qui arrivent par le nom du Mac sur le réseau (MonMac.local) ou son
  // adresse locale (192.168.x.x). Développement seulement ; sans effet en production.
  allowedDevOrigins: ['*.local', '192.168.*.*'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 85, 90],
  },
  // Bibliothèque : les fiches sont des pages HTML statiques (public/bibliotheque/),
  // servies à une adresse sans extension — celle qu'impriment les QR codes des plans
  // (https://www.cts-coaching.com/bibliotheque/<slug>). Les fichiers réels
  // (fiche.css) passent avant ces réécritures.
  async rewrites() {
    return [
      { source: '/bibliotheque', destination: '/bibliotheque/index.html' },
      { source: '/bibliotheque/:slug', destination: '/bibliotheque/:slug.html' },
      // Le calculateur « Ton profil de traileur » : une page statique (public/calculateur.html),
      // décision coach du 09/10/2026 (une page outil à part, liée depuis le menu et les fiches).
      { source: '/calculateur', destination: '/calculateur.html' },
    ];
  },
  // Décommente la ligne ci-dessous pour un export statique pur (Netlify, GitHub Pages, etc.)
  // Sur Vercel, laisser commenté pour bénéficier de l'optimisation d'images.
  // ATTENTION : un export statique ignore les réécritures ci-dessus, donc les adresses
  // /bibliotheque/<fiche> imprimées dans les QR codes des PDF (voir README, option 3).
  // output: 'export',
};

export default nextConfig;
