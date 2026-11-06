/**
 * « CETTE SEMAINE », L'ACCUEIL DU COACH (EC1, audit de l'app coach du 03/11/2026 ; décision coach du 04/11/2026, « A ») :
 * le coaching par exception. Une seule question à l'ouverture, « qui a besoin de moi cette semaine, et pourquoi ? » :
 * - le bilan du dimanche en tête (les semaines parties, celles qui ne le sont pas) ;
 * - UNE CARTE PAR COACHÉ à regarder (décision coach du 04/11/2026, relecture écran par écran) : ses raisons regroupées,
 *   ce qui bloque d'abord, puis la santé (un commentaire, de mauvaises sensations, un Hooper qui monte, rien de remonté
 *   depuis 5 jours, un arrêt qui dure) ; un seul geste, celui de sa première raison ; « Réglé » pour la carte ;
 * - « Le moteur s'en est chargé », replié : une ligne par coaché et par semaine écrite, ses raisons, « Annuler les
 *   ajustements » sur la dernière semaine écrite (B-EC-1) ; les séances à l'origine de ses décisions, qui les redisaient,
 *   n'y sont plus ;
 * - « À venir », rien d'urgent ;
 * - le nombre de coachés sans rien à signaler.
 * Et, pour « Mes athlètes », le signal de chacun, le même que sur cet accueil. Tout vient de la base : « À regarder »
 * (espaceCoach.ts) et les signaux gardés du soir (signauxGardes.ts, EC2). Côté serveur seulement.
 */
import { vueDuCoach, type ARegarder, type VueCoach } from './espaceCoach';
import { ajustementsDuCoach, type Ajustement } from './ecriture';
import { lienNolioAthlete } from './liensNolio';
import { ajouterJours, dateAbregee, dateLongue, joursEntre } from './plan';
import { signauxGardes, SILENCE_JOURS, type SignauxGardes } from './signauxGardes';
import { apresLePassage, HEURE_PASSAGE_UTC, semainesDuDimanche } from './semainesDuDimanche';
import { clientService } from './supabase';

const jourCourt = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' });

export type BilanDimanche = { dimanche: string; parties: number; pasParties: number };
// Un coaché à regarder : ses raisons, ce qui bloque d'abord ; le geste est celui de la première.
export type CarteCoache = { athlete: string; raisons: ARegarder[] };
// Ce que le moteur a décidé seul pour un coaché, une semaine : ses ajustements (un par objectif écrit cette semaine-là).
export type LigneMoteur = { athlete: string; lundi: string | null; planId: string; raisons: string[]; ajustements: Ajustement[] };
// Le signal de sa ligne dans « Mes athlètes » : le nom court de ce que cet accueil dit de lui. Décision 1A du coach
// (05/11/2026) : un lien vers le détail (href, externe : hors de l'app, Nolio) et, dessous, une ligne courte qui dit ce
// qui se passe (detail) ; « Rien à signaler » n'a ni l'un ni l'autre.
export type SignalAthlete = { texte: string; niveau: 'ok' | 'warn' | 'ko' | 'neutre'; detail?: string; href?: string; externe?: boolean };
export type CetteSemaine = {
  bilan: BilanDimanche | null;
  cartes: CarteCoache[];
  moteur: LigneMoteur[];
  aVenir: ARegarder[];
  calmes: number; coaches: number;
  // false sans la migration du 04/11/2026 (signaux_suivi) : l'accueil le dit.
  signaux: boolean;
  signalDe: Map<string, SignalAthlete>;
};

const SIGNAL: Record<string, string> = {
  demande: 'Objectif demandé', arret: 'Arrêt de course', mot: 'Un mot pour toi', rpe: 'RPE à revoir', retour: 'Sans retour',
  sous_plan: 'Sous le plan', demarrer: 'À démarrer', nolio: 'Nolio à associer', equipe: 'Hors de l’équipe Nolio',
  accord: 'Sans accord de lecture', semaine: 'Semaine pas partie', profil: 'Profil à remplir', commentaire: 'Commentaire à lire',
  sensations: 'Mauvaises sensations', hooper: 'Fatigue qui monte', silence: 'Rien de remonté', chrono_route: 'Chrono à revoir',
  prerequis: 'Prérequis à voir', course_nolio: 'Course A dans Nolio', preparation: 'Course de préparation', suite: 'Rien après',
  test: 'Test à revoir', week_end_choc: 'Week-end choc à annoncer', courses_proches: 'Courses trop proches',
};

