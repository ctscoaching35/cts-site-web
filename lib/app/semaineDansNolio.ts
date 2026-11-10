/**
 * « SA SEMAINE QUI ARRIVE », TELLE QU'ELLE EST DANS NOLIO, CHAQUE RETOUCHE MARQUÉE POUR LE COACH (décision 11 du coach du
 * 09/11/2026, doctrine de la semaine, CTS_DOCTRINE_SEMAINE.md dans le dépôt du moteur ; maquette tranchée le 09/11/2026,
 * « Nolio fait foi ») : la semaine que l'app a posée dimanche (nolio_envois : chaque séance, son identifiant Nolio, sa
 * révision et l'empreinte de son contenu à l'envoi), comparée à ce qui est dans Nolio maintenant.
 * - une séance dont le contenu a changé (sa révision Nolio a changé, et son empreinte aussi quand elle a été gardée,
 *   lib/app/trameNolio.ts) : « remplacée par toi » (son nom dit une autre famille), « modifiée par toi » (même famille, ou
 *   ses étapes et ses cibles seules), « raccourcie par toi » / « allongée par toi » (sa durée seule) ;
 * - une séance posée par l'app qui n'est plus dans Nolio : « retirée par toi », son nom barré ; une séance ajoutée le même
 *   jour (de course si elle était de course) la remplace : « remplacée par toi » ;
 * - une séance que l'app n'a pas posée : « ajoutée par toi » ;
 * - un simple changement de jour : « déplacée au jeudi », sans auteur (il peut venir de l'athlète).
 * Nolio dit qu'une séance a changé, pas qui l'a changée : « par toi » d'après la question 3 de la maquette (« A »).
 * Le volume et le nombre de séances : ses séances de course, trail et tapis, comme ceux que le moteur écrit.
 * Et « Pourquoi cette semaine » en sept réponses, quand la semaine écrite les porte (moteur 8.460). Fonctions pures.
 */
import { lireCode } from './codeSeance';
import type { SeanceEnvoyee } from './coaching';
import { ajouterJours, type Jour, type Semaine } from './plan';
import { FAMILLES_DE_LA_BARRE } from './barreFamilles';
import { nomComparable } from './nomsSeances';
import { enHeures, minutesDe } from './tableau';

// Une séance prévue telle que Nolio la rend (planned/trainings/?with_revision=true).
export type PrevueNolio = {
  id: string; date_start: string; name?: string | null; sport?: string | null; rpe?: number | null; revision?: string | null;
  duration?: { value?: number } | null; color?: string | null;
};
export type Retouche = 'remplacee' | 'modifiee' | 'raccourcie' | 'allongee' | 'ajoutee' | 'retiree' | 'deplacee';
// texte : la marque ; avant : ce que le moteur avait écrit, en sous-ligne (null : rien à dire).
export type Marque = { quoi: Retouche; texte: string; avant: string | null };
// Une ligne de la semaine : une séance de Nolio, une séance retirée (barree, à son jour écrit), ou un jour de course
// (ecrite : la course elle-même, telle que le moteur l'a écrite, qui n'est pas une séance de Nolio).
export type LigneNolio = {
  cle: string; date: string; nom: string; minutes: number | null; rpe: number | null; course: boolean; couleur: string | null;
  barree: boolean; ecrite: boolean; marques: Marque[];
};
export type SemaineComparee = {
  lignes: LigneNolio[];
  // Dans Nolio : le volume de ses séances de course (en minutes) et leur nombre, « 6 séances + la course ».
  volume_min: number; seances: number; seances_texte: string;
  // Une retouche du coach (tout sauf un simple changement de jour) ; le nombre de séances retirées sans rien à la place.
  retouchee: boolean; retirees: number;
};

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
// Le jour d'une date (« jeudi »).
export const jourDe = (iso: string) => JOURS[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7];
const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const RENFO = ':renfo';
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// La famille d'une séance d'après son nom : celle de la barre du coach, sinon ses premiers mots. null : inconnue.
const FAMILLE_DU_NOM: [RegExp, string][] = [
  [/^(sl|sortie longue)\b|week-end choc|back-to-back/i, 'sl'], [/^ef\b|^endurance\b/i, 'ef'], [/\bseuil\s*1\b/i, 'seuil1'],
  [/\bseuil\s*2\b/i, 'seuil2'], [/\bvo2/i, 'vo2max'], [/\btempo\b/i, 'tempo'], [/^allure\b/i, 'allure'],
  [/navettes|myocrossmax/i, 'mecanique'], [/renfo/i, 'renfo'], [/sprint/i, 'sprint'], [/footing/i, 'ef'],
];
export function familleDuNom(nom: string | null | undefined): string | null {
  const n = String(nom ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!n) return null;
  // Le code en tête du nom (moteur 8.461, lib/app/codeSeance.ts) : sa famille.
  const lu = lireCode(n);
  if (lu) {
    return lu.lue ?? ({ SL: 'sl', WEC: 'sl', EF: 'ef', REC: 'ef', ACT: 'ef', RF: 'renfo', VÉLO: 'ef', LIBRE: 'ef' } as Record<string, string>)[lu.famille]
      ?? null;
  }
  const barre = FAMILLES_DE_LA_BARRE[n];
  if (barre) return barre;
  return FAMILLE_DU_NOM.find(([motif]) => motif.test(n))?.[1] ?? null;
}

