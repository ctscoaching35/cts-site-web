/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 85, 90],
  },
  // Décommente la ligne ci-dessous pour un export statique pur (Netlify, GitHub Pages, etc.)
  // Sur Vercel, laisser commenté pour bénéficier de l'optimisation d'images.
  // output: 'export',
};

export default nextConfig;
