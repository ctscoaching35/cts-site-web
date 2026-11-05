/**
 * LA CONFIRMATION DE CHARGE AVANT UN DÉPART ÉLOIGNÉ (décision coach du 04/11/2026 au soir, « A »). Les questions de charge
 * restent au questionnaire d'achat (le refus sous 45 min de sortie longue tombe avant le paiement, le plan se construit au
 * paiement) ; un achat fait plus de 3 semaines avant son invitation (J-7, lib/app/invitation.ts) les fait confirmer :
 * - de l'invitation à la veille du départ, l'accueil de l'app montre une carte, ses réponses de l'achat déjà affichées
 *   (« Tu nous disais 5 h par semaine et 2 h de sortie longue… C'est toujours vrai ? ») : « Oui », ou il corrige, avec les
 *   contrôles du questionnaire d'achat (le moteur relit les réponses, POST /v1/trame, valider_champs) ;
 * - le samedi d'avant, un e-mail s'il n'a pas répondu ;
 * - le dimanche, sa première semaine s'écrit sur ses réponses : changées, le plan est recalé comme pour un coaché
 *   (lib/app/ecriture.ts, recalerSurLaConfirmation). Sans réponse, rien ne bloque : ses réponses de l'achat servent.
 * - S10 (décision coach du 05/11/2026, « A ») : une correction refusée par le moteur parce que la plus longue sortie est
 *   tombée sous 45 min part du plancher accepté (45 min de sortie longue, le volume corrigé s'il se lit ;
 *   lib/app/invitation.ts, chargeAuPlancher), et le coach reçoit un e-mail avec les deux réponses. Un autre refus (une
 *   saisie illisible) se dit à l'acheteur, qui corrige ; ses réponses de l'achat restent d'ici là.
 * - S9 (05/11/2026) : deux questions, son volume et sa plus longue sortie ; plus l'arrêt récent.
 * Ce n'est pas une porte de plus. Les coachés gardent leur relecture de Nolio au départ. Un acheteur déjà dans l'équipe
 * par un autre plan (OM1) n'est pas réinvité : pas de carte.
 * La réponse vit dans plans.confirmation_charge (migration du 04/11/2026) ; sans elle, rien ne s'affiche ni ne part.
 * Côté serveur seulement.
 */
import { site } from '@/lib/content';
import { API_URL } from '@/lib/plan';
import type { Compte } from './ecriture';
import { envoyerRappelConfirmation } from './emailBienvenue';
import { carteOuverte, chargeAuPlancher, chargeChangee, chargeDe, chargeEnClair, confirmationDemandee, samediDuRappel, type Charge } from './invitation';
import { ajouterJours, dateLongue } from './plan';
import { clientService } from './supabase';
import { enTetesMoteur } from './cleMoteur';

// demandee et plancher (S10) : la correction donnée, et la première semaine partie du plancher à sa place.
export type Confirmation = { le: string; reponse: 'oui' | 'corrige'; charge: Charge; demandee?: Charge; plancher?: boolean };
export type CarteConfirmation = { planId: string; achat: Charge; reponse: Confirmation | null; dimanche: string };

// Un plan acheté qui attend son départ dans Nolio (pas celui d'un athlète en coaching, ni sorti).
const STATUTS = ['a_inviter', 'en_cours', 'invite', 'actif', 'refuse'];
const jourParis = (horodatage: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(horodatage));
const aujourdhuiParis = () => jourParis(new Date().toISOString());

function lue(brut: unknown): Confirmation | null {
  const c = (brut ?? null) as Partial<Confirmation> | null;
  if (!c || (c.reponse !== 'oui' && c.reponse !== 'corrige') || !c.charge) return null;
  return { le: String(c.le ?? ''), reponse: c.reponse, charge: chargeDe(c.charge as Record<string, unknown>),
    ...(c.plancher ? { plancher: true, demandee: chargeDe(c.demandee as Record<string, unknown> | undefined) } : {}) };
}

// La réponse gardée ; colonne : false tant que la migration du 04/11/2026 n'est pas passée.
export async function lireConfirmation(planId: string): Promise<{ colonne: boolean; reponse: Confirmation | null }> {
  const { data, error } = await clientService().from('plans').select('confirmation_charge').eq('id', planId).maybeSingle();
  if (error) return { colonne: false, reponse: null };
  return { colonne: true, reponse: lue((data as { confirmation_charge?: unknown } | null)?.confirmation_charge) };
}

