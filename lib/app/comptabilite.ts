/**
 * « CHIFFRES », LA COMPTABILITÉ DES PLANS (l'espace par athlète, maquette validée par le coach le 08/11/2026, Q11 à Q13,
 * première étape) : ce que le site connaît déjà de ses ventes — la table achats (le montant réellement payé, code promo
 * déduit, et l'heure du rangement, à quelques secondes de celle de Stripe) et le plan rangé avec chaque achat (sa
 * formule, son acheteur, son statut dans Nolio, arrêtée et remboursée ou non). Ni les frais Stripe ni les remboursements :
 * le site ne les connaît pas (aucune clé Stripe aujourd'hui ; les coachings se brancheront sur Stripe, lib/app/stripeLecture.ts).
 * Le calcul seul, testé (scripts/test-comptabilite.mjs) ; la lecture est dans lib/app/acheteurs.ts (ventesDesPlans).
 */

// Une vente de plan : son achat et le plan rangé avec lui (null tant qu'il n'est pas rangé).
export type Vente = {
  id: string; payeLe: string; centimes: number; nom: string | null; course: string | null; formule: number | null;
  statut: string | null; arretee: boolean;
};
export type Mois = { mois: string; ventes: number; centimes: number };

// Le mois d'un instant, à Paris (« 2026-11 ») : une vente du 1er à 0 h 30 est de ce mois-là, pas du précédent.
export const moisDe = (instant: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(new Date(instant)).slice(0, 7);
export const moisPrecedent = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};

// Les ventes d'un mois, ou d'une année (« 2026 »).
export const ventesDe = (ventes: Vente[], periode: string) => ventes.filter((v) => moisDe(v.payeLe).startsWith(periode));
export const total = (ventes: Vente[]): { ventes: number; centimes: number } =>
  ({ ventes: ventes.length, centimes: ventes.reduce((t, v) => t + v.centimes, 0) });

// Le tableau « Par mois » : du mois en cours jusqu'au plus ancien mois vendu de l'année, trois mois au moins, douze au
// plus ; un mois sans vente a sa ligne (0 €).
export function parMois(ventes: Vente[], moisEnCours: string): Mois[] {
  const annee = moisEnCours.slice(0, 4);
  const plusAncien = ventes.map((v) => moisDe(v.payeLe)).filter((m) => m.startsWith(annee) && m <= moisEnCours).sort()[0];
  const lignes: Mois[] = [];
  for (let m = moisEnCours, i = 0; i < 12; m = moisPrecedent(m), i += 1) {
    if (i >= 3 && (!plusAncien || m < plusAncien)) break;
    lignes.push({ mois: m, ...total(ventesDe(ventes, m)) });
  }
  return lignes;
}

// « 49 € », « 1 234,50 € ».
export const euros = (centimes: number) =>
  `${(centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: centimes % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
// « Novembre 2026 », « Octobre ».
export const nomDuMois = (mois: string, avecAnnee = true) => {
  const t = new Date(`${mois}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', ...(avecAnnee ? { year: 'numeric' } : {}), timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// La période choisie (?periode=) : un mois « AAAA-MM » de l'année, ou l'année entière ; le mois en cours sinon.
export const periodeDe = (demande: string | undefined, moisEnCours: string) =>
  demande === 'annee' ? moisEnCours.slice(0, 4) : demande && /^\d{4}-\d{2}$/.test(demande) && demande <= moisEnCours ? demande : moisEnCours;
