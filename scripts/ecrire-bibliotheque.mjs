#!/usr/bin/env node
/**
 * La bibliothèque CTS écrite dans le Nolio du coach (CTS_DOCTRINE_SEANCES.md dans le dépôt du moteur ; décision coach du
 * 26/10/2026, « reconstruire la barre latérale avec les familles de séance ») : les dossiers et les séances types du
 * moteur (cts_bibliotheque.catalogue, rendu en JSON), puis ses séances types à leur place — gardées, déplacées et
 * renommées sans toucher leur contenu, ou rangées dans les archives — et les séances de l'ancienne barre du moteur que
 * le catalogue ne porte plus (décision coach du 01/11/2026 : la barre construite depuis le moteur), rangées dans leur
 * dossier d'archives. Rien n'est jamais supprimé.
 *
 *   ./.venv/bin/python3 -c "import json, cts_bibliotheque as b; print(json.dumps(b.catalogue()))" > catalogue.json
 *   node scripts/ecrire-bibliotheque.mjs catalogue.json [--ecrire] [--mettre-a-jour] [--filtre=texte] [--ordre] [--verifier]
 *
 * Sans --ecrire, rien ne part : il dit ce qu'il ferait. Relancé, il retrouve ce qui existe déjà (un dossier par son nom
 * et son parent, une séance du moteur par son nom dans son dossier) et le met à jour au lieu de le doubler. Lit la clé
 * NOLIO_API_KEY_BIBLIOTHEQUE de .env.local (sans l'afficher).
 */
import nextEnv from '@next/env';
import { readFileSync } from 'node:fs';

nextEnv.loadEnvConfig(process.cwd());
const ecrire = process.argv.includes('--ecrire');
// Les séances déjà écrites ne sont réécrites qu'avec --mettre-a-jour : chaque appel compte dans le quota de
// l'application Nolio, partagé avec le site (un passage les réécrivait toutes, 270 appels, et Nolio a freiné).
const mettreAJour = process.argv.includes('--mettre-a-jour');
// --filtre=texte : avec --mettre-a-jour, seules les séances dont le nom contient ce texte sont réécrites (et leurs
// sous-dossiers remis en ordre).
const filtre = process.argv.find((a) => a.startsWith('--filtre='))?.slice('--filtre='.length) ?? null;
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

