/**
 * « SA SEMAINE QUI ARRIVE » SUR LA PAGE DE L'ATHLÈTE (l'espace par athlète, Q4 « A », maquette validée par le coach le
 * 08/11/2026) : l'aperçu du dimanche entré dans sa page.
 * - Après le passage du dimanche (et le lundi, comme le bilan du dimanche, Q10) : la semaine écrite, ce que le moteur
 *   change, « Annuler les ajustements », la note « Ta semaine », et son « pourquoi » et ce qu'il a lu, gardés au passage
 *   (semaines_ecrites.revue ; sans la migration du 08/11/2026, rien de gardé, la page le dit). Pas encore partie : le
 *   dimanche soir, ses reprises ; le lundi, « Réessayer ».
 * - Avant le passage : ce que la couleur de « Dimanche » prévoit, et « Voir ce que le moteur écrirait », qui calcule
 *   l'aperçu dans la page (ecriture.apercuDuDimanche, le chemin du passage du dimanche : ils changent ensemble), jamais
 *   à l'ouverture de la page sans le demander.
 * Côté serveur seulement.
 */
import { apercuDuDimanche, type Apercu, type Revue } from './ecriture';
import { nomsDesSeances } from './journalEnClair';
import { ajouterJours, type Semaine } from './plan';
import { apresLePassage, lundiQuiVient, type SemaineDuDimanche } from './semainesDuDimanche';
import { clientService } from './supabase';

export type LigneEcrite = {
  numero: string; donnees: Semaine; journal: Record<string, unknown>[]; bilan: string | null; notes: { regle?: string; texte: string }[];
  sans_ajustement: boolean; ecrite_le: string; realise: unknown; revue?: Revue | null;
};
type Commun = { planId: string; course: string; fond: boolean };
export type SemaineQuiArrive =
  // revueGardee : la colonne existe (la migration du 08/11/2026 est passée) ; derniere : la dernière semaine écrite de
  // l'objectif (« Annuler les ajustements » ne s'offre que là) ; realise : la semaine écoulée qu'il a jugée.
  | (Commun & { etat: 'ecrite'; ligne: LigneEcrite; revueGardee: boolean; derniere: boolean; realise: Revue['realise'];
    nomDe: (id: string) => string | undefined })
  // ceSoir : le dimanche, ses reprises de 20 h et 22 h ; sinon le lundi, « Réessayer ». laissee : tes séances déjà posées.
  | (Commun & { etat: 'pas_partie'; ceSoir: boolean; laissee: boolean })
  // apercu : calculé à la demande (« Voir ce que le moteur écrirait ») ; erreur : Nolio ou le moteur n'a pas répondu.
  | (Commun & { etat: 'avant'; apercu?: Apercu; erreur?: string; nomDe?: (id: string) => string | undefined });

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
  return Promise.all(ecrites.map(async ({ o, plan }): Promise<SemaineQuiArrive> => {
    const fond = Boolean((plan.parametres as { fond?: unknown } | null)?.fond);
    const commun: Commun = { planId: o.plan_id, course: o.course_date, fond };
    const { lignes, revueGardee } = await lignesEcrites(o.plan_id);
    const nomDe = nomsDesSeances(lignes.map((l) => l.donnees));
    if (lundi) {
      const ligne = lignes.find((l) => l.donnees?.lundi === lundi);
      if (ligne) {
        const derniere = Math.max(...lignes.map((l) => numeroDe(l.numero)).filter(Number.isFinite)) === numeroDe(ligne.numero);
        const avant = lignes.find((l) => numeroDe(l.numero) === numeroDe(ligne.numero) - 1);
        const realise = (ligne.revue?.realise ?? avant?.realise ?? null) as Revue['realise'];
        return { ...commun, etat: 'ecrite', ligne, revueGardee, derniere, realise, nomDe };
      }
      return { ...commun, etat: 'pas_partie', ceSoir: rangDuJour(jour) === 6, laissee: laisseesAuCoach.has(o.plan_id) };
    }
    if (apercu !== o.plan_id) return { ...commun, etat: 'avant' };
    try {
      return { ...commun, etat: 'avant', apercu: await apercuDuDimanche(o.plan_id), nomDe };
    } catch (e) {
      console.error(`Aperçu de ${o.plan_id} :`, e instanceof Error ? e.message : e);
      return { ...commun, etat: 'avant', erreur: 'Nolio ou le moteur ne répond pas pour l’instant : réessaie dans un moment.' };
    }
  }));
}

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