// Un acheteur déjà dans l'équipe par un autre plan (inviterAcheteur : « un acheteur déjà dans l'équipe », OM1).
async function dejaDansLEquipe(compteId: string, planId: string): Promise<boolean> {
  const { data } = await clientService().from('plans').select('id').eq('compte_id', compteId).eq('nolio_statut', 'actif')
    .not('nolio_athlete_id', 'is', null).neq('id', planId).limit(1);
  return Boolean(data?.length);
}

type LignePlan = {
  compte_id: string; cree_le: string; debut_plan: string; parametres: Record<string, unknown> | null; demarre_le: string | null;
  nolio_statut: string | null;
};
const lirePlan = async (planId: string) => (await clientService().from('plans')
  .select('compte_id, cree_le, debut_plan, parametres, demarre_le, nolio_statut').eq('id', planId).maybeSingle()).data as LignePlan | null;

// La carte de l'accueil d'un acheteur : sa préparation pas encore partie, de son invitation à la veille de son départ, un
// achat fait plus de 3 semaines avant l'invitation ; null sinon. jour : aujourd'hui (simulable en développement).
export async function carteDeConfirmation(planId: string, jour: string): Promise<CarteConfirmation | null> {
  const p = await lirePlan(planId);
  if (!p?.parametres || p.demarre_le || !STATUTS.includes(String(p.nolio_statut))) return null;
  if (!carteOuverte(p.debut_plan, jourParis(p.cree_le), jour)) return null;
  const { colonne, reponse } = await lireConfirmation(planId);
  if (!colonne || await dejaDansLEquipe(p.compte_id, planId)) return null;
  return { planId, achat: chargeDe(p.parametres.champs as Record<string, unknown>), reponse,
    dimanche: ajouterJours(String(p.debut_plan).slice(0, 10), -1) };
}

// La confirmation sera-t-elle demandée (l'écran de bienvenue, « Pour bien démarrer ») : un achat fait plus de 3 semaines
// avant son invitation, sa préparation pas encore partie.
export async function confirmationAVenir(planId: string): Promise<boolean> {
  const p = await lirePlan(planId);
  return Boolean(p?.parametres && !p.demarre_le && confirmationDemandee(p.debut_plan, jourParis(p.cree_le)));
}

// La réponse de l'acheteur (l'action vérifie à qui est le plan) : « oui » (charge null), ou sa charge corrigée, relue par
// le moteur avec les contrôles du questionnaire d'achat ; sa phrase de refus revient telle quelle.
export async function enregistrerConfirmation(planId: string, charge: Charge | null): Promise<{ ok: boolean; message: string }> {
  const p = await lirePlan(planId);
  if (!p?.parametres) return { ok: false, message: 'Plan introuvable.' };
  if (p.demarre_le) {
    return { ok: false, message: 'Ta première semaine est déjà écrite dans Nolio, sur tes réponses de l’achat. Pour une correction, réponds à ton e-mail de bienvenue.' };
  }
  const champs = (p.parametres.champs ?? {}) as Record<string, unknown>;
  const achat = chargeDe(champs);
  const dimanche = dateLongue(ajouterJours(String(p.debut_plan).slice(0, 10), -1));
  let reponse: Confirmation = { le: new Date().toISOString(), reponse: 'oui', charge: achat };
  if (charge && chargeChangee(achat, charge)) {
    if (!charge.volume_hebdo_actuel || !charge.sortie_longue_actuelle) {
      return { ok: false, message: 'Donne ton volume de course par semaine et ta plus longue sortie en ce moment.' };
    }
    // Les contrôles du questionnaire d'achat : le moteur relit les réponses (valider_champs, comme au départ) ; « refus » :
    // sa phrase (400), null quand il ne répond pas.
    const verifier = async (c: Charge): Promise<{ ok: true } | { ok: false; refus: string | null }> => {
      const r = await fetch(`${API_URL}/v1/trame`, {
        method: 'POST', headers: enTetesMoteur({ 'Content-Type': 'application/json' }), cache: 'no-store',
        body: JSON.stringify({ parametres: { ...p.parametres, champs: { ...champs, ...c } } }),
      }).catch(() => null);
      if (r?.ok) return { ok: true };
      const refus = r?.status === 400 ? await r.json().then((x) => x?.message as string | undefined).catch(() => undefined) : undefined;
      return { ok: false, refus: refus ?? null };
    };
    const verdict = await verifier(charge);
    if (verdict.ok) reponse = { ...reponse, reponse: 'corrige', charge };
    else if (verdict.refus === null) return { ok: false, message: 'La vérification ne répond pas pour l’instant : réessaie dans un moment.' };
    else {
      // S10 : une plus longue sortie sous le plancher ; la première semaine part du plancher accepté.
      const plancher = chargeAuPlancher(charge, achat);
      const auPlancher = plancher ? await verifier(plancher) : null;
      if (!plancher || !auPlancher?.ok) {
        return { ok: false, message: `${verdict.refus} Ta première semaine partira de tes réponses de l’achat ; pour en parler, réponds à ton e-mail de bienvenue.` };
      }
      reponse = { ...reponse, reponse: 'corrige', charge: plancher, demandee: charge, plancher: true };
    }
  }
  const { error } = await clientService().from('plans').update({ confirmation_charge: reponse }).eq('id', planId);
  if (error) return { ok: false, message: 'Ta réponse n’a pas pu être enregistrée : réessaie dans un moment.' };
  if (reponse.plancher && reponse.demandee) {
    await prevenirDuPlancher(planId, achat, reponse.demandee, reponse.charge, dimanche)
      .catch((e) => console.error(`Confirmation au plancher de ${planId} :`, e instanceof Error ? e.message : e));
    // Validé par le coach le 05/11/2026 au soir (CTS_TEXTES_A_VALIDER.md, L) : l'acheteur n'a pas de coach attitré.
    return { ok: true, message: `C’est noté. Ta plus longue sortie est sous les 45 minutes que demande la préparation : ta `
      + `première semaine s’écrira ${dimanche} au soir en partant d’une sortie longue de 45 min, le minimum de la préparation. Écoute tes `
      + 'sensations ; si tu hésites, réponds à ton e-mail de bienvenue.' };
  }
  return { ok: true, message: reponse.reponse === 'oui'
    ? `C’est noté : ta première semaine s’écrira ${dimanche} au soir sur ces réponses.`
    : `C’est noté : ta première semaine s’écrira ${dimanche} au soir sur tes nouvelles réponses.` };
}

