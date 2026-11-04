/**
 * L'INVITATION D'UN ACHETEUR DANS L'ÉQUIPE NOLIO ET LA CONFIRMATION DE SA CHARGE (décisions coach du 04/11/2026 au soir,
 * à la place de « la veille du premier lundi » décidée le matin, PL4). Des fonctions pures, sur des jours « AAAA-MM-JJ »
 * (Paris), lues par le passage quotidien (lib/app/ecriture.ts), l'e-mail de bienvenue, l'écran de bienvenue, l'accueil
 * et « Pour bien démarrer » : tous disent le même jour.
 * - L'invitation part le lundi de la semaine qui précède le départ (J-7) ; un départ dans les 7 jours qui suivent l'achat
 *   (ou déjà passé : un plan rejoint en cours) l'envoie tout de suite. Les relances comptent à partir de ce jour.
 * - Un achat qui date de plus de 3 semaines au moment de l'invitation : l'app CTS demande à l'acheteur si sa charge a
 *   changé (son volume, sa plus longue sortie, un arrêt récent), de l'invitation à la veille du départ ; un rappel part le
 *   samedi d'avant s'il n'a pas répondu (lib/app/confirmation.ts). Sans réponse, rien ne bloque.
 */
import { lireTemps } from '@/lib/plan';
import { ajouterJours, joursEntre } from './plan';

export const JOURS_AVANT_DEPART = 7;
export const JOURS_AVANT_CONFIRMATION = 21;

// Le lundi de la semaine d'un jour.
const lundiDe = (jour: string) => ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));

// Le jour de l'invitation : le lundi de la semaine qui précède le départ, ou le jour de l'achat s'il est plus tard.
export function jourDInvitation(debutPlan: string | null | undefined, jourAchat: string): string {
  const depart = debutPlan ? String(debutPlan).slice(0, 10) : null;
  const j7 = depart ? ajouterJours(lundiDe(depart), -JOURS_AVANT_DEPART) : null;
  return j7 && j7 > jourAchat ? j7 : jourAchat;
}

// Une invitation encore à venir, vue d'aujourd'hui (l'achat est passé) : son jour ; null si elle part aujourd'hui ou est
// déjà partie.
export function invitationAVenir(debutPlan: string | null | undefined, aujourdhui: string): string | null {
  const jour = jourDInvitation(debutPlan, aujourdhui);
  return jour > aujourdhui ? jour : null;
}

// La confirmation est demandée quand l'achat date de plus de 3 semaines le jour de l'invitation.
export function confirmationDemandee(debutPlan: string | null | undefined, jourAchat: string): boolean {
  if (!debutPlan) return false;
  return joursEntre(jourAchat, jourDInvitation(debutPlan, jourAchat)) > JOURS_AVANT_CONFIRMATION;
}

// La carte de confirmation, de l'invitation à la veille du départ (le dimanche soir, la première semaine s'écrit).
export function carteOuverte(debutPlan: string | null | undefined, jourAchat: string, aujourdhui: string): boolean {
  if (!debutPlan || !confirmationDemandee(debutPlan, jourAchat)) return false;
  return aujourdhui >= jourDInvitation(debutPlan, jourAchat) && aujourdhui < String(debutPlan).slice(0, 10);
}

// Le samedi du rappel : celui qui précède le lundi du départ.
export const samediDuRappel = (debutPlan: string) => ajouterJours(lundiDe(String(debutPlan).slice(0, 10)), -2);

// ─── Les réponses sur la charge ───────────────────────────────────────────

// Les questions du questionnaire d'achat sur la charge (lib/plan.ts, textes.charge) : celles que l'acheteur confirme.
export const CHAMPS_CHARGE = ['volume_hebdo_actuel', 'sortie_longue_actuelle', 'coupure'] as const;
export type Charge = Record<(typeof CHAMPS_CHARGE)[number], string>;

export function chargeDe(champs: Record<string, unknown> | null | undefined): Charge {
  const c = champs ?? {};
  return {
    volume_hebdo_actuel: String(c.volume_hebdo_actuel ?? '').trim(),
    sortie_longue_actuelle: String(c.sortie_longue_actuelle ?? '').trim(),
    coupure: String(c.coupure ?? '').trim() === 'oui' ? 'oui' : 'non',
  };
}

// Deux réponses qui disent la même chose (« 5h » et « 5h00 », « 90min » et « 1h30 ») ne changent rien.
const memeDuree = (a: string, b: string) => {
  const x = lireTemps(a);
  const y = lireTemps(b);
  return x !== null && y !== null ? Math.abs(x - y) < 1 / 120 : a.trim() === b.trim();
};
export function chargeChangee(avant: Charge, apres: Charge): boolean {
  return !memeDuree(avant.volume_hebdo_actuel, apres.volume_hebdo_actuel)
    || !memeDuree(avant.sortie_longue_actuelle, apres.sortie_longue_actuelle)
    || avant.coupure !== apres.coupure;
}

// « 5 h », « 4 h 30 », « 50 min » ; la saisie telle quelle si elle ne se lit pas.
export function dureeEnClair(brut: string): string {
  const h = lireTemps(brut);
  if (h === null || !(h > 0)) return brut;
  const m = Math.round(h * 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`;
}

// « 5 h par semaine et 2 h de sortie longue, sans arrêt de plus de 4 semaines ces 2 derniers mois ».
export function chargeEnClair(c: Charge): string {
  const arret = c.coupure === 'oui' ? 'après un arrêt de plus de 4 semaines ces 2 derniers mois'
    : 'sans arrêt de plus de 4 semaines ces 2 derniers mois';
  return `${dureeEnClair(c.volume_hebdo_actuel)} par semaine et ${dureeEnClair(c.sortie_longue_actuelle)} de sortie longue, ${arret}`;
}