// Ce qui a été envoyé, lu dans l'empreinte gardée à l'envoi (trameNolio.empreinteSeance : [nom, [durée, unité], rpe,
// étapes]) ; null sans empreinte (un envoi d'avant le 04/11/2026).
function lireContenu(contenu: string | null | undefined): { nom: string | null; minutes: number | null; rpe: number | null } | null {
  if (!contenu) return null;
  try {
    const [nom, duree, rpe] = JSON.parse(contenu) as [unknown, unknown, unknown];
    const valeur = Array.isArray(duree) && typeof duree[0] === 'number' ? duree[0] : null;
    return { nom: typeof nom === 'string' && nom ? nom : null, minutes: valeur !== null ? Math.round(valeur / 60) : null,
      rpe: typeof rpe === 'number' ? rpe : null };
  } catch {
    return null;
  }
}

// La séance telle que le moteur l'a écrite, pour la sous-ligne : « EF + sprints en côte · 25 min · RPE 3 ».
type Ecrite = { cle: string; nolio: string; date: string; nom: string; minutes: number | null; rpe: number | null; course: boolean;
  revision: string | null; contenu: string | null; ordre: number };
const enLigne = (e: Pick<Ecrite, 'nom' | 'minutes' | 'rpe'>) =>
  [e.nom, e.minutes ? enHeures(e.minutes) : null, e.rpe !== null ? `RPE ${e.rpe}` : null].filter(Boolean).join(' · ');
// La structure d'un nom, « 5 × 3 min » de « VO2max · 15 min — 5 × 3 min », « 5×3′/1′ » de « S2c 5×3′/1′ R · Seuil 2
// court, route » (le code, moteur 8.461) ; le nom entier sans elle.
const structure = (nom: string) => {
  const lu = lireCode(nom);
  if (lu) return lu.structure || lu.code;
  return nom.includes(' — ') ? nom.slice(nom.indexOf(' — ') + 3).trim() : nom;
};

const marque = (quoi: Retouche, avant: string | null = null, jour?: string): Marque => ({
  quoi, avant,
  texte: quoi === 'deplacee' ? `déplacée au ${jour}` : `${{ remplacee: 'remplacée', modifiee: 'modifiée', raccourcie: 'raccourcie',
    allongee: 'allongée', ajoutee: 'ajoutée', retiree: 'retirée' }[quoi]} par toi`,
});

