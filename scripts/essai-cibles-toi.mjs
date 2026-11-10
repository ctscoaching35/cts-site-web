#!/usr/bin/env node
/**
 * L'ESSAI DES CIBLES SUR « (TOI) » (la barre en séances clés en main, moteur 8.461 ; décision 12 du coach du 09/11/2026,
 * test autorisé ce soir-là) : trois séances des nouveaux modèles posées dans le calendrier du coach lui-même (jamais un
 * athlète : sans « athletes », Nolio écrit chez le propriétaire de la clé), sur des dates passées, puis relues pour voir
 * comment Nolio stocke et résout leurs cibles (la zone de FC, le % de la vitesse critique, la zone d'allure). Rien n'est
 * jamais supprimé.
 *
 *   node scripts/essai-cibles-toi.mjs <catalogue.json> [--env=dossier] [--ecrire] [--relire=id,id,id]
 *
 * Sans --ecrire : ce qui serait posé, et ce qui est déjà dans le calendrier ces jours-là. --relire relit des séances
 * déjà posées. La clé NOLIO_API_KEY (celle du site, droits du calendrier) se lit dans .env.local, jamais affichée.
 */
import nextEnv from '@next/env';
import { readFileSync } from 'node:fs';

nextEnv.loadEnvConfig(process.argv.find((a) => a.startsWith('--env='))?.slice('--env='.length) ?? process.cwd());
const ecrire = process.argv.includes('--ecrire');
const relire = process.argv.find((a) => a.startsWith('--relire='))?.slice('--relire='.length).split(',') ?? null;
const chemin = process.argv.slice(2).find((a) => !a.startsWith('--'));
const cle = process.env.NOLIO_API_KEY?.trim();
if (!cle) throw new Error('NOLIO_API_KEY manque.');

async function nolio(methode, route, corps) {
  await new Promise((ok) => setTimeout(ok, 200));
  const r = await fetch(`https://www.nolio.io/api/v2/${route}`, {
    method: methode, headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await r.text();
  if (r.status >= 300) throw new Error(`${methode} ${route} : ${r.status} ${texte.slice(0, 400)}`);
  return texte ? JSON.parse(texte) : null;
}

// Les trois séances : (date passée, modèle de la barre, mots du calendrier).
const ESSAIS = [
  ['2026-11-03', 'EF V', 'Endurance, vallonné'],
  ['2026-11-05', 'S1 3×10′/2′ R', 'Seuil 1, route'],
  ['2026-11-07', 'S2c 5×3′/1′ R', 'Seuil 2 court, route'],
];
const NOTE = ' (Essai du 10/11 : la barre en séances clés en main, pour voir les cibles chez toi ; tu peux la supprimer après l\'avoir regardée.)';

const duree = (noeuds) => noeuds.reduce((t, n) => t + (n.kind === 'repeat' ? n.times * duree(n.steps)
  : n.duration?.value ?? (n.distance ? n.distance.value / (12 / 3.6) : 0)), 0);
const cibles = (noeuds, prefixe = '') => noeuds.flatMap((n) => (n.kind === 'repeat'
  ? [`${prefixe}${n.times} ×`, ...cibles(n.steps, `${prefixe}   `)]
  : [`${prefixe}${n.intensity} ${n.duration ? `${Math.round(n.duration.value / 6) / 10}′` : `${n.distance?.value}${n.distance?.unit}`} : ${JSON.stringify(n.targets)}`]));

const moi = await nolio('GET', 'me/');
console.log(`Compte de la clé : ${moi.id} (le coach lui-même, « (toi) »)`);

if (relire) {
  for (const id of relire) {
    const s = await nolio('GET', `planned/trainings/${id}/`);
    console.log(`\n${s.date_start} — ${s.name} (${s.id}), sport ${s.sport?.id ?? s.sport}, ${Math.round((s.duration?.value ?? 0) / 60)} min`);
    console.log(cibles(s.workout ?? []).join('\n'));
  }
  process.exit(0);
}

const catalogue = JSON.parse(readFileSync(chemin, 'utf8'));
const modeles = new Map(catalogue.dossiers.flatMap((d) => (d.seances ?? []).map((x) => [x.name, x])));
const deja = await nolio('GET', 'planned/trainings/?date_from=2026-11-02&date_to=2026-11-08&limit=100');
console.log(`Déjà dans ton calendrier du 02 au 08/11 : ${(deja.data ?? []).length} séance(s)`);
for (const [date, code, mots] of ESSAIS) {
  const x = modeles.get(code);
  if (!x) throw new Error(`Modèle absent du catalogue : ${code}`);
  const corps = { sport: x.sport, name: `${code} · ${mots}`, date_start: date, duration: { value: Math.round(duree(x.workout)), unit: 's' },
    rpe: x.rpe, show_rpe: true, ...(x.color ? { color: x.color } : {}), description: x.description + NOTE, workout: x.workout };
  console.log(`\n${ecrire ? 'posée' : 'à poser'} : ${date} — ${corps.name}`);
  console.log(cibles(x.workout).join('\n'));
  if (!ecrire) continue;
  const r = await nolio('POST', 'planned/trainings/', corps);
  console.log(`  → identifiant Nolio : ${r.id}`);
  const lu = await nolio('GET', `planned/trainings/${r.id}/`);
  console.log('  relue :');
  console.log(cibles(lu.workout ?? [], '    ').join('\n'));
}
