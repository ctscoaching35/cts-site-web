/**
 * La bibliothèque de l'app : les fiches du site, lues dans son index (public/bibliotheque/
 * index.html), jamais recopiées — une fiche ajoutée au site apparaît dans l'app. Décision coach
 * du 07/10/2026 : l'app reprend toutes les fiches, celles du plan d'abord.
 * Côté serveur seulement (lecture du fichier).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type Fiche = { slug: string; titre: string; texte: string };
export type Famille = { titre: string; fiches: Fiche[] };

export function lireBibliotheque(): Famille[] {
  const html = readFileSync(path.join(process.cwd(), 'public', 'bibliotheque', 'index.html'), 'utf-8');
  const corps = html.slice(html.indexOf('<main>'));
  return corps
    .split('<h2>')
    .slice(1)
    .map((bloc) => ({
      titre: bloc.slice(0, bloc.indexOf('</h2>')).trim(),
      fiches: Array.from(
        bloc.matchAll(
          /<a class="carte" href="\/bibliotheque\/([\w-]+)"><span class="carte-titre">([^<]*)<\/span><span class="carte-texte">([^<]*)<\/span><\/a>/g
        ),
        ([, slug, titre, texte]) => ({ slug, titre, texte })
      ),
    }))
    .filter((f) => f.fiches.length > 0);
}

export const ficheParSlug = (familles: Famille[], slug: string) =>
  familles.flatMap((f) => f.fiches).find((f) => f.slug === slug);

// Les calculateurs du site (décision coach du 11/10/2026) : en haut de l'onglet Bibliothèque, ouverts
// comme une fiche. Lus dans la page qui les présente (public/calculateurs.html), jamais recopiés.
export type Calculateur = Fiche;

export function lireCalculateurs(): Calculateur[] {
  const html = readFileSync(path.join(process.cwd(), 'public', 'calculateurs.html'), 'utf-8');
  return Array.from(
    html.matchAll(
      /<a class="carte" href="\/(calculateur[\w-]*)"><span class="carte-titre">([^<]*)<\/span><span class="carte-texte">([^<]*)<\/span><\/a>/g
    ),
    ([, slug, titre, texte]) => ({ slug, titre, texte })
  );
}

export const calculateurParSlug = (calculateurs: Calculateur[], slug: string) =>
  calculateurs.find((c) => c.slug === slug);
