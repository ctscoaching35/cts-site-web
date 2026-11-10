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
// CTS_PYTHON : un autre python (un worktree du moteur n'a pas son .venv).
const brut = execFileSync(process.env.CTS_PYTHON ?? join(moteur, '.venv/bin/python3'),
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
// LA BARRE EN SÉANCES CLÉS EN MAIN (moteur 8.461) : ses dossiers à plat portent des codes (« S2c 5×3′/1′ R »), que le
// site lit par leur grammaire (lib/app/codeSeance.ts), pas par cette liste ; la liste garde les noms de la barre d'avant
// (« anciennes_du_moteur », sous ses dossiers d'avant) et de ses renommages (« renommees_d_avant »).
let codes = 0;
for (const d of catalogue.dossiers) {
  if (!d.sous) { codes += (d.seances ?? []).length; continue; }
  for (const s of d.sous ?? [{ seances: d.seances ?? [] }]) {
    for (const x of s.seances ?? []) {
      if (familleDu(d.nom) === 'mecanique') mecaniques += 1;
      else if (familleDu(d.nom)) actuelles += 1;
      poser(x.name, familleDu(d.nom));
    }
  }
}
for (const r of [...(catalogue.renommees ?? []), ...(catalogue.renommees_d_avant ?? [])]) poser(r.nom_avant, familleDu(r.dossier));
for (const a of catalogue.anciennes_du_moteur ?? []) {
  // La barre d'avant (archives du 02/11/2026) : ses séances de qualité et de mécanique, comptées.
  if (codes && a.sous && familleDu(a.dossier) === 'mecanique') mecaniques += 1;
  else if (codes && a.sous && familleDu(a.dossier)) actuelles += 1;
  poser(a.nom, familleDu(a.dossier));
}
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
 * ${codes} séances de la barre en séances clés en main, lues par leur code (lib/app/codeSeance.ts) ; ici, les noms des
 * barres d'avant (${actuelles} noms de qualité et ${mecaniques} de mécanique, archives comprises), de leurs renommages, et
 * ceux que le moteur écrit pour sa mécanique ;
 * ${doubles.size} nom(s) écarté(s) parce qu'ils désignaient deux familles.
 */
import type { FamilleLue } from './classement';

export const FAMILLES_DE_LA_BARRE: Record<string, FamilleLue> = {
${lignes.join('\n')}
};
`);
console.log(`${codes} codes lus par la grammaire ; ${familles.size} noms (${actuelles} de qualité et ${mecaniques} de mécanique des barres d'avant), ${doubles.size} écarté(s).`);
