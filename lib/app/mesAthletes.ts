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
  athletesUrgents, bilanVisible, etiquettes, groupeDe, ordonner, raisonDuNiveau, urgentDe, virgule,
  type DecisionMoteur, type Etiquette, type GroupeUrgent, type Point,
} from './espaceParAthlete';
import { lienNolioAthlete } from './liensNolio';
import { ajouterJours, dateAbregee, dateLongue, jourMois, joursEntre } from './plan';
import { prevision, type Prevision } from './prevision';
import { signauxGardes, SILENCE_JOURS, type SignauxGardes } from './signauxGardes';
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
  bilan: BilanDimanche | null; dimanche: SemainesDuDimanche;
  // false sans la migration du 04/11/2026 (signaux_suivi) : les pages le disent.
  signaux: boolean;
};

// LE BILAN DU DIMANCHE : le dernier passage fait. Le dimanche avant 18 h, c'est celui de la semaine d'avant. Parties : les
// semaines écrites depuis le premier passage (17 h UTC, vercel.json) jusqu'au lundi midi ; pas parties : le soir même,
// celles du dimanche pas encore parties ; ensuite, celles de « Semaine pas partie ».
async function bilanDuDimanche(coachId: string, jour: string, d: SemainesDuDimanche, pasPartiesLaSemaine: number): Promise<BilanDimanche | null> {
  const rang = rangDuJour(jour);
  const ceSoir = rang === 6 && apresLePassage();
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
  const [vue, gardes, ajustements, dimanche] = await Promise.all([
    vueDuCoach(coachId, membres), signauxGardes(coachId).catch(() => null),
    ajustementsDuCoach(coachId).catch(() => [] as Ajustement[]), semainesDuDimanche(coachId, jour),
  ]);
  const { data: regles } = await clientService().from('a_regarder_regles').select('cle').eq('coach_id', coachId);
  const reglees = new Set((regles ?? []).map((r) => String(r.cle)));
  const moteur = lignesDuMoteur(ajustements);
  // La semaine que le passage du dimanche juge (Q1, « Dimanche » tel quel) : celle qui finit le dimanche qui vient.
  const juge = ajouterJours(lundiQuiVient(jour), -7);
  // Le dimanche après le passage : les semaines du lundi qui vient pas encore parties attendent les reprises de 20 h et
  // 22 h (lundi, ce qui manque encore est le point « semaine » d'« À regarder », avec « Réessayer »).
  const ceSoir = rangDuJour(jour) === 6 && apresLePassage();
  const lignes = vue.athletes.map((a): EtatAthlete => {
    const g = a.usr && a.accord && a.coache ? gardes?.get(a.usr) ?? null : null;
    const p: Prevision = g ? prevision({ prevues: g.prevues, faites: g.faites, hooper: g.hooper, signaux: g.signaux.map((x) => ({ ...x, seance: '' })) }, juge)
      : { niveau: 'rien', pourquoi: '', prevoit: '' };
    const sante = g && a.usr ? santeDesSignaux(a.nom, a.usr, g, jour).filter((x) => !reglees.has(x.cle)) : [];
    const pasParties: Point[] = ceSoir ? dimanche.ecrites.filter(({ a: f, o }) => f.id === a.id && !dimanche.partis.has(o.plan_id)
        && a.objectif?.suivante?.partie !== true)
      .map(({ o }) => ({ niveau: 'bloque', genre: 'semaine', cle: `semaine:${o.plan_id}:${dimanche.lundi}`, athlete: a.nom, action: '', href: `/app/coach/athlete/${a.id}#semaine-qui-arrive`,
        planId: o.plan_id, sansGeste: true,
        // La maquette validée par le coach le 08/11/2026 : sa ligne dans « Mes athlètes », et dans « Urgent ».
        detail: 'Reprises ce soir à 20 h et 22 h ; sinon « Réessayer »', sous: 'Ce soir, elle se refait aux reprises de 20 h et 22 h.',
        texte: `sa semaine du ${jourMois(dimanche.lundi)} n’est pas partie dans Nolio.` })) : [];
    // Le dimanche après le passage, « Semaine pas partie » parle de la semaine qui arrive : celle qui finit ce soir ne se
    // rattrape plus (« Réessayer » l'écrirait à partir d'aujourd'hui).
    const points: Point[] = [...vue.aRegarder.filter((r) => r.athlete === a.nom && r.niveau === 'bloque' && !(ceSoir && r.genre === 'semaine')), ...pasParties,
      ...vue.aRegarder.filter((r) => r.athlete === a.nom && r.niveau === 'sante'), ...sante,
      ...vue.aRegarder.filter((r) => r.athlete === a.nom && r.niveau === 'arrive')];
    const decisions = moteur.filter((l) => l.athlete === a.nom).sort((x, y) => String(y.lundi ?? '').localeCompare(String(x.lundi ?? '')));
    const decision = decisions[0] ? decisionDuMoteur(decisions[0]) : null;
    return {
      id: a.id, nom: a.nom, a, prevision: p, raison: raisonDuNiveau(p, g ? g.prevues : null, a.accord), signaux: g, points,
      moteur: decision, decisions, etiquettes: etiquettes(points, decision), groupe: groupeDe(p.niveau, points, Boolean(decision)),
    };
  });
  const ordonnees = ordonner(lignes);
  const urgent = urgentDe(ordonnees);
  const urgents = athletesUrgents(urgent);
  const bilan = bilanVisible(rangDuJour(jour), apresLePassage())
    ? await bilanDuDimanche(coachId, jour, dimanche, vue.aRegarder.filter((r) => r.genre === 'semaine').length).catch(() => null) : null;
  return { jour, vue, lignes: ordonnees, urgent, urgents, bilan, dimanche, signaux: gardes !== null };
}
