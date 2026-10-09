import fs from 'node:fs';
import path from 'node:path';
import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';

// Les fiches de la bibliothèque sont lues dans public/bibliotheque/ au moment du build :
// une fiche ajoutée ou retirée suit sans qu'on pense à cette liste.
function fichesBibliotheque(): string[] {
  const dossier = path.join(process.cwd(), 'public', 'bibliotheque');
  return fs
    .readdirSync(dossier)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => f.replace(/\.html$/, ''))
    .sort();
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site.url,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${site.url}/bibliotheque`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${site.url}/calculateur`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...fichesBibliotheque().map((slug) => ({
      url: `${site.url}/bibliotheque/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