// S10 : le coach reçoit les deux réponses (l'achat et la nouvelle) et ce qui part ; un seul e-mail par réponse enregistrée.
async function prevenirDuPlancher(planId: string, achat: Charge, demandee: Charge, plancher: Charge, dimanche: string) {
  const { data } = await clientService().from('plans').select('course_nom, nom:donnees->athlete->>nom').eq('id', planId).maybeSingle();
  const { prevenirCoach } = await import('./ecriture');
  const nom = String((data as { nom?: string | null } | null)?.nom ?? '').trim();
  await prevenirCoach('Plan CTS : une charge corrigée sous le plancher',
    `${nom || 'L’acheteur'} (plan « ${String(data?.course_nom ?? '')} ») a corrigé sa charge avant son départ. À l’achat : `
    + `${chargeEnClair(achat)}. Maintenant : ${chargeEnClair(demandee)}. Sa plus longue sortie est sous les 45 min que `
    + `demande la préparation : sa première semaine s’écrit ${dimanche} au soir sur le plancher, ${chargeEnClair(plancher)}. `
    + 'À voir avec l’athlète si besoin, en réponse à son e-mail de bienvenue.');
}

// Le rappel du samedi (passage quotidien) : la carte encore sans réponse, son départ ce lundi. Le passage tourne une fois
// par jour : chaque rappel tombe un seul samedi, sans rien garder.
export async function rappelerLesConfirmations(aujourdhui = aujourdhuiParis()): Promise<Compte[]> {
  if (new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() !== 6) return [];
  const service = clientService();
  const { data } = await service.from('plans')
    .select('id, compte_id, cree_le, debut_plan, parametres, nolio_statut, nom:donnees->athlete->>nom')
    .not('parametres', 'is', null).is('demarre_le', null).in('nolio_statut', STATUTS)
    .gt('debut_plan', aujourdhui).lte('debut_plan', ajouterJours(aujourdhui, 7));
  const comptes: Compte[] = [];
  for (const p of data ?? []) {
    if (samediDuRappel(String(p.debut_plan)) !== aujourdhui || !confirmationDemandee(String(p.debut_plan), jourParis(String(p.cree_le)))) continue;
    try {
      const { colonne, reponse } = await lireConfirmation(String(p.id));
      if (!colonne) return comptes;
      if (reponse || await dejaDansLEquipe(String(p.compte_id), String(p.id))) continue;
      const { data: u } = await service.auth.admin.getUserById(String(p.compte_id));
      if (!u?.user?.email) continue;
      const charge = chargeDe(((p.parametres ?? {}) as Record<string, unknown>).champs as Record<string, unknown>);
      await envoyerRappelConfirmation(u.user.email, String(p.nom ?? ''), `${site.url}/app`, charge);
      comptes.push({ plan: String(p.id), quoi: 'confirmation de charge rappelée' });
    } catch (e) {
      comptes.push({ plan: String(p.id), quoi: 'confirmation non rappelée', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}
