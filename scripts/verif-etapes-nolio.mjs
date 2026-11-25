#!/usr/bin/env node
/**
 * LA LISTE DES SÉANCES PRÉVUES DE NOLIO REND-ELLE LES ÉTAPES (`workout`) ? À LANCER PAR LE COACH, SUR SON PROPRE COMPTE (« (toi) ») : lecture seule, deux sortes d'appels (la liste, puis le détail de quelques séances),
 * sans paramètre d'athlète, donc jamais le calendrier d'un autre. N'affiche QUE la structure : des « oui » et des « non » et des nombres. Aucun titre, aucune date, aucune description, aucune consigne, aucune valeur
 * de séance ni de clé ne sort. Rien n'est écrit dans Nolio.
 *
 * Il faut la clé de l'API (NOLIO_API_KEY), celle que le site a déjà (le fichier .env.local de ce dossier, ou la variable posée à la main).
 *
 *   node --env-file=.env.local scripts/verif-etapes-nolio.mjs
 */
const NOLIO = 'https://www.nolio.io/api/v2';
const cle = (process.env.NOLIO_API_KEY ?? '').trim();
if (!cle) {
  console.log('Clé absente : NOLIO_API_KEY n’est pas dans cet environnement. Lance avec : node --env-file=.env.local scripts/verif-etapes-nolio.mjs');
  process.exit(1);
}

const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function lire(chemin) {
  await pause(150);
  const r = await fetch(`${NOLIO}/${chemin}`, { headers: { Authorization: `Bearer ${cle}`, 'Accept-Language': 'fr' } });
  const corps = await r.json().catch(() => null);
  return { statut: r.status, corps };
}
const jour = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const aDesEtapes = (s) => Array.isArray(s?.workout) && s.workout.length > 0;

const liste = await lire(`planned/trainings/?date_from=${jour(-56)}&date_to=${jour(14)}&limit=100`);
if (liste.statut !== 200) {
  console.log(`La liste n’a pas répondu (statut ${liste.statut}). Rien d’autre n’a été lu.`);
  process.exit(1);
}
const seances = Array.isArray(liste.corps) ? liste.corps : Array.isArray(liste.corps?.data) ? liste.corps.data : [];
const dansLaListe = seances.filter(aDesEtapes).length;
console.log(`Séances prévues lues sur 8 semaines passées et 2 à venir : ${seances.length}.`);
console.log(`La liste rend-elle des étapes (« workout » non vide) ? ${dansLaListe > 0 ? 'OUI' : 'NON'} (${dansLaListe} sur ${seances.length}).`);
console.log(`Le champ « workout » est-il présent dans la liste, même vide ? ${seances.some((s) => 'workout' in (s ?? {})) ? 'oui' : 'non'}.`);
if (!seances.length) {
  console.log('Aucune séance prévue : rien à comparer. N’en écris pas sans l’accord du coach.');
  process.exit(0);
}

// Le détail : jusqu'à 8 séances, pour en trouver une qui a des étapes.
let lus = 0;
let avec = 0;
for (const s of seances.slice(-8)) {
  const d = await lire(`planned/trainings/${s.id}/`);
  if (d.statut !== 200) continue;
  lus += 1;
  if (aDesEtapes(d.corps)) avec += 1;
}
console.log(`Le détail rend-il des étapes ? ${avec > 0 ? 'OUI' : 'NON'} (${avec} sur ${lus} détails lus).`);
console.log(avec === 0 && dansLaListe === 0 ? 'Aucune séance avec des étapes trouvée : à refaire sur un calendrier qui en a.' : 'Fin.');
