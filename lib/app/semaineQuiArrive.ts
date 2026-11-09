/**
 * « SA SEMAINE QUI ARRIVE » SUR LA PAGE DE L'ATHLÈTE (l'espace par athlète, Q4 « A », maquette validée par le coach le
 * 08/11/2026) : l'aperçu du dimanche entré dans sa page.
 * - Après le passage du dimanche (et le lundi, comme le bilan du dimanche, Q10) : la semaine écrite, la note « Ta
 *   semaine », et son « pourquoi » et ce qu'il a lu, gardés au passage (semaines_ecrites.revue ; sans la migration du
 *   08/11/2026, rien de gardé, la page le dit). Pas encore partie : le dimanche soir, ses reprises ; le lundi,
 *   « Réessayer ».
 * - Avant le passage : ce que la couleur de « Dimanche » prévoit, et « Voir ce que le moteur écrirait », qui calcule
 *   l'aperçu dans la page (ecriture.apercuDuDimanche, le chemin du passage du dimanche : ils changent ensemble), jamais
 *   à l'ouverture de la page sans le demander.
 * - LA SEMAINE TELLE QU'ELLE EST DANS NOLIO (décision 11 du coach du 09/11/2026) : la semaine écrite, partie, se lit dans
 *   Nolio à l'ouverture de la page, chaque retouche marquée pour le coach (lib/app/semaineDansNolio.ts) ; « Ce que le
 *   moteur change » et « Annuler les ajustements » ne sont plus sur sa page.
 * Côté serveur seulement.
 */
import { destinataire, type FicheAthlete, type SeanceEnvoyee } from './coaching';
import { apercuDuDimanche, type Apercu, type Revue } from './ecriture';
import { appelNolio, listeNolio, nolioConfigure, SPORTS_COURSE } from './nolio';
import { ajouterJours, type Semaine } from './plan';
import { comparerLaSemaine, type PrevueNolio, type SemaineComparee } from './semaineDansNolio';
import { apresLePassage, lundiQuiVient, type SemaineDuDimanche } from './semainesDuDimanche';
import { clientService } from './supabase';
import { empreinteSeance } from './trameNolio';

export type LigneEcrite = {
  numero: string; donnees: Semaine; journal: Record<string, unknown>[]; bilan: string | null; notes: { regle?: string; texte: string }[];
  sans_ajustement: boolean; ecrite_le: string; realise: unknown; revue?: Revue | null;
};
type Commun = { planId: string; course: string; fond: boolean };
// La semaine partie, telle qu'elle est dans Nolio (décision 11 du coach du 09/11/2026) : comparee, et l'heure de la
// lecture ; erreur : Nolio n'a pas répondu (la carte montre la semaine écrite).
export type LectureDeLaSemaine = { comparee: SemaineComparee; lue_le: string } | { erreur: string };
export type SemaineQuiArrive =
  // revueGardee : la colonne existe (la migration du 08/11/2026 est passée) ; realise : la semaine écoulée qu'il a jugée ;
  // nolio : sa lecture dans Nolio (null : rien à lire, Nolio pas relié ou la semaine sans envoi gardé).
  | (Commun & { etat: 'ecrite'; ligne: LigneEcrite; revueGardee: boolean; realise: Revue['realise']; nolio: LectureDeLaSemaine | null })
  // ceSoir : le dimanche, ses reprises de 20 h et 22 h ; sinon le lundi, « Réessayer ». laissee : tes séances déjà posées.
  | (Commun & { etat: 'pas_partie'; ceSoir: boolean; laissee: boolean })
  // apercu : calculé à la demande (« Voir ce que le moteur écrirait ») ; erreur : Nolio ou le moteur n'a pas répondu.
  | (Commun & { etat: 'avant'; apercu?: Apercu; erreur?: string });