// L'ordre d'un sous-dossier : celui du catalogue (de la plus facile à la plus exigeante, à la charge de la séance ;
// décision coach du 03/11/2026), puis ce que le coach y a ajouté, dans leur ordre d'avant. Rend ce qui s'y trouve dans
// l'ordre lu (champ order) et dans l'ordre voulu.
const COLLECTIONS = ['training_frames', 'competition_frames', 'note_frames', 'message_trigger_frames', 'quiz_frames'];
async function ordreDe(s, sous) {
  const presents = [];
  for (const c of COLLECTIONS) presents.push(...(await tous(`library/${c}/?category=${sous.id}`)));
  const lu = [...presents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const rang = new Map(s.seances.map((x, i) => [x.name, i]));
  const voulu = [...lu].sort((a, b) => (rang.get(a.name) ?? 1e6) - (rang.get(b.name) ?? 1e6));
  return { lu, voulu };
}

// L'ORDRE SEUL (--ordre) : chaque sous-dossier du catalogue remis dans son ordre, sans réécrire les séances (le quota) ;
// sans --ecrire, la relecture : les sous-dossiers qui n'y sont pas.
if (process.argv.includes('--ordre')) {
  const aRanger = [];
  let dansLOrdre = 0;
  for (const d of catalogue.dossiers) {
    const racine = dossiers.find((x) => x.name === d.nom && !idDe(x.parent));
    for (const s of d.sous) {
      const sous = racine && dossiers.find((x) => x.name === s.nom && idDe(x.parent) === racine.id);
      if (!sous) { aRanger.push(`ABSENT : ${d.nom} › ${s.nom}`); continue; }
      const { lu, voulu } = await ordreDe(s, sous);
      if (lu.some((x) => typeof x.order !== 'number')) aRanger.push(`sans champ order : ${d.nom} › ${s.nom}`);
      if (voulu.every((x, i) => x.id === lu[i].id)) { dansLOrdre += 1; continue; }
      aRanger.push(`${ecrire ? 'rangé' : 'à ranger'} : ${d.nom} › ${s.nom} (${voulu.length})`);
      if (ecrire) await nolio('POST', `library/categories/${sous.id}/frames/order/`, { ids: voulu.map((x) => x.id) });
    }
  }
  console.log(aRanger.join('\n'));
  console.log(`\n${dansLOrdre} sous-dossiers déjà dans l'ordre, ${aRanger.length} ${ecrire ? 'rangés' : 'à ranger (rien n’est parti : --ecrire pour les ranger)'}.`);
  process.exit(0);
}

// LA VÉRIFICATION (--verifier ; rien n'est écrit) : chaque séance du catalogue relue dans Nolio, à sa place, comparée à
// ce que le moteur a écrit : la description, puis chaque étape (intensité, durée ou distance, cibles, commentaire, lap).
if (process.argv.includes('--verifier')) {
  const texte = (h) => String(h ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const plat = (noeuds) => (noeuds ?? []).flatMap((n) => (n.kind === 'repeat'
    ? [`× ${n.times}`, ...plat(n.steps), 'fin']
    // Nolio rend les distances en km (100 m : 0,1 km) et ajoute le nom des zones (« resolved ») : comparé sans.
    : [[n.intensity, n.duration ? `${n.duration.value}${n.duration.unit}`
      : `${Math.round(n.distance?.value * (n.distance?.unit === 'km' ? 1000 : 1))}m`,
      JSON.stringify((n.targets ?? []).map((t) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== 'resolved').sort()))),
      texte(n.comment).replace(/\s+/g, ' '), n.lap_advance ? 'lap' : ''].join(' | ')]));
  let justes = 0;
  const ecarts = [];
  for (const d of catalogue.dossiers) {
    const racine = dossiers.find((x) => x.name === d.nom && !idDe(x.parent));
    for (const s of d.sous) {
      const sous = racine && dossiers.find((x) => x.name === s.nom && idDe(x.parent) === racine.id);
      for (const x of s.seances) {
        const y = sous && seances.find((z) => z.name === x.name && idDe(z.category) === sous.id);
        if (!y) { ecarts.push(`ABSENTE : ${d.nom} › ${s.nom} › ${x.name}`); continue; }
        const lu = await nolio('GET', `library/training_frames/${y.id}/`);
        const attendu = plat(x.workout);
        const recu = plat(lu.workout);
        const desc = texte(lu.description_html ?? lu.description);
        const pb = [];
        if (desc !== texte(x.description)) pb.push(`description : « ${desc.slice(0, 120)} »`);
        if (attendu.length !== recu.length) pb.push(`${recu.length} étapes au lieu de ${attendu.length}`);
        attendu.forEach((a, i) => { if (recu[i] !== undefined && recu[i] !== a) pb.push(`étape ${i + 1} : attendu « ${a} », lu « ${recu[i]} »`); });
        if (pb.length) ecarts.push(`${d.nom} › ${s.nom} › ${x.name}\n    ${pb.slice(0, 4).join('\n    ')}`);
        else justes += 1;
      }
    }
  }
  const notes = await tous('library/note_frames/');
  for (const n of catalogue.notes ?? []) {
    const racine = dossiers.find((x) => x.name === n.dossier && !idDe(x.parent));
    const y = racine && notes.find((z) => z.name === n.name && idDe(z.category) === racine.id);
    if (!y) ecarts.push(`NOTE ABSENTE : ${n.dossier} › ${n.name}`);
    else if (y.note_type !== n.note_type) ecarts.push(`${n.dossier} › ${n.name} : note « ${y.note_type} » au lieu de « ${n.note_type} »`);
    else justes += 1;
  }
  console.log(ecarts.join('\n'));
  console.log(`\n${justes} séances et notes conformes au moteur, ${ecarts.length} écart(s).`);
  process.exit(0);
}

