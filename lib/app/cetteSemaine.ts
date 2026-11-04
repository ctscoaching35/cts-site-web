/**
 * « CETTE SEMAINE », L'ACCUEIL DU COACH (EC1, audit de l'app coach du 03/11/2026 ; décision coach du 04/11/2026, « A ») :
 * le coaching par exception. Une seule question à l'ouverture, « qui a besoin de moi cette semaine, et pourquoi ? » :
 * - le bilan du dimanche en tête (les semaines parties, celles qui ne le sont pas) ;
 * - une ligne par coaché à regarder, la raison en une phrase et le geste en un clic : ce qui bloque, puis la santé (un
 *   commentaire, de mauvaises sensations, un Hooper qui monte, rien de remonté depuis 5 jours, un arrêt qui dure) ;
 * - « Le moteur s'en est chargé », replié : ses décisions (fatigue, séance trop dure, arrêt court, disponibilités…),
 *   chacune s'annulant d'un clic sur la dernière semaine écrite (B-EC-1), et ce qu'il réglera dimanche ;
 * - « À venir », rien d'urgent ;
 * - le nombre de coachés sans rien à signaler.
 * Tout vient de la base : « À regarder » (espaceCoach.ts) et les signaux gardés du soir (signauxGardes.ts, EC2). Côté
 * serveur seulement.
 */
import { vueDuCoach, type ARegarder } from './espaceCoach';
import { ajustementsDuCoach, type Ajustement } from './ecriture';
import { ajouterJours, dateLongue, joursEntre } from './plan';
import { signauxGardes, SILENCE_JOURS, type SignauxGardes } from './signauxGardes';
import { clientService } from './supabase';

const NOLIO = 'https://www.nolio.io/';
const jourCourt = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' });

export type BilanDimanche = { dimanche: string; parties: number; pasParties: number };
export type CetteSemaine = {
  bilan: BilanDimanche | null;
  pourToi: ARegarder[];
  // Ce que le moteur a décidé, ou décidera dimanche, sans demander rien.
  moteur: ARegarder[]; ajustements: Ajustement[];
  aVenir: ARegarder[];
  calmes: number; coaches: number;
  // false sans la migration du 04/11/2026 (signaux_suivi) : l'accueil le dit.
  signaux: boolean;
};

