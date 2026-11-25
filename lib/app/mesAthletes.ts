/**
 * L'ESPACE COACH PAR ATHLÈTE, SES LECTURES (décision « 1A » du coach, 08/11/2026 ; maquette validée le 08/11/2026, « tout
 * A ») : « Mes athlètes » (l'accueil), « Urgent » et la page de chaque athlète lisent la même chose, une fois :
 * - « À regarder » et la vue du coach (espaceCoach.ts, vueDuCoach) ;
 * - les signaux gardés du soir (signauxGardes.ts) : la couleur de « Dimanche » (prevision.ts, Q1) et la santé du soir ;
 * - ce que le moteur a réglé seul ces 8 derniers jours (ecriture.ajustementsDuCoach, Q6) ;
 * - les semaines du dimanche (semainesDuDimanche.ts) : la semaine qui arrive, partie ou non, et le bilan (Q10).
 * Les pages « Cette semaine » et « Dimanche » y sont fondues. Le calcul (l'ordre, les étiquettes, « Urgent ») est dans
 * espaceParAthlete.ts. Côté serveur seulement.
 */
import { nomCourt } from './codeSeance';
import { vueDuCoach, type LigneAthlete, type VueCoach } from './espaceCoach';
import { ajustementsDuCoach, type Ajustement } from './ecriture';
import {
  athletesUrgents, bilanVisible, etiquettes, groupeDe, ordonner, raisonDuNiveau, seancesPasRemontees, texteRemontee, urgentDe,
  virgule, type DecisionMoteur, type Etiquette, type GroupeUrgent, type Point,
} from './espaceParAthlete';
import { lienNolioAthlete } from './liensNolio';
import { ajouterJours, dateAbregee, dateLongue, jourMois, joursEntre } from './plan';
import { prevision, type Prevision } from './prevision';
import { signauxGardes, SILENCE_JOURS, type SignauxGardes } from './signauxGardes';
import { TEXTES_A_FAIRE } from './espaceCoachSimple';
import { moteurEstV9 } from './moteurEnLigne';
import { ajustementsSansAllegees, pointsSousLaV1 } from './cacherSousLaV1';
import { estUneSaisonDeFond, reessayerPossible } from './reessayerDeSaison';
import { motsDuCoach, pointEnMotsDuCoach } from './motsDuCoach';
import { lireLesMots, type LigneDUnMot } from './motsDesCoaches';
import { attendLeCoach } from './unMot';
import { apresLePassage, HEURE_PASSAGE_UTC, lundiQuiVient, semainesDuDimanche, type SemainesDuDimanche } from './semainesDuDimanche';
import { clientService } from './supabase';