const rangDuJour = (jour: string) => (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7;

// Le lundi de la semaine écrite que la page montre : le dimanche après le passage, celle de demain ; le lundi, celle du
// jour ; null avant le passage (l'aperçu se calcule à la demande).
export function lundiMontre(jour: string, apres = apresLePassage()): string | null {
  const rang = rangDuJour(jour);
  if (rang === 6 && apres) return lundiQuiVient(jour);
  if (rang === 0) return jour;
  return null;
}

// Ses semaines écrites (la revue avec elles, sans la colonne si la migration n'est pas passée).
async function lignesEcrites(planId: string): Promise<{ lignes: LigneEcrite[]; revueGardee: boolean }> {
  const service = clientService();
  const champs = 'numero, donnees, journal, bilan, notes, sans_ajustement, ecrite_le, realise';
  const avec = await service.from('semaines_ecrites').select(`${champs}, revue`).eq('plan_id', planId);
  if (!avec.error) return { lignes: (avec.data ?? []) as unknown as LigneEcrite[], revueGardee: true };
  const sans = await service.from('semaines_ecrites').select(champs).eq('plan_id', planId);
  return { lignes: (sans.data ?? []) as unknown as LigneEcrite[], revueGardee: false };
}

const numeroDe = (n: string) => Number(String(n).replace(/^S/, ''));

// ecrites : ses semaines du dimanche (semainesDuDimanche, celles que le moteur écrit) ; apercu : l'objectif dont le coach a
// demandé l'aperçu (?apercu=).
export async function semainesQuiArrivent(ecrites: SemaineDuDimanche[], jour: string, apercu: string | null): Promise<SemaineQuiArrive[]> {
  const lundi = lundiMontre(jour);
  const service = clientService();
  const ids = ecrites.map((e) => e.o.plan_id);
  const { data: laissees } = lundi && ids.length
    ? await service.from('nolio_envois').select('plan_id').in('plan_id', ids).eq('semaine', `laissee:${lundi}`) : { data: [] };
  const laisseesAuCoach = new Set((laissees ?? []).map((x) => String(x.plan_id)));
  return Promise.all(ecrites.map(async ({ a, o, plan }): Promise<SemaineQuiArrive> => {
    const fond = Boolean((plan.parametres as { fond?: unknown } | null)?.fond);
    const commun: Commun = { planId: o.plan_id, course: o.course_date, fond };
    const { lignes, revueGardee } = await lignesEcrites(o.plan_id);
    if (lundi) {
      const ligne = lignes.find((l) => l.donnees?.lundi === lundi);
      if (ligne) {
        const avant = lignes.find((l) => numeroDe(l.numero) === numeroDe(ligne.numero) - 1);
        const realise = (ligne.revue?.realise ?? avant?.realise ?? null) as Revue['realise'];
        return { ...commun, etat: 'ecrite', ligne, revueGardee, realise, nolio: await laSemaineDansNolio(a, o.plan_id, ligne) };
      }
      return { ...commun, etat: 'pas_partie', ceSoir: rangDuJour(jour) === 6, laissee: laisseesAuCoach.has(o.plan_id) };
    }
    if (apercu !== o.plan_id) return { ...commun, etat: 'avant' };
    try {
      return { ...commun, etat: 'avant', apercu: await apercuDuDimanche(o.plan_id) };
    } catch (e) {
      console.error(`Aperçu de ${o.plan_id} :`, e instanceof Error ? e.message : e);
      return { ...commun, etat: 'avant', erreur: 'Nolio ou le moteur ne répond pas pour l’instant : réessaie dans un moment.' };
    }
  }));
}

// LA SEMAINE PARTIE, LUE DANS NOLIO (décision 11 du coach du 09/11/2026) : son envoi (les séances posées par l'app, leur
// révision et l'empreinte de leur contenu), ce que l'app a posé pour lui sur tous ses objectifs (une séance de son autre
// objectif n'est pas une séance ajoutée), ses séances prévues de la semaine d'avant à celle d'après, et, pour une séance
// dont la révision a changé, son contenu (empreinteSeance : une séance seulement déplacée n'a pas changé ; douze lectures
// au plus). null : rien à lire (Nolio pas relié, la semaine sans envoi gardé) ; la carte montre alors la semaine écrite.
const LECTURES_MAX = 12;
async function laSemaineDansNolio(a: FicheAthlete, planId: string, ligne: LigneEcrite): Promise<LectureDeLaSemaine | null> {
  const lundi = ligne.donnees?.lundi;
  if (!lundi || !a.nolio_athlete_id || !nolioConfigure()) return null;
  const service = clientService();
  const { data: envoi } = await service.from('nolio_envois').select('seances').eq('plan_id', planId).eq('semaine', ligne.numero).maybeSingle();
  const envoyees = (envoi?.seances ?? []) as SeanceEnvoyee[];
  if (!envoyees.length) return null;
  const { data: freres } = await service.from('coaching').select('plan_id').eq('athlete_id', a.id);
  const plans = [...new Set([planId, ...(freres ?? []).map((f) => String(f.plan_id))])];
  const { data: envois } = await service.from('nolio_envois').select('seances').in('plan_id', plans);
  const posees = new Set((envois ?? []).flatMap((e) => (e.seances ?? []) as SeanceEnvoyee[])
    .map((s) => String(s.nolio_id ?? '')).filter(Boolean));
  try {
    const d = await destinataire(a.nolio_athlete_id);
    const qui = d.moi ? '' : `athlete=${d.usr}`;
    const nolio = await listeNolio<PrevueNolio>(`planned/trainings/?date_from=${ajouterJours(lundi, -7)}&date_to=${ajouterJours(lundi, 13)}`
      + `&with_revision=true${qui ? `&${qui}` : ''}`);
    const parId = new Map(nolio.map((x) => [String(x.id), x]));
    const empreintes = new Map<string, string | null>();
    for (const s of envoyees) {
      const x = parId.get(String(s.nolio_id ?? ''));
      if (!x || !s.contenu || !s.revision || !x.revision || s.revision === x.revision || empreintes.size >= LECTURES_MAX) continue;
      const r = await appelNolio('GET', `planned/trainings/${x.id}/${qui ? `?${qui}` : ''}`);
      empreintes.set(String(x.id), r.statut === 200 && r.corps ? empreinteSeance(r.corps) : null);
    }
    return { comparee: comparerLaSemaine({ semaine: ligne.donnees, envoyees, nolio, posees, empreintes, sports: SPORTS_COURSE }),
      lue_le: new Date().toISOString() };
  } catch (e) {
    console.error(`Semaine de ${planId} dans Nolio :`, e instanceof Error ? e.message : e);
    return { erreur: 'Nolio ne répond pas pour l’instant : la semaine telle que le moteur l’a écrite.' };
  }
}

// L'heure d'une lecture, « 21 h 02 ».
export function heureDe(iso: string): string {
  const [h, m] = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' })
    .format(new Date(iso)).split(':');
  return `${Number(h)} h ${m}`;
}
// Le jour d'un instant, « dimanche ».
export const jourDeLInstant = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' });

// L'heure du passage, « dimanche à 18 h 05 ».
export function heureDuPassage(iso: string): string {
  const d = new Date(iso);
  const jourDe = d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' });
  const [h, m] = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' })
    .format(d).split(':');
  return `${jourDe} à ${Number(h)} h ${m}`;
}

// La réponse du samedi lue « ancienne » (celle d'une semaine d'avant) : plus de 6 jours avant le jour de sa lecture.
export const reponseAncienne = (du: string | undefined, lue: string) => Boolean(du && du < ajouterJours(lue.slice(0, 10), -6));
