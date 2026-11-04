// La famille de chaque séance de qualité de la barre latérale, par son nom (C1, décision coach du 04/11/2026, « A ») :
// régénère lib/app/barreFamilles.ts depuis le catalogue du moteur (cts_bibliotheque.catalogue()), en lecture seule.
// Avec les noms d'avant les renommages (catalogue.renommees) et ceux des anciennes barres du moteur : les séances déjà
// dans Nolio les portent encore pendant les quatre semaines que lit la continuité.
//
//   node scripts/familles-barre.mjs            (le moteur dans ~/Site CTS ; sinon CTS_MOTEUR=<dossier>)
//
// À relancer après chaque changement de noms dans la barre, puis committer le fichier produit.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const moteur = process.env.CTS_MOTEUR ?? join(homedir(), 'Site CTS');
const brut = execFileSync(join(moteur, '.venv/bin/python3'),
  ['-c', 'import json, cts_bibliotheque as b; print(json.dumps({"catalogue": b.catalogue(), "mecanique": sorted(b.noms_mecanique_du_moteur())}))'],
  { cwd: moteur, maxBuffer: 256 * 1024 * 1024 });
const { catalogue, mecanique } = JSON.parse(String(brut));

// Les dossiers de qualité et leur famille, celle que lit la continuité (lib/app/classement.ts, FamilleLue). La mécanique
// aussi (D2, décision coach du 04/11/2026, « A ») : les navettes, le Myocrossmax et la montée sur tapis se lisaient
// Seuil 1, Tempo ou Seuil 2 par leur structure, et fixaient la marche de Seuil 1. Les autres (endurance, sortie longue,
// tests, sport croisé) restent lus par leur structure.
const familleDu = (dossier) => /Seuil 1/.test(dossier) ? 'seuil1' : /Tempo/.test(dossier) ? 'tempo' : /Seuil 2/.test(dossier) ? 'seuil2'
  : /VO2max/.test(dossier) ? 'vo2max' : /Allure de course/.test(dossier) ? 'allure' : /Sprint/.test(dossier) ? 'sprint'
  : /Mécanique/.test(dossier) ? 'mecanique' : null;
const normal = (nom) => String(nom).normalize('NFC').replace(/\s+/g, ' ').trim();

const familles = new Map();
const doubles = new Set();
const poser = (nom, famille) => {
  if (!famille || !nom) return;
  const cle = normal(nom);
  if (familles.has(cle) && familles.get(cle) !== famille) doubles.add(cle);
  familles.set(cle, famille);
};
let actuelles = 0;
let mecaniques = 0;
for (const d of catalogue.dossiers) {
  for (const s of d.sous ?? [{ seances: d.seances ?? [] }]) {
    for (const x of s.seances ?? []) {
      if (familleDu(d.nom) === 'mecanique') mecaniques += 1;
      else if (familleDu(d.nom)) actuelles += 1;
      poser(x.name, familleDu(d.nom));
    }
  }
}
for (const r of catalogue.renommees ?? []) poser(r.nom_avant, familleDu(r.dossier));
for (const a of catalogue.anciennes_du_moteur ?? []) poser(a.nom, familleDu(a.dossier));
// Les noms que le moteur écrit pour sa mécanique (« Navettes descentes actives », « Myocrossmax »…), sans la durée de
// la barre (cts_bibliotheque.noms_mecanique_du_moteur).
for (const nom of mecanique ?? []) poser(nom, 'mecanique');
for (const cle of doubles) familles.delete(cle);

const lignes = [...familles.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
  .map(([nom, f]) => `  ${JSON.stringify(nom)}: '${f}',`);
writeFileSync(new URL('../lib/app/barreFamilles.ts', import.meta.url), `/**
 * LA FAMILLE D'UNE SÉANCE DE LA BARRE, PAR SON NOM (C1, décision coach du 04/11/2026, « A ») : produit par
 * scripts/familles-barre.mjs depuis le catalogue du moteur (cts_bibliotheque.catalogue()) — ne pas modifier à la main.
 *
 *   Régénérer : node scripts/familles-barre.mjs   (après chaque changement de noms dans la barre)
 *
 * ${actuelles} séances de qualité et ${mecaniques} de mécanique dans la barre, plus les noms d'avant les renommages, des
 * anciennes barres et ceux que le moteur écrit pour sa mécanique ;
 * ${doubles.size} nom(s) écarté(s) parce qu'ils désignaient deux familles.
 */
import type { FamilleLue } from './classement';

export const FAMILLES_DE_LA_BARRE: Record<string, FamilleLue> = {
${lignes.join('\n')}
};
`);
console.log(`${familles.size} noms (${actuelles} séances de qualité et ${mecaniques} de mécanique dans la barre), ${doubles.size} écarté(s).`);