// La marque d'un contenu changé, d'après ce qui se voit : un autre nom d'une autre famille, « remplacée » ; d'une même
// famille, « modifiée » (écrite : sa structure) ; le même nom et une autre durée, « raccourcie » ou « allongée » ; sinon
// ses étapes ou ses cibles, « modifiée ». rienSinon : une séance retirée puis reposée à l'identique n'a pas de marque.
function marqueDuContenu(e: Ecrite, nom: string, minutes: number | null, rienSinon = false): Marque | null {
  if (nomComparable(nom) !== nomComparable(e.nom)) {
    const [avant, apres] = [familleDuNom(e.nom), familleDuNom(nom)];
    return avant && avant === apres ? marque('modifiee', `écrite : ${structure(e.nom)}`) : marque('remplacee', `à la place de : ${enLigne(e)}`);
  }
  if (minutes !== null && e.minutes !== null && Math.abs(minutes - e.minutes) >= 1) {
    return marque(minutes < e.minutes ? 'raccourcie' : 'allongee', `écrite : ${enHeures(e.minutes)}`);
  }
  return rienSinon ? null : marque('modifiee');
}

// semaine : la semaine écrite (semaines_ecrites.donnees) ; envoyees : les séances de son envoi (nolio_envois.seances) ;
// nolio : les séances prévues de Nolio, de la semaine d'avant à celle d'après (une séance déplacée hors de la semaine s'y
// retrouve) ; posees : tout ce que l'app a posé dans Nolio pour lui, tous objectifs et toutes semaines (ce n'est pas une
// séance ajoutée par le coach) ; empreintes : l'empreinte du contenu lu dans Nolio des séances dont la révision a changé
// (absente : pas lue) ; sports : ceux de la course (lib/app/nolio.ts, SPORTS_COURSE).
export function comparerLaSemaine({ semaine, envoyees, nolio, posees = new Set(), empreintes = new Map(), sports }: {
  semaine: Pick<Semaine, 'jours' | 'lundi' | 'seances'>; envoyees: SeanceEnvoyee[]; nolio: PrevueNolio[]; posees?: Set<string>;
  empreintes?: Map<string, string | null>; sports: readonly string[];
}): SemaineComparee {
  const lundi = semaine.lundi ?? '';
  const dimanche = ajouterJours(lundi, 6);
  const dansLaSemaine = (iso: string) => iso >= lundi && iso <= dimanche;
  const estCourse = (sport: string | null | undefined) => sports.includes(String(sport));
  const ordreDuJour = new Map(semaine.jours.map((j, i) => [j.id, i]));
  const parId = new Map(nolio.map((x) => [String(x.id), x]));

  // Les séances posées par l'app pour cette semaine, telles que le moteur les a écrites.
  const ecrites: Ecrite[] = [];
  for (const s of envoyees) {
    if ((s.genre ?? 'seance') !== 'seance' || s.nolio_id === null || s.nolio_id === undefined || s.supprimee
      || s.jour_id.startsWith('fiche:')) continue;
    const renfo = s.jour_id.endsWith(RENFO);
    const jour: Jour | undefined = semaine.jours.find((j) => j.id === s.jour_id.replace(RENFO, ''));
    if (!jour?.date_iso || (!renfo && (jour.famille === 'repos' || jour.famille === 'course'))) continue;
    const lu = lireContenu(s.contenu);
    const rpeEcrit = Number(jour.rpe);
    ecrites.push({
      cle: s.jour_id, nolio: String(s.nolio_id), date: jour.date_iso, course: !renfo,
      nom: lu?.nom ?? (renfo ? 'Renfo' : jour.seance),
      minutes: lu?.minutes ?? (renfo ? null : minutesDe(jour.duree) || null),
      rpe: lu?.rpe ?? (!renfo && Number.isFinite(rpeEcrit) && rpeEcrit > 0 ? rpeEcrit : null),
      revision: s.revision ?? null, contenu: s.contenu ?? null,
      ordre: (ordreDuJour.get(jour.id) ?? 99) + (renfo ? 0.5 : 0),
    });
  }
  const deCetEnvoi = new Set(ecrites.map((e) => e.nolio));

  const lignes: LigneNolio[] = [];
  const depuisNolio = (x: PrevueNolio, marques: Marque[], ordre: number): LigneNolio & { ordre: number } => ({
    cle: String(x.id), date: x.date_start.slice(0, 10), nom: String(x.name ?? 'Séance'),
    minutes: typeof x.duration?.value === 'number' ? Math.round(x.duration.value / 60) : null,
    rpe: typeof x.rpe === 'number' ? x.rpe : null, course: estCourse(x.sport), couleur: x.color ?? null, barree: false, ecrite: false,
    marques, ordre,
  });
  const ordonnees: (LigneNolio & { ordre: number })[] = [];
  const retirees: Ecrite[] = [];

  for (const e of ecrites) {
    const x = parId.get(e.nolio);
    if (!x) {
      retirees.push(e);
      continue;
    }
    const date = x.date_start.slice(0, 10);
    const nom = String(x.name ?? '');
    const minutes = typeof x.duration?.value === 'number' ? Math.round(x.duration.value / 60) : null;
    const rpe = typeof x.rpe === 'number' ? x.rpe : null;
    const nomChange = nomComparable(nom) !== nomComparable(e.nom);
    const dureeChange = minutes !== null && e.minutes !== null && Math.abs(minutes - e.minutes) >= 1;
    const rpeChange = rpe !== null && e.rpe !== null && rpe !== e.rpe;
    const deplacee = date !== e.date;
    // Le contenu a changé : sa révision d'abord (rien n'a bougé si elle est la même) ; puis son empreinte, quand l'app l'a
    // gardée et que Nolio l'a rendue ; sinon ce qui se voit dans la liste (une séance seulement déplacée change aussi de
    // révision : sans empreinte, son contenu est supposé le même).
    const revisionChangee = Boolean(e.revision && x.revision && e.revision !== x.revision);
    const empreinte = empreintes.get(e.nolio);
    const contenuChange = !revisionChangee ? false
      : e.contenu && typeof empreinte === 'string' ? empreinte !== e.contenu
      : nomChange || dureeChange || rpeChange || !deplacee;
    const marques: Marque[] = [];
    const m = contenuChange ? marqueDuContenu(e, nom, minutes) : null;
    if (m) marques.push(m);
    if (deplacee && dansLaSemaine(date)) marques.push(marque('deplacee', `écrite ${jourDe(e.date)}`, jourDe(date)));
    if (dansLaSemaine(date)) {
      ordonnees.push(depuisNolio(x, marques, e.ordre));
    } else {
      // Partie hors de la semaine : à son jour écrit, barrée, avec son nouveau jour.
      ordonnees.push({ cle: e.cle, date: e.date, nom: e.nom, minutes: e.minutes, rpe: e.rpe, course: e.course, couleur: null,
        barree: true, ecrite: false, marques: [...marques, marque('deplacee', null, `${jourDe(date)} ${jjmm(date)}`)], ordre: e.ordre });
    }
  }

  // Ce que l'app n'a pas posé : ajouté par le coach ; le même jour qu'une séance retirée, de la même sorte (course ou
  // non), il la remplace.
  const ajoutees = nolio.filter((x) => dansLaSemaine(x.date_start.slice(0, 10)) && !deCetEnvoi.has(String(x.id)) && !posees.has(String(x.id)))
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  const restantes = [...retirees];
  for (const x of ajoutees) {
    const date = x.date_start.slice(0, 10);
    const i = restantes.findIndex((e) => e.date === date && e.course === estCourse(x.sport));
    if (i >= 0) {
      const e = restantes.splice(i, 1)[0];
      const m = marqueDuContenu(e, String(x.name ?? ''), typeof x.duration?.value === 'number' ? Math.round(x.duration.value / 60) : null, true);
      ordonnees.push(depuisNolio(x, m ? [m] : [], e.ordre));
    } else {
      ordonnees.push(depuisNolio(x, [marque('ajoutee')], 50 + ordonnees.length));
    }
  }
  for (const e of restantes) {
    ordonnees.push({ cle: e.cle, date: e.date, nom: e.nom, minutes: e.minutes, rpe: e.rpe, course: e.course, couleur: null,
      barree: true, ecrite: false, marques: [marque('retiree')], ordre: e.ordre });
  }
  // Ce que l'app a posé pour une autre semaine ou un autre objectif, venu dans celle-ci : tel quel.
  for (const x of nolio) {
    const id = String(x.id);
    if (dansLaSemaine(x.date_start.slice(0, 10)) && !deCetEnvoi.has(id) && posees.has(id)) ordonnees.push(depuisNolio(x, [], 60 + ordonnees.length));
  }
  // Le jour de course, tel que le moteur l'a écrit (la course n'est pas une séance de Nolio).
  for (const j of semaine.jours) {
    if (j.famille === 'course' && j.date_iso && j.seance) {
      ordonnees.push({ cle: j.id, date: j.date_iso, nom: j.seance, minutes: minutesDe(j.duree) || null, rpe: null, course: false,
        couleur: j.couleur ?? null, barree: false, ecrite: true, marques: [], ordre: ordreDuJour.get(j.id) ?? 99 });
    }
  }
  ordonnees.sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre);
  for (const { ordre: _ordre, ...l } of ordonnees) lignes.push(l);

  const comptees = lignes.filter((l) => !l.barree && !l.ecrite && l.course && dansLaSemaine(l.date));
  const seances = comptees.length;
  // « 6 séances + la course », que le moteur écrit avec des espaces insécables.
  const suffixe = /\+\s*la\s+course/.test(semaine.seances ?? '') ? ' +\u00a0la\u00a0course' : '';
  return {
    lignes,
    volume_min: comptees.reduce((t, l) => t + (l.minutes ?? 0), 0),
    seances, seances_texte: `${pluriel(seances, 'séance')}${suffixe}`,
    retouchee: lignes.some((l) => l.marques.some((m) => m.quoi !== 'deplacee')),
    retirees: lignes.filter((l) => l.marques.some((m) => m.quoi === 'retiree')).length,
  };
}