const journal = [];
// Les sous-dossiers où une séance a été créée : seuls ceux-là sont remis en ordre.
const crees = new Set();

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
        if (!mettreAJour || (filtre && !x.name.includes(filtre))) continue;
        journal.push(`mise à jour : ${d.nom} › ${s.nom} › ${x.name}`);
        crees.add(id);
        // Nolio refuse une description en texte brut sur une séance qui en a déjà une (« plain text would erase its
        // formatting ») : la mise à jour l'envoie en HTML, un paragraphe.
        const { description, ...reste } = x;
        const html = `<p>${description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
        if (ecrire) await nolio('PATCH', `library/training_frames/${deja.id}/`, { ...reste, description_html: html });
      } else {
        journal.push(`créée : ${d.nom} › ${s.nom} › ${x.name}`);
        crees.add(id);
        if (ecrire) seances.push(await nolio('POST', 'library/training_frames/', { ...x, category: id }));
      }
    }
  }
}

// Les notes du moteur (le dossier « Repos », décision coach du 02/11/2026) : créées si elles manquent dans leur dossier.
const notes = await tous('library/note_frames/');
for (const n of catalogue.notes ?? []) {
  const { dossier: nom, ...corps } = n;
  const id = await dossier(nom);
  if (notes.some((y) => y.name === corps.name && idDe(y.category) === id)) continue;
  journal.push(`note créée : ${nom} › ${corps.name}`);
  if (ecrire) notes.push(await nolio('POST', 'library/note_frames/', { ...corps, category: id }));
}

// Les séances du coach : gardées (déplacées, renommées) ou archivées. Un nom porté par plusieurs séances : gardée, il
// faut lever le doute à la main ; archivée, toutes partent.
// Le dossier d'archives, créé seulement s'il faut y ranger une séance ; le dossier à supprimer (catalogue.essais.vers), que
// le coach vide lui-même : on n'en sort plus rien (le 02/11/2026, ses séances restées sans dossier y attendent).
let archives = null;
const versArchives = async () => (archives ??= await dossier(catalogue.archives));
const aSupprimer = catalogue.essais?.vers ? dossiers.find((x) => x.name === catalogue.essais.vers && !idDe(x.parent)) : null;
const parNom = (nom) => seances.filter((y) => y.name === nom);
for (const [nom, sort] of Object.entries(catalogue.seances_du_coach)) {
  const lesquelles = parNom(nom);
  if (!lesquelles.length) {
    journal.push(`introuvable (déjà déplacée ?) : ${nom}`);
    continue;
  }
  if (sort === catalogue.archives) {
    for (const y of lesquelles) {
      if (aSupprimer && idDe(y.category) === aSupprimer.id) continue;
      const vers = await versArchives();
      if (idDe(y.category) === vers) continue;
      journal.push(`archivée : ${nom}`);
      if (ecrire) await nolio('PATCH', `library/training_frames/${y.id}/`, { category: vers });
      y.category = vers;
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
  Object.assign(lesquelles[0], { name: sort.nom, category: id });
}

// L'ancienne barre du moteur (celle du 27/10/2026) : chaque séance que le nouveau catalogue ne porte plus au même endroit
// (dossier, sous-dossier, nom) part dans son dossier d'archives ; celles que le coach a ajoutées dans ces dossiers, par un
// autre nom, restent où elles sont.
if (catalogue.anciennes_du_moteur?.length) {
  const versArchives = await dossier(catalogue.archives_barre);
  for (const a of catalogue.anciennes_du_moteur) {
    const racine = dossiers.find((d) => d.name === a.dossier && !idDe(d.parent));
    const sous = racine && dossiers.find((d) => d.name === a.sous && idDe(d.parent) === racine.id);
    const y = sous && seances.find((x) => x.name === a.nom && idDe(x.category) === sous.id);
    if (!y) {
      journal.push(`introuvable (ancienne barre du moteur) : ${a.dossier} › ${a.sous} › ${a.nom}`);
      continue;
    }
    journal.push(`archivée (ancienne barre du moteur) : ${a.dossier} › ${a.sous} › ${a.nom}`);
    if (ecrire) await nolio('PATCH', `library/training_frames/${y.id}/`, { category: versArchives });
    y.category = versArchives;
  }
}

// Les essais : les séances qui restent dans un dossier d'essai (celles du moteur) partent dans un dossier à supprimer
// par le coach ; ses séances, elles, ont été rangées plus haut.
if (catalogue.essais) {
  const essai = dossiers.find((d) => d.name === catalogue.essais.dossier && !idDe(d.parent));
  if (essai) {
    const sous = dossiers.filter((d) => idDe(d.parent) === essai.id).map((d) => d.id);
    const restes = seances.filter((y) => [essai.id, ...sous].includes(idDe(y.category)));
    const vers = restes.length ? await dossier(catalogue.essais.vers) : null;
    for (const y of restes) {
      journal.push(`essai rangé à supprimer : ${y.name}`);
      if (ecrire) await nolio('PATCH', `library/training_frames/${y.id}/`, { category: vers });
    }
  }
}

// LE RESTE AUX ARCHIVES (décision coach du 02/11/2026 : « on ne gardera que les séances que l'on utilise ensemble avec le
// moteur, le reste part en archive ») : toute séance qui n'est pas une séance du catalogue à sa place, hors des dossiers
// d'archives et du dossier à supprimer, part dans les archives. Les séances seulement : les questionnaires (Hooper) et
// les exercices, que l'app lit, ne bougent pas.
if (catalogue.archiver_le_reste) {
  const aLeurPlace = new Set();
  for (const d of catalogue.dossiers) {
    const racine = dossiers.find((x) => x.name === d.nom && !idDe(x.parent));
    for (const s of d.sous) {
      const sous = racine && dossiers.find((x) => x.name === s.nom && idDe(x.parent) === racine.id);
      if (sous) for (const x of s.seances) aLeurPlace.add(`${sous.id}|${x.name}`);
    }
  }
  const aLabri = new Set([catalogue.archives, catalogue.archives_barre, catalogue.essais?.vers].filter(Boolean));
  const range = (id) => {
    for (let d = dossiers.find((x) => x.id === id), i = 0; d && i < 10; d = dossiers.find((x) => x.id === idDe(d.parent)), i += 1) {
      if (aLabri.has(d.name)) return true;
    }
    return false;
  };
  for (const y of seances) {
    const cat = idDe(y.category);
    if (aLeurPlace.has(`${cat}|${y.name}`) || range(cat)) continue;
    const vers = await versArchives();
    const ou = dossiers.find((x) => x.id === cat);
    const parent = ou && dossiers.find((x) => x.id === idDe(ou.parent));
    journal.push(`archivée (hors du moteur) : ${parent ? `${parent.name} › ` : ''}${ou ? ou.name : '(sans dossier)'} › ${y.name}`);
    if (ecrire) await nolio('PATCH', `library/training_frames/${y.id}/`, { category: vers });
    y.category = vers;
  }
}

// Les dossiers vides après le passage (le coach les supprime lui-même) : ni séance, ni compétition, ni note, ni message,
// ni questionnaire, ni sous-dossier qui en contienne.
const autres = [];
for (const c of ['competition_frames', 'note_frames', 'message_trigger_frames', 'quiz_frames']) {
  autres.push(...(await tous(`library/${c}/`).catch(() => [])));
}
const pleins = new Set([...seances, ...autres].map((y) => idDe(y.category)));
const contient = (id, i = 0) => pleins.has(id) || (i < 10 && dossiers.some((x) => idDe(x.parent) === id && contient(x.id, i + 1)));
for (const d of dossiers) {
  if (d.type === 'event' && !contient(d.id) && !String(d.id).startsWith('(nouveau')) {
    const parent = dossiers.find((x) => x.id === idDe(d.parent));
    journal.push(`dossier vide (à supprimer par le coach) : ${parent ? `${parent.name} › ` : ''}${d.name}`);
  }
}

// L'ordre de chaque sous-dossier où une séance a été créée ou réécrite (ordreDe).
for (const d of catalogue.dossiers) {
  const racine = dossiers.find((x) => x.name === d.nom && !idDe(x.parent));
  for (const s of d.sous) {
    const sous = racine && dossiers.find((x) => x.name === s.nom && idDe(x.parent) === racine.id);
    if (!sous || !ecrire || (!(mettreAJour && !filtre) && !crees.has(sous.id))) continue;
    const { voulu: ordre } = await ordreDe(s, sous);
    await nolio('POST', `library/categories/${sous.id}/frames/order/`, { ids: ordre.map((x) => x.id) });
    journal.push(`ordre : ${d.nom} › ${s.nom} (${ordre.length})`);
  }
}

console.log(journal.join('\n'));
console.log(`\n${journal.length} opérations${ecrire ? ' faites' : ' prévues (rien n’est parti : --ecrire pour les faire)'}.`);

// Le bilan : les séances de la barre par dossier de premier niveau, après le passage (à blanc : les créations à venir
// n'y sont pas).
const racineDe = (id) => {
  let d = dossiers.find((x) => x.id === id);
  for (let i = 0; d && idDe(d.parent) && i < 10; i += 1) d = dossiers.find((x) => x.id === idDe(d.parent));
  return d ? d.name : '(sans dossier)';
};
const bilan = new Map();
for (const y of seances) bilan.set(racineDe(idDe(y.category)), (bilan.get(racineDe(idDe(y.category))) ?? 0) + 1);
console.log(`\nBilan (${seances.length} séances) :`);
for (const [nom, n] of [...bilan].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${nom}`);
