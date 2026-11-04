/**
 * LES CORRECTIONS D'UNE SEMAINE AVANT SON ENVOI (EC3, audit de l'app coach du 03/11/2026 ; décision coach du 04/11/2026,
 * « A ») : sur l'aperçu d'une semaine (/app/coach/plan/[id]/apercu), le coach choisit une ou plusieurs corrections et
 * pourquoi ; le choix est gardé (table corrections_semaine) jusqu'au passage du dimanche, qui l'envoie au moteur
 * (POST /v1/semaine, champ « corrections ») puis le marque appliqué ; il s'annule d'un clic avant. Chaque correction se
 * compte avec sa raison dans « Chiffres » : ce que le coach corrige, et pourquoi, sans avoir à retoucher dans Nolio.
 * Côté serveur seulement.
 */
import { CORRECTIONS, RAISONS, type Choix, type Correction, type Raison } from './correctionsTextes';
import { clientService } from './supabase';

// L'interrupteur : le moteur lit « corrections » depuis 8.446 (CONTRAT_API_CTS.md, « Les ajustements » ; vérifié contre
// 8.447 : le champ, ses 400, le journal « COACH » et son « applique ») ; ÉTEINT jusqu'à ce que le coach valide les
// réglages par défaut (sortie longue à 75 %, jamais sous 45 min ; décalage au jour libre le plus proche). Éteint, ni les
// boutons ni l'envoi : l'aperçu et le dimanche marchent comme avant.
export const CORRECTIONS_ACTIVES = false;

export { CORRECTIONS, RAISONS, type Choix, type Correction, type Raison } from './correctionsTextes';

const lire = (l: { corrections?: unknown; raison?: unknown; appliquee_le?: unknown }): Choix => ({
  corrections: ((l.corrections ?? []) as string[]).filter((c): c is Correction => c in CORRECTIONS),
  raison: typeof l.raison === 'string' && l.raison in RAISONS ? (l.raison as Raison) : null, appliquee: Boolean(l.appliquee_le),
});

// Le choix gardé pour la semaine de ce lundi ; null sans choix, ou sans la migration du 04/11/2026.
export async function choixDeLaSemaine(planId: string, lundi: string): Promise<Choix | null> {
  const { data, error } = await clientService().from('corrections_semaine').select('corrections, raison, appliquee_le')
    .eq('plan_id', planId).eq('lundi', lundi).maybeSingle();
  return error || !data ? null : lire(data);
}

// Ce que le passage envoie au moteur : les corrections d'une semaine pas encore appliquées ; [] sinon, ou éteint.
// memeAppliquees : la semaine se réécrit (« Annuler les ajustements ») ; les corrections du coach restent les siennes.
export async function correctionsAEnvoyer(planId: string, lundi: string | null | undefined, memeAppliquees = false): Promise<Correction[]> {
  if (!CORRECTIONS_ACTIVES || !lundi) return [];
  const choix = await choixDeLaSemaine(planId, lundi).catch(() => null);
  return choix && (memeAppliquees || !choix.appliquee) ? choix.corrections : [];
}

// Le journal du moteur dit, pour chaque correction demandée, si elle a changé la semaine (« correction du coach : … »,
// applique) ; seules celles-là se comptent. L'entrée « la marche … se refait », la semaine d'après un « sans qualité »,
// n'est pas une correction de plus.
type EntreeJournal = { regle?: unknown; correction?: unknown; applique?: unknown; effet?: unknown };
export const appliqueesDuJournal = (journal: EntreeJournal[]): Correction[] => journal
  .filter((e) => e.regle === 'COACH' && e.applique !== false && String(e.effet ?? '').startsWith('correction du coach'))
  .map((e) => String(e.correction)).filter((c): c is Correction => c in CORRECTIONS);

export async function marquerAppliquees(planId: string, lundi: string, journal: EntreeJournal[]): Promise<void> {
  await clientService().from('corrections_semaine').update({ appliquee_le: new Date().toISOString(), appliquees: appliqueesDuJournal(journal) })
    .eq('plan_id', planId).eq('lundi', lundi).is('appliquee_le', null);
}

export async function garderLeChoix(coachId: string, planId: string, lundi: string, corrections: Correction[], raison: Raison | null) {
  const { error } = await clientService().from('corrections_semaine').upsert({
    plan_id: planId, lundi, coach_id: coachId, corrections, raison, choisi_le: new Date().toISOString(), appliquee_le: null,
  });
  if (error) throw new Error('Les corrections ne s’enregistrent pas encore (la migration du 04/11/2026 est à passer).');
}

export async function annulerLeChoix(planId: string, lundi: string) {
  await clientService().from('corrections_semaine').delete().eq('plan_id', planId).eq('lundi', lundi).is('appliquee_le', null);
}

// « Chiffres » : les corrections appliquées depuis une date, comptées par correction et par raison ; null sans la
// migration.
export async function correctionsComptees(coachId: string, depuis: string): Promise<{ parCorrection: Record<string, number>;
  parRaison: Record<string, number>; semaines: number } | null> {
  const { data, error } = await clientService().from('corrections_semaine').select('corrections, appliquees, raison')
    .eq('coach_id', coachId).not('appliquee_le', 'is', null).gte('lundi', depuis);
  if (error) return null;
  const parCorrection: Record<string, number> = {};
  const parRaison: Record<string, number> = {};
  for (const l of data ?? []) {
    const c = lire(l);
    // Celles qui ont changé la semaine (le journal du moteur) ; une ligne d'avant la colonne : celles demandées.
    const comptees = Array.isArray(l.appliquees) ? (l.appliquees as string[]).filter((x) => x in CORRECTIONS) : c.corrections;
    for (const x of comptees) parCorrection[x] = (parCorrection[x] ?? 0) + 1;
    const r = c.raison ?? 'sans';
    parRaison[r] = (parRaison[r] ?? 0) + 1;
  }
  return { parCorrection, parRaison, semaines: (data ?? []).length };
}