const jourCourt = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const rangDuJour = (jour: string) => (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7;

export type BilanDimanche = { dimanche: string; parties: number; pasParties: number };
// Ce que le moteur a décidé seul pour un coaché, une semaine : ses ajustements (un par objectif écrit cette semaine-là).
export type LigneMoteur = { athlete: string; lundi: string | null; planId: string; raisons: string[]; ajustements: Ajustement[] };

// Un athlète de la liste : sa ligne, sa couleur (Q1) et sa raison, ses points (ce qui bloque, la santé, ce qui arrive),
// ce que le moteur a réglé seul (Q6), ses étiquettes et son groupe dans l'ordre (Q2).
export type EtatAthlete = {
  id: string; nom: string; a: LigneAthlete; prevision: Prevision; raison: string; signaux: SignauxGardes | null;
  points: Point[]; moteur: DecisionMoteur | null; decisions: LigneMoteur[]; etiquettes: Etiquette[]; groupe: number;
};
export type EspaceCoach = {
  jour: string; vue: VueCoach; lignes: EtatAthlete[]; urgent: GroupeUrgent[]; urgents: number;
  // Sous la 9.x, un mot par coaché (lib/app/unMot.ts) ; vide sous la 8.x.
  mots: LigneDUnMot[];
  bilan: BilanDimanche | null; dimanche: SemainesDuDimanche;
  // false sans la migration du 04/11/2026 (signaux_suivi) : les pages le disent.
  signaux: boolean;
};

// LE BILAN DU DIMANCHE : le dernier passage fait. Le dimanche avant 18 h, c'est celui de la semaine d'avant. Parties : les
// semaines écrites depuis le premier passage (17 h UTC, vercel.json) jusqu'au lundi midi ; pas parties : le soir même,
// celles du dimanche pas encore parties ; ensuite, celles de « Semaine pas partie ».
async function bilanDuDimanche(coachId: string, jour: string, d: SemainesDuDimanche, pasPartiesLaSemaine: number, v9 = false): Promise<BilanDimanche | null> {
  const rang = rangDuJour(jour);
  const ceSoir = rang === 6 && apresLePassage(undefined, v9);
  const dimanche = ceSoir ? jour : rang === 6 ? ajouterJours(jour, -7) : ajouterJours(jour, -(rang + 1));
  const service = clientService();
  const { data: liens } = await service.from('coaching').select('plan_id').eq('coach_id', coachId);
  const ids = (liens ?? []).map((l) => l.plan_id as string);
  if (!ids.length) return null;
  const heure = String(HEURE_PASSAGE_UTC).padStart(2, '0');
  const { count } = await service.from('semaines_ecrites').select('plan_id', { count: 'exact', head: true }).in('plan_id', ids)
    .gte('ecrite_le', `${dimanche}T${heure}:00:00Z`).lt('ecrite_le', `${ajouterJours(dimanche, 1)}T12:00:00Z`);
  const pasParties = ceSoir ? d.ecrites.filter(({ o }) => !d.partis.has(o.plan_id)).length : pasPartiesLaSemaine;
  return { dimanche, parties: count ?? 0, pasParties };
}

// Les signaux gardés d'un athlète qui sont pour le coach (la santé) ; une séance manquée ou plus dure que prévu, le
// moteur la reprend dimanche, et sa décision est dans « Ce que le moteur change ». jour et mesure : pour dire deux jours
// en une étiquette (espaceParAthlete.etiquettes).
export function santeDesSignaux(nom: string, usr: string, g: SignauxGardes, jour: string): Point[] {
  const sante: Point[] = [];
  for (const s of g.signaux) {
    const le = jourCourt(s.jour);
    if (s.genre === 'commentaire') {
      sante.push({ niveau: 'sante', genre: 'commentaire', cle: `commentaire:${usr}:${s.jour}`, athlete: nom, action: 'Lire dans Nolio ›', href: lienNolioAthlete(usr),
        externe: true, jour: le, texte: `un commentaire à lire sur sa séance du ${le}.` });
    } else if (s.genre === 'sensations') {
      sante.push({ niveau: 'sante', genre: 'sensations', cle: `sensations:${usr}:${s.jour}`, athlete: nom, action: 'Lui écrire ›', href: lienNolioAthlete(usr),
        externe: true, jour: le, mesure: s.detail, texte: `de mauvaises sensations ${le} (${s.detail}).` });
    } else if (s.genre === 'hooper') {
      sante.push({ niveau: 'sante', genre: 'hooper', cle: `hooper:${usr}:${s.jour}`, athlete: nom, action: 'Lui écrire ›', href: lienNolioAthlete(usr),
        externe: true, detail: ligneHooper(s.detail), texte: `sa fatigue monte : ${virgule(s.detail)}.` });
    }
  }
  // UNE SÉANCE DU WEEK-END PAS REMONTÉE (décision 13-6 du coach du 10/11/2026) : à partir du mardi matin, la séance du
  // samedi ou la sortie longue du dimanche toujours absente de Nolio ; le coach vérifie et ajuste lui-même.
  for (const r of seancesPasRemontees(g.signaux, jour)) {
    const nomDuJour = new Date(`${r.jour}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
    const ligne = texteRemontee(r.sortieLongue, nomDuJour);
    sante.push({ niveau: 'sante', genre: 'remontee', cle: `remontee:${usr}:${r.jour}`, athlete: nom, action: 'Voir dans Nolio ›',
      href: lienNolioAthlete(usr), externe: true, jour: jourCourt(r.jour), detail: ligne,
      texte: `${ligne.charAt(0).toLowerCase()}${ligne.slice(1)}.` });
  }
  // Rien de remonté depuis 5 jours (point 11) : sa montre, ou il décroche ; seulement s'il avait des séances prévues.
  const depuis = g.derniere_activite ? joursEntre(g.derniere_activite, jour) : null;
  if (g.prevues > 0 && (depuis === null || depuis >= SILENCE_JOURS)) {
    sante.push({ niveau: 'sante', genre: 'silence', cle: `silence:${usr}:${g.derniere_activite ?? 'rien'}`, athlete: nom, action: 'Lui écrire ›',
      href: lienNolioAthlete(usr), externe: true,
      // La ligne de « Ce qui l'attend » : maquette validée par le coach le 08/11/2026.
      detail: `Depuis ${depuis === null ? 'plus de 10' : depuis} jours : sa montre, ou il décroche`,
      texte: depuis === null ? 'rien de remonté de Nolio depuis plus de 10 jours : sa montre, ou il décroche.'
        : `rien de remonté de Nolio depuis ${depuis} jours (dernière activité le ${dateLongue(g.derniere_activite as string, true)}) : sa montre, ou il décroche.` });
  }
  return sante;
}

const ligneHooper = (detail: string) => {
  const t = virgule(detail);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Le signal d'un coaché que le moteur a ajusté (Q6) : ce qu'il a changé (une séance allégée, sinon ses raisons, la durée
// d'un arrêt). Validé par le coach le 06/11/2026 (1A).
function decisionDuMoteur(l: LigneMoteur): DecisionMoteur {
  const ligne = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  if (l.raisons.includes('arrêt')) {
    const a = l.ajustements.find((x) => x.joursArret !== null);
    return { texte: 'Arrêt de course', ...(a ? { detail: `${a.joursArret} jours sans courir${a.lundi ? ` au ${dateAbregee(a.lundi)}` : ''}` } : {}) };
  }
  const allegees = l.ajustements.flatMap((x) => x.allegees);
  const fatigue = l.raisons.includes('fatigue') || allegees.length > 0;
  const detail = allegees.length
    ? allegees.map((j) => `${j.jour} : séance ${nomCourt(j.nom)} allégée en EF`).join(' · ')
    : l.raisons.map((r) => (r === 'fatigue' ? 'semaine allégée' : r)).join(', ');
  return { texte: fatigue ? 'Fatigue franche' : 'Semaine ajustée', ...(detail ? { detail: ligne(detail) } : {}) };
}

// Les ajustements, une ligne par coaché et par semaine (deux objectifs écrits la même semaine : une seule ligne).
function lignesDuMoteur(ajustements: Ajustement[]): LigneMoteur[] {
  const lignes = new Map<string, LigneMoteur>();
  for (const a of ajustements) {
    const cle = `${a.nom}|${a.lundi ?? a.numero}`;
    const l = lignes.get(cle);
    if (l) {
      l.ajustements.push(a);
      l.raisons = [...new Set([...l.raisons, ...a.raisons])];
    } else lignes.set(cle, { athlete: a.nom, lundi: a.lundi, planId: a.planId, raisons: [...a.raisons], ajustements: [a] });
  }
  return [...lignes.values()];
}

// membres : l'équipe Nolio du coach (la page la lit déjà) ; null si Nolio n'a pas répondu.
export async function espaceDuCoach(coachId: string, membres: Set<string> | null): Promise<EspaceCoach> {
  const jour = aujourdhui();
  const v9 = await moteurEstV9().catch(() => false);
  const [vue, gardes, ajustements, dimanche] = await Promise.all([
    vueDuCoach(coachId, membres), signauxGardes(coachId).catch(() => null),
    ajustementsDuCoach(coachId).catch(() => [] as Ajustement[]), semainesDuDimanche(coachId, jour),
  ]);
  const { data: regles } = await clientService().from('a_regarder_regles').select('cle').eq('coach_id', coachId);
  const reglees = new Set((regles ?? []).map((r) => String(r.cle)));
  // Sous la 9.x (décision 220 du coach, 24/11/2026 : ce que la v1 ne fait pas encore est caché ; lib/app/cacherSousLaV1.ts) : plus de séance allégée en EF (/v1/fatigue et /v1/veto
  // sont retirées), donc plus de « allégée en EF » ni de « Garder la séance d'origine », sur aucun écran. Sous la 8.x, les ajustements d'avant.
  const moteur = lignesDuMoteur(ajustementsSansAllegees(ajustements, v9));
  // La semaine que le passage du dimanche juge (Q1, « Dimanche » tel quel) : celle qui finit le dimanche qui vient.
  const juge = ajouterJours(lundiQuiVient(jour), -7);
  // Les points que la 9.x ne porte pas (course de préparation, test lu, saison de fond, passe du lundi) ne sont gardés sur aucun écran : un seul filtre, ici.
  const dits = pointsSousLaV1(vue.aRegarder, v9);
  // Le dimanche après le passage : les semaines du lundi qui vient pas encore parties attendent les reprises de 20 h et
  // 22 h (lundi, ce qui manque encore est le point « semaine » d'« À regarder », avec « Réessayer »).
  const ceSoir = rangDuJour(jour) === 6 && apresLePassage(undefined, v9);
  const lignes = vue.athletes.map((a): EtatAthlete => {
    const g = a.usr && a.accord && a.coache ? gardes?.get(a.usr) ?? null : null;
    // Sous la 9.x (décision 220 du coach, 24/11/2026 : les mots du coach remplacent le jargon ; lib/app/motsDuCoach.ts), la phrase de ce que le moteur prévoit n'a plus « la même marche ».
    const p: Prevision = g ? prevision({ prevues: g.prevues, faites: g.faites, hooper: g.hooper, signaux: g.signaux.map((x) => ({ ...x, seance: '' })) }, juge, motsDuCoach(v9).prevision)
      : { niveau: 'rien', pourquoi: '', prevoit: '' };
    const sante = g && a.usr ? santeDesSignaux(a.nom, a.usr, g, jour).filter((x) => !reglees.has(x.cle)) : [];
    // Sous la 9.x, ni le point ni la promesse d'un « Réessayer » lundi pour une ancienne saison de fond de la 8.x : il ne pourrait pas réussir (lib/app/reessayerDeSaison.ts, décision 220 du coach, 24/11/2026, suite).
    const pasParties: Point[] = ceSoir ? dimanche.ecrites.filter(({ a: f, o, plan }) => f.id === a.id && !dimanche.partis.has(o.plan_id)
        && a.objectif?.suivante?.partie !== true && reessayerPossible(v9, estUneSaisonDeFond(plan.parametres)))
      .map(({ o }) => ({ niveau: 'bloque', genre: 'semaine', cle: `semaine:${o.plan_id}:${dimanche.lundi}`, athlete: a.nom, action: '', href: `/app/coach/athlete/${a.id}#semaine-qui-arrive`,
        planId: o.plan_id, sansGeste: true,
        // La maquette validée par le coach le 08/11/2026 : sa ligne dans « Mes athlètes », et dans « Urgent ». Sous la 9.x (décision 220 du coach,
        // 24/11/2026 : plus de message d'infrastructure), pas un mot des « reprises de 20 h et 22 h » (celles de la 8.x) : « Réessayer » lundi.
        detail: v9 ? TEXTES_A_FAIRE.pasPartieDetail : 'Reprises ce soir à 20 h et 22 h ; sinon « Réessayer »',
        sous: v9 ? TEXTES_A_FAIRE.pasPartieSous : 'Ce soir, elle se refait aux reprises de 20 h et 22 h.',
        texte: `sa semaine du ${jourMois(dimanche.lundi)} n’est pas partie dans Nolio.` })) : [];
    // Le dimanche après le passage, « Semaine pas partie » parle de la semaine qui arrive : celle qui finit ce soir ne se
    // rattrape plus (« Réessayer » l'écrirait à partir d'aujourd'hui).
    // Sous la 9.x, la phrase de chaque point est dite en mots du coach (« effort ressenti », « fatigue déclarée », « du prévu tenu » : lib/app/motsDuCoach.ts) ; la donnée ne change pas.
    const enMotsDuCoach = (liste: Point[]) => (v9 ? liste.map(pointEnMotsDuCoach) : liste);
    const points: Point[] = enMotsDuCoach([...dits.filter((r) => r.athlete === a.nom && r.niveau === 'bloque' && !(ceSoir && r.genre === 'semaine')), ...pasParties,
      ...dits.filter((r) => r.athlete === a.nom && r.niveau === 'sante'), ...sante,
      ...dits.filter((r) => r.athlete === a.nom && r.niveau === 'arrive')]);
    const decisions = moteur.filter((l) => l.athlete === a.nom).sort((x, y) => String(y.lundi ?? '').localeCompare(String(x.lundi ?? '')));
    const decision = decisions[0] ? decisionDuMoteur(decisions[0]) : null;
    return {
      id: a.id, nom: a.nom, a, prevision: p, raison: raisonDuNiveau(p, g ? g.prevues : null, a.accord), signaux: g, points,
      moteur: decision, decisions, etiquettes: etiquettes(points, decision), groupe: groupeDe(p.niveau, points, Boolean(decision)),
    };
  });
  const ordonnees = ordonner(lignes);
  const urgent = urgentDe(ordonnees);
  // Sous la 9.x, la pastille compte les lignes de « Mes athlètes » qui attendent le coach, « Il manque » comprises ; sous la 8.x, les athlètes d'« Urgent ».
  const mots = v9 ? await lireLesMots(clientService(), coachId, ordonnees, jour) : [];
  const urgents = v9 ? mots.filter((m) => attendLeCoach(m.un)).length : athletesUrgents(urgent);
  const bilan = bilanVisible(rangDuJour(jour), apresLePassage(undefined, v9))
    ? await bilanDuDimanche(coachId, jour, dimanche, vue.aRegarder.filter((r) => r.genre === 'semaine').length, v9).catch(() => null) : null;
  return { jour, vue, lignes: ordonnees, urgent, urgents, mots, bilan, dimanche, signaux: gardes !== null };
}
