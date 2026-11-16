/**
 * L'APERÇU DU PLAN AVANT PAIEMENT (décision du coach du 16/11/2026, « A » ; contrat de POST /v1/apercu, moteur 8.470) :
 * le questionnaire, puis l'aperçu (les blocs et la semaine 1), puis le paiement. Ici, le pur : sans réseau, sans base,
 * sans navigateur, pour que la route, l'écran et les tests partagent les mêmes règles.
 * Seulement le parcours d'un achat : jamais le coach, jamais la demande d'un coaché, jamais la simulation (X-CTS-Coach).
 */
import type { Semaine } from '@/lib/app/plan';

export const LIMITE_APERCUS = 10;
export const FENETRE_LIMITE_MS = 60 * 60 * 1000;
export const DELAI_MOTEUR_MS = 15_000;
export const CLE_CACHE_APERCU = 'cts-plan-apercu';

export const MESSAGE_APERCU_INDISPONIBLE = 'L’aperçu n’est pas disponible pour l’instant.';
// TEXTES NOUVEAUX, à valider par le coach (CTS_TEXTES_A_VALIDER.md).
export const MESSAGE_APERCU_LIMITE = 'Tu as demandé beaucoup d’aperçus en peu de temps : réessaie dans une heure. Tu peux aussi payer sans attendre, ton plan sera le même.';
export const PHRASE_TRACE_IGNOREE = 'Ta trace GPX n’a pas pu être lue : cet aperçu repose sur le D+ et le D− que tu as déclarés.';
export const PHRASE_AUTRE_JOUR = 'Ton aperçu a été recalculé aujourd’hui : relis-le, puis clique de nouveau pour payer.';

export type BlocApercu = { bloc: string; du: string; au: string; semaines: number; but: string };
export type Apercu = {
  calcule_le: string;
  version_moteur?: string;
  resume: { course: string; date_course: string; date_debut_plan: string; duree_mois: number; prix_eur: number; trace_ignoree: boolean };
  blocs: BlocApercu[];
  trame?: unknown;
  semaine_1: { semaine: Semaine; notes: { regle?: string; texte: string }[] };
};

/** Les clés de l'intake qui identifient l'acheteur : l'aperçu n'en a pas besoin, le moteur ne les reçoit pas. */
const CLES_IDENTITE = ['email', 'nom', 'prenom', 'nolio_email'];
export function retirerIdentite(intake: Record<string, unknown>): Record<string, unknown> {
  const sortie = { ...intake };
  for (const cle of CLES_IDENTITE) delete sortie[cle];
  return sortie;
}

/** Le jour, à l'heure de Paris, en AAAA-MM-JJ. */
export function jourParis(instant: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
  return p; // fr-CA rend déjà AAAA-MM-JJ
}

/** « 16 décembre 2026 », « 1er février 2027 » : une date AAAA-MM-JJ en toutes lettres. */
export function dateEnLettres(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(/^1 /, '1er ');
}

/** Une empreinte de texte (cyrb53, 53 bits) : la clé du cache de session, rien de secret. */
export function empreinteTexte(texte: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** L'empreinte des réponses (sans l'identité) et de la trace (nom, taille, date), pour savoir si l'aperçu gardé vaut encore. */
export function empreinteApercu(intake: Record<string, unknown>, trace: { name: string; size: number; lastModified: number } | null): string {
  const reponses = retirerIdentite(intake);
  const tri = Object.keys(reponses).sort().map((k) => [k, reponses[k]]);
  return empreinteTexte(JSON.stringify([tri, trace ? [trace.name, trace.size, trace.lastModified] : null]));
}

export type ApercuGarde = { empreinte: string; calcule_le: string; apercu: Apercu };

/** L'aperçu gardé en session, s'il porte les mêmes réponses et a été calculé le jour même (heure de Paris). */
export function apercuGardeValide(garde: ApercuGarde | null | undefined, empreinte: string, aujourdhui: string): Apercu | null {
  if (!garde || garde.empreinte !== empreinte || garde.calcule_le !== aujourdhui || garde.apercu?.calcule_le !== aujourdhui) return null;
  return garde.apercu;
}

export type ResultatApercu =
  | { type: 'ok'; apercu: Apercu }
  | { type: 'absent' } // 404 : le moteur n'est pas encore en 8.470, ou la porte est fermée : le parcours reste celui d'avant
  | { type: 'refus'; message: string; raison?: string } // 422 : les mêmes messages que /v1/verification
  | { type: 'indisponible'; message: string };

/** Ce que le questionnaire fait de la réponse de la route (contrat du 16/11/2026, « Les erreurs »). */
export function classerReponse(statut: number, corps: unknown, messageCourseTropProche: string): ResultatApercu {
  const c = (corps && typeof corps === 'object' ? corps : {}) as Record<string, unknown>;
  if (statut === 404) return { type: 'absent' };
  if (statut === 429) return { type: 'indisponible', message: typeof c.message === 'string' && c.message ? c.message : MESSAGE_APERCU_LIMITE };
  if (statut === 422) {
    return {
      type: 'refus', raison: typeof c.raison === 'string' ? c.raison : undefined,
      message: c.raison === 'course_trop_proche' ? messageCourseTropProche
        : typeof c.message === 'string' && c.message ? c.message : 'Une erreur est survenue. Réessaie dans quelques minutes.',
    };
  }
  const a = c as Partial<Apercu>;
  if (statut === 200 && a.calcule_le && a.resume && Array.isArray(a.blocs) && a.semaine_1?.semaine) return { type: 'ok', apercu: a as Apercu };
  return { type: 'indisponible', message: MESSAGE_APERCU_INDISPONIBLE };
}

/** Le parcours d'un achat seulement : ni le coach, ni la demande d'un coaché, ni l'objectif modifié. */
export const apercuPourCeParcours = (p: { coach: boolean; demande: boolean; modification: boolean }) =>
  !p.coach && !p.demande && !p.modification;