// ─── « Pourquoi cette semaine » en sept réponses ──────────────────────────────────────────────────────────────────

// Une réponse : son rang, son intitulé (« Qui », « Objectif », « Où il en est », « Prévu », « Couru », « Séances clés »,
// « Donc »), sa ligne, et ce qui a manqué pour y répondre.
export type Reponse = { n: number; libelle: string; texte: string; manque: string[] };

// Les sept réponses de la semaine écrite par le moteur 8.460 (`semaine.pourquoi`, CONTRAT_API_CTS.md : une liste de sept
// entrées { n, libelle, texte, manque? }, `manque` une phrase). null sans elles (une semaine écrite par un moteur d'avant,
// ou sans rien de lu) : « Pourquoi cette semaine » reste celui d'avant.
export function septReponses(source: unknown): Reponse[] | null {
  if (!Array.isArray(source)) return null;
  const reponses = source.flatMap((x, i): Reponse[] => {
    const e = (x ?? {}) as Record<string, unknown>;
    const libelle = typeof e.libelle === 'string' ? e.libelle.trim() : '';
    const texte = typeof e.texte === 'string' ? e.texte.trim() : '';
    if (!libelle || !texte) return [];
    const m = typeof e.manque === 'string' ? e.manque.trim() : '';
    const manque = m ? [/^manque\b/i.test(m) ? m : `Manque : ${m}`] : [];
    return [{ n: typeof e.n === 'number' ? e.n : i + 1, libelle, texte, manque }];
  });
  return reponses.length ? reponses.sort((a, b) => a.n - b.n) : null;
}