// LE BILAN DU DIMANCHE : le dernier passage fait. Le dimanche avant 18 h, c'est celui de la semaine d'avant (le passage
// du jour n'a pas eu lieu : « 0 semaine partie, 1 pas partie » le dimanche matin, 04/11/2026). Parties : les semaines
// écrites depuis le premier passage (17 h UTC, vercel.json) jusqu'au lundi midi ; pas parties : le soir même, celles que
// « Dimanche » montre « pas encore partie » ; ensuite, celles de « Ce qui bloque » (semaine pas partie).
async function bilanDuDimanche(coachId: string, jour: string, pasPartiesLaSemaine: number): Promise<BilanDimanche | null> {
  const rang = (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7;
  const ceSoir = rang === 6 && apresLePassage();
  const dimanche = ceSoir ? jour : rang === 6 ? ajouterJours(jour, -7) : ajouterJours(jour, -(rang + 1));
  const service = clientService();
  const { data: liens } = await service.from('coaching').select('plan_id').eq('coach_id', coachId);
  const ids = (liens ?? []).map((l) => l.plan_id as string);
  if (!ids.length) return null;
  const heure = String(HEURE_PASSAGE_UTC).padStart(2, '0');
  const { count } = await service.from('semaines_ecrites').select('plan_id', { count: 'exact', head: true }).in('plan_id', ids)
    .gte('ecrite_le', `${dimanche}T${heure}:00:00Z`).lt('ecrite_le', `${ajouterJours(dimanche, 1)}T12:00:00Z`);
  let pasParties = pasPartiesLaSemaine;
  if (ceSoir) {
    const d = await semainesDuDimanche(coachId, jour);
    pasParties = d.ecrites.filter(({ o }) => !d.partis.has(o.plan_id)).length;
  }
  return { dimanche, parties: count ?? 0, pasParties };
}

// Les signaux gardés d'un athlète qui sont pour le coach (la santé) ; une séance manquée ou plus dure que prévu, le
// moteur la reprend dimanche, et sa décision est dans « Le moteur s'en est chargé ».
function santeDesSignaux(nom: string, usr: string, g: SignauxGardes, jour: string): ARegarder[] {
  const sante: ARegarder[] = [];
  for (const s of g.signaux) {
    const le = jourCourt(s.jour);
    if (s.genre === 'commentaire') {
      sante.push({ niveau: 'sante', genre: 'commentaire', cle: `commentaire:${usr}:${s.jour}`, athlete: nom, action: 'Lire dans Nolio ›', href: lienNolioAthlete(usr),
        externe: true, texte: `un commentaire à lire sur sa séance du ${le}.` });
    } else if (s.genre === 'sensations') {
      sante.push({ niveau: 'sante', genre: 'sensations', cle: `sensations:${usr}:${s.jour}`, athlete: nom, action: 'Lui écrire ›', href: lienNolioAthlete(usr),
        externe: true, texte: `de mauvaises sensations ${le} (${s.detail}).` });
    } else if (s.genre === 'hooper') {
      sante.push({ niveau: 'sante', genre: 'hooper', cle: `hooper:${usr}:${s.jour}`, athlete: nom, action: 'Lui écrire ›', href: lienNolioAthlete(usr),
        externe: true, texte: `sa fatigue monte : ${s.detail}.` });
    }
  }
  // Rien de remonté depuis 5 jours (point 11) : sa montre, ou il décroche ; seulement s'il avait des séances prévues.
  const depuis = g.derniere_activite ? joursEntre(g.derniere_activite, jour) : null;
  if (g.prevues > 0 && (depuis === null || depuis >= SILENCE_JOURS)) {
    sante.push({ niveau: 'sante', genre: 'silence', cle: `silence:${usr}:${g.derniere_activite ?? 'rien'}`, athlete: nom, action: 'Lui écrire ›',
      href: lienNolioAthlete(usr), externe: true,
      texte: depuis === null ? 'rien de remonté de Nolio depuis plus de 10 jours : sa montre, ou il décroche.'
        : `rien de remonté de Nolio depuis ${depuis} jours (dernière activité le ${dateLongue(g.derniere_activite as string, true)}) : sa montre, ou il décroche.` });
  }
  return sante;
}

// La ligne courte d'un signal tirée du texte d'« À regarder » : sa majuscule, sans point final (l'écran la coupe à deux
// lignes, le lien garde le texte entier).
const ligneCourte = (texte: string) => (texte.charAt(0).toUpperCase() + texte.slice(1)).replace(/\.$/, '');

// Le signal d'un coaché que le moteur a ajusté : ce qu'il a changé (une séance allégée, sinon ses raisons, la durée d'un
// arrêt), et la semaine sur la page de son plan, là où son pourquoi est écrit.
function signalDuMoteur(l: LigneMoteur): SignalAthlete {
  const derniere = l.ajustements[l.ajustements.length - 1];
  const href = `/app/coach/plan/${derniere.planId}#semaine-${derniere.numero}`;
  if (l.raisons.includes('arrêt')) {
    const a = l.ajustements.find((x) => x.joursArret !== null);
    // Validé par le coach le 06/11/2026 (1A)
    return { niveau: 'warn', texte: 'Arrêt de course', href,
      ...(a ? { detail: `${a.joursArret} jours sans courir${a.lundi ? ` au ${dateAbregee(a.lundi)}` : ''}` } : {}) };
  }
  const allegees = l.ajustements.flatMap((x) => x.allegees);
  const fatigue = l.raisons.includes('fatigue') || allegees.length > 0;
  // Validé par le coach le 06/11/2026 (1A) : « Mardi : séance VO2 long allégée en EF » ; la fatigue du dimanche (R3), « semaine allégée ».
  const detail = allegees.length
    ? allegees.map((j) => `${j.jour} : séance ${j.nom.split(' — ')[0].split(' · ')[0]} allégée en EF`).join(' · ')
    : l.raisons.map((r) => (r === 'fatigue' ? 'semaine allégée' : r)).join(', ');
  return { niveau: 'warn', texte: fatigue ? 'Fatigue franche' : 'Semaine ajustée', href, ...(detail ? { detail: ligneCourte(detail) } : {}) };
}

// Le signal d'un point d'« À regarder » : son nom court, sa ligne (la sienne, sinon son texte ; rien pour un arrêt dont
// la durée n'est pas connue) et son geste.
const signalDuPoint = (r: ARegarder, niveau: SignalAthlete['niveau']): SignalAthlete => ({
  texte: SIGNAL[r.genre] ?? r.texte, niveau, href: r.href, ...(r.externe ? { externe: true } : {}),
  ...(r.detail ? { detail: r.detail } : r.genre === 'arret' ? {} : { detail: ligneCourte(r.texte) }),
});

// Les ajustements, une ligne par coaché et par semaine (deux objectifs écrits la même semaine, une saison qui s'arrête
// et la préparation qui part : une seule ligne).
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

// membres : l'équipe Nolio du coach, comme pour « À regarder » ; vue : celle que la page a déjà lue (« Mes athlètes »).
export async function cetteSemaine(coachId: string, membres: Set<string> | null, vueLue?: VueCoach): Promise<CetteSemaine> {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const [vue, gardes, ajustements] = await Promise.all([vueLue ?? vueDuCoach(coachId, membres), signauxGardes(coachId),
    ajustementsDuCoach(coachId).catch(() => [] as Ajustement[])]);
  const { data: regles } = await clientService().from('a_regarder_regles').select('cle').eq('coach_id', coachId);
  const reglees = new Set((regles ?? []).map((r) => String(r.cle)));
  const santeDuSoir: ARegarder[] = [];
  for (const a of vue.athletes) {
    const g = a.usr && a.accord && a.coache ? gardes?.get(a.usr) : undefined;
    if (g) santeDuSoir.push(...santeDesSignaux(a.nom, a.usr as string, g, jour).filter((x) => !reglees.has(x.cle)));
  }
  const bloque = vue.aRegarder.filter((r) => r.niveau === 'bloque');
  const parCoache = new Map<string, CarteCoache>();
  for (const r of [...bloque, ...vue.aRegarder.filter((x) => x.niveau === 'sante'), ...santeDuSoir]) {
    const c = parCoache.get(r.athlete);
    if (c) c.raisons.push(r);
    else parCoache.set(r.athlete, { athlete: r.athlete, raisons: [r] });
  }
  const cartes = [...parCoache.values()];
  const moteur = lignesDuMoteur(ajustements);
  const aVenir = vue.aRegarder.filter((r) => r.niveau === 'arrive');
  // Le signal de chacun dans « Mes athlètes » : sa carte, sinon ce que le moteur a réglé pour lui (sa semaine la plus
  // récente), sinon ce qui arrive.
  const signalDe = new Map<string, SignalAthlete>();
  for (const a of vue.athletes) {
    const carte = parCoache.get(a.nom);
    const decision = moteur.filter((l) => l.athlete === a.nom).sort((x, y) => String(y.lundi ?? '').localeCompare(String(x.lundi ?? '')))[0];
    const arrive = aVenir.find((r) => r.athlete === a.nom);
    signalDe.set(a.nom, carte ? signalDuPoint(carte.raisons[0], 'ko')
      : decision ? signalDuMoteur(decision)
        : arrive ? signalDuPoint(arrive, 'neutre')
          : { texte: 'Rien à signaler', niveau: 'ok' });
  }
  const coaches = vue.athletes.filter((a) => a.coache);
  return {
    bilan: await bilanDuDimanche(coachId, jour, bloque.filter((r) => r.genre === 'semaine').length).catch(() => null),
    cartes, moteur, aVenir,
    calmes: coaches.filter((a) => !parCoache.has(a.nom)).length, coaches: coaches.length,
    signaux: gardes !== null, signalDe,
  };
}
