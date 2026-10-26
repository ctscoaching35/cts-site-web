#!/usr/bin/env node
/**
 * La bibliothèque CTS écrite dans le Nolio du coach (CTS_DOCTRINE_SEANCES.md dans le dépôt du moteur ; décision coach du
 * 26/10/2026, « reconstruire la barre latérale avec les familles de séance ») : les dossiers et les séances types du
 * moteur (cts_bibliotheque.catalogue, rendu en JSON), puis ses séances types à leur place — gardées, déplacées et
 * renommées sans toucher leur contenu, ou rangées dans les archives. Rien n'est jamais supprimé.
 *
 *   ./.venv/bin/python3 -c "import json, cts_bibliotheque as b; print(json.dumps(b.catalogue()))" > catalogue.json
 *   node scripts/ecrire-bibliotheque.mjs catalogue.json [--ecrire]
 *
 * Sans --ecrire, rien ne part : il dit ce qu'il ferait. Relancé, il retrouve ce qui existe déjà (un dossier par son nom
 * et son parent, une séance du moteur par son nom dans son dossier) et le met à jour au lieu de le doubler. Lit la clé
 * NOLIO_API_KEY_BIBLIOTHEQUE de .env.local (sans l'afficher).
 */
import nextEnv from '@next/env';
import { readFileSync } from 'node:fs';

nextEnv.loadEnvConfig(process.cwd());
const ecrire = process.argv.includes('--ecrire');
const chemin = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!chemin) throw new Error('Le catalogue (JSON de cts_bibliotheque.catalogue) manque.');
const catalogue = JSON.parse(readFileSync(chemin, 'utf8'));
// La clé du site n'a pas le droit d'écrire la bibliothèque (library:write) : une seconde clé, réservée à ce script,
// créée par le coach dans Nolio (droits library:read et library:write) et posée par lui dans .env.local.
const cle = (process.env.NOLIO_API_KEY_BIBLIOTHEQUE ?? process.env.NOLIO_API_KEY)?.trim();
if (!cle) throw new Error('NOLIO_API_KEY_BIBLIOTHEQUE manque.');

const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function nolio(methode, route, corps) {
  await attendre(150);
  const r = await fetch(`https://www.nolio.io/api/v2/${route}`, {
    method: methode, headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await r.text();
  const json = texte ? JSON.parse(texte) : null;
  if (r.status >= 300) throw new Error(`${methode} ${route} : ${r.status} ${texte.slice(0, 300)}`);
  return json;
}
async function tous(route) {
  const out = [];
  let apres = '';
  for (let i = 0; i < 30; i += 1) {
    const r = await nolio('GET', `${route}${route.includes('?') ? '&' : '?'}limit=100${apres ? `&starting_after=${apres}` : ''}`);
    out.push(...(r.data ?? []));
    if (!r.has_more || !(r.data ?? []).length) break;
    apres = r.data[r.data.length - 1].id;
  }
  return out;
}
const idDe = (x) => (x && typeof x === 'object' ? x.id : x) ?? null;

const dossiers = await tous('library/categories/');
const seances = await tous('library/training_frames/');
const journal = [];

// Un dossier par son nom et son parent ; créé s'il manque.
async function dossier(nom, parent = null) {
  const trouve = dossiers.find((d) => d.name === nom && idDe(d.parent) === parent && d.type === 'event');
  if (trouve) return trouve.id;
  journal.push(`dossier créé : ${parent ? '  › ' : ''}${nom}`);
  if (!ecrire) {
    dossiers.push({ id: `(nouveau:${nom})`, name: nom, parent, type: 'event' });
    return `(nouveau:${nom})`;
  }
  const d = await nolio('POST', 'library/categories/', { name: nom, type: 'event', ...(parent ? { parent } : {}) });
  dossiers.push(d);
  return d.id;
}

// Les dossiers et les séances du moteur.
for (const d of catalogue.dossiers) {
  const racine = await dossier(d.nom);
  for (const s of d.sous) {
    const id = await dossier(s.nom, racine);
    for (const x of s.seances) {
      const deja = seances.find((y) => y.name === x.name && idDe(y.category) === id);
      if (deja) {
        journal.push(`mise à jour : ${d.nom} › ${s.nom} › ${x.name}`);
        if (ecrire) await nolio('PATCH', `library/training_frames/${deja.id}/`, { ...x });
      } else {
        journal.push(`créée : ${d.nom} › ${s.nom} › ${x.name}`);
        if (ecrire) seances.push(await nolio('POST', 'library/training_frames/', { ...x, category: id }));
      }
    }
  }
}

// Les séances du coach : gardées (déplacées, renommées) ou archivées. Un nom porté par plusieurs séances : gardée, il
// faut lever le doute à la main ; archivée, toutes partent.
const archives = Object.values(catalogue.seances_du_coach).some((v) => v === catalogue.archives) ? await dossier(catalogue.archives) : null;
const parNom = (nom) => seances.filter((y) => y.name === nom);
for (const [nom, sort] of Object.entries(catalogue.seances_du_coach)) {
  const lesquelles = parNom(nom);
  if (!lesquelles.length) {
    journal.push(`introuvable (déjà déplacée ?) : ${nom}`);
    continue;
  }
  if (sort === catalogue.archives) {
    for (const y of lesquelles) {
      if (idDe(y.category) === archives) continue;
      journal.push(`archivée : ${nom}`);
      if (ecrire) await nolio('PATCH', `library/training_frames/${y.id}/`, { category: archives });
    }
    continue;
  }
  if (lesquelles.length > 1) {
    journal.push(`EN DOUBLE, laissée : ${nom} (${lesquelles.length})`);
    continue;
  }
  const racine = await dossier(sort.dossier);
  const id = await dossier(sort.sous, racine);
  journal.push(`gardée : ${nom} → ${sort.dossier} › ${sort.sous} › ${sort.nom}`);
  if (ecrire) await nolio('PATCH', `library/training_frames/${lesquelles[0].id}/`, { name: sort.nom, category: id });
}

console.log(journal.join('\n'));
console.log(`\n${journal.length} opérations${ecrire ? ' faites' : ' prévues (rien n’est parti : --ecrire pour les faire)'}.`);