// Le dernier dimanche passé (aujourd'hui s'il est dimanche) et ce que son passage a écrit : les semaines écrites depuis
// 17 h UTC, l'heure du premier passage (vercel.json).
async function bilanDuDimanche(coachId: string, jour: string, pasParties: number): Promise<BilanDimanche | null> {
  const rang = (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7;
  const dimanche = rang === 6 ? jour : ajouterJours(jour, -(rang + 1));
  const service = clientService();
  const { data: liens } = await service.from('coaching').select('plan_id').eq('coach_id', coachId);
  const ids = (liens ?? []).map((l) => l.plan_id as string);
  if (!ids.length) return null;
  const { count } = await service.from('semaines_ecrites').select('plan_id', { count: 'exact', head: true }).in('plan_id', ids)
    .gte('ecrite_le', `${dimanche}T17:00:00Z`).lt('ecrite_le', `${ajouterJours(dimanche, 1)}T12:00:00Z`);
  return { dimanche, parties: count ?? 0, pasParties };
}

// Les signaux gardés d'un athlète, en lignes : pour lui (santé), ou pour le moteur (séance manquée, plus dure que prévu,
// que les règles du dimanche reprennent).
function lignesDesSignaux(nom: string, usr: string, g: SignauxGardes, jour: string, href: string): { sante: ARegarder[]; moteur: ARegarder[] } {
  const sante: ARegarder[] = [];
  const moteur: ARegarder[] = [];
  for (const s of g.signaux) {
    const le = jourCourt(s.jour);
    if (s.genre === 'commentaire') {
      sante.push({ niveau: 'sante', genre: 'commentaire', cle: `commentaire:${usr}:${s.jour}`, athlete: nom, action: 'Lire dans Nolio ›', href: NOLIO,
        externe: true, texte: `un commentaire à lire sur sa séance du ${le}.` });
    } else if (s.genre === 'sensations') {
      sante.push({ niveau: 'sante', genre: 'sensations', cle: `sensations:${usr}:${s.jour}`, athlete: nom, action: 'Lui écrire ›', href: NOLIO,
        externe: true, texte: `de mauvaises sensations ${le} (${s.detail}).` });
    } else if (s.genre === 'hooper') {
      sante.push({ niveau: 'sante', genre: 'hooper', cle: `hooper:${usr}:${s.jour}`, athlete: nom, action: 'Lui écrire ›', href: NOLIO,
        externe: true, texte: `sa fatigue monte : ${s.detail}.` });
    } else if (s.genre === 'plus_dur') {
      moteur.push({ niveau: 'moteur', genre: 'plus_dur', cle: `plus_dur:${usr}:${s.jour}`, athlete: nom, action: 'Voir ›', href,
        texte: `séance plus dure que prévu ${le} (${s.detail}) : si c’est une séance clé, la suivante refait la même marche.` });
    } else if (s.genre === 'manquee') {
      moteur.push({ niveau: 'moteur', genre: 'manquee', cle: `manquee:${usr}:${s.jour}`, athlete: nom, action: 'Voir ›', href,
        texte: `séance du ${le} manquée : si c’est une séance clé, sa marche se refait la fois suivante.` });
    }
  }
  // Rien de remonté depuis 5 jours (point 11) : sa montre, ou il décroche ; seulement s'il avait des séances prévues.
  const depuis = g.derniere_activite ? joursEntre(g.derniere_activite, jour) : null;
  if (g.prevues > 0 && (depuis === null || depuis >= SILENCE_JOURS)) {
    sante.push({ niveau: 'sante', genre: 'silence', cle: `silence:${usr}:${g.derniere_activite ?? 'rien'}`, athlete: nom, action: 'Lui écrire ›',
      href: NOLIO, externe: true,
      texte: depuis === null ? 'rien de remonté de Nolio depuis plus de 10 jours : sa montre, ou il décroche.'
        : `rien de remonté de Nolio depuis ${depuis} jours (dernière activité le ${dateLongue(g.derniere_activite as string, true)}) : sa montre, ou il décroche.` });
  }
  return { sante, moteur };
}

// membres : l'équipe Nolio du coach, comme pour « À regarder ».
export async function cetteSemaine(coachId: string, membres: Set<string> | null): Promise<CetteSemaine> {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const [vue, gardes, ajustements] = await Promise.all([vueDuCoach(coachId, membres), signauxGardes(coachId),
    ajustementsDuCoach(coachId).catch(() => [] as Ajustement[])]);
  const { data: regles } = await clientService().from('a_regarder_regles').select('cle').eq('coach_id', coachId);
  const reglees = new Set((regles ?? []).map((r) => String(r.cle)));
  const sante: ARegarder[] = [];
  const parSignal: ARegarder[] = [];
  for (const a of vue.athletes) {
    const g = a.usr && a.accord && a.mode === 'coaching' ? gardes?.get(a.usr) : undefined;
    if (!g) continue;
    const l = lignesDesSignaux(a.nom, a.usr as string, g, jour, a.objectif ? `/app/coach/plan/${a.objectif.plan_id}` : `/app/coach/athlete/${a.id}`);
    sante.push(...l.sante.filter((x) => !reglees.has(x.cle)));
    parSignal.push(...l.moteur.filter((x) => !reglees.has(x.cle)));
  }
  const bloque = vue.aRegarder.filter((r) => r.niveau === 'bloque');
  const pourToi = [...bloque, ...vue.aRegarder.filter((r) => r.niveau === 'sante'), ...sante];
  const avecLigne = new Set(pourToi.map((r) => r.athlete));
  const coaches = vue.athletes.filter((a) => a.mode === 'coaching').length;
  return {
    bilan: await bilanDuDimanche(coachId, jour, bloque.filter((r) => r.genre === 'semaine').length).catch(() => null),
    pourToi, moteur: [...vue.aRegarder.filter((r) => r.niveau === 'moteur'), ...parSignal], ajustements,
    aVenir: vue.aRegarder.filter((r) => r.niveau === 'arrive'),
    calmes: vue.athletes.filter((a) => a.mode === 'coaching' && !avecLigne.has(a.nom)).length, coaches,
    signaux: gardes !== null,
  };
}
