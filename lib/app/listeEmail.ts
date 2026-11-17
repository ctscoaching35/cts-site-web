/**
 * LA LISTE E-MAIL DE L'APP GRATUITE (lot A2, décision du coach du 16/11/2026 : inscription simple, sans double
 * confirmation : le code par e-mail prouve déjà l'adresse). Les contacts de la liste Brevo, avec quatre attributs qui
 * servent à segmenter les envois : EXPERIENCE, STYLE, TYPE_COURSE, DATE_COURSE (à créer dans Brevo, voir le rapport du lot).
 *
 * Variables d'environnement (côté serveur, chez Vercel) : BREVO_API_KEY (déjà là) et BREVO_LISTE_APP, le numéro de la
 * liste, que le coach crée dans Brevo. Sans l'une ou l'autre, RIEN ne part (un console.warn, comme emailBienvenue.ts).
 * Une clé n'est jamais affichée, journalisée ni écrite : les journaux ne disent que le statut HTTP.
 * Un échec de Brevo ne bloque jamais la connexion ni le profil : il est journalisé et réessayé au prochain changement.
 * Le lien de désinscription des campagnes est géré par Brevo : pas de webhook dans ce lot.
 * Côté serveur seulement.
 */
import { profilCoureur } from './zones';

const BREVO = 'https://api.brevo.com/v3';

// Le numéro de la liste : un entier strictement positif, sinon rien.
export function numeroDeLaListe(brut: string | undefined = process.env.BREVO_LISTE_APP): number | null {
  const t = (brut ?? '').trim();
  return /^\d{1,9}$/.test(t) && Number(t) > 0 ? Number(t) : null;
}

// Les trois types de course de l'app : roulante (moins de 20 m D+ par km), vallonnée (20 à 40), montagne (plus de 40).
export type TypeCourse = 'roulante' | 'vallonnee' | 'montagne';
export function typeDeCourse(distanceKm: number | null | undefined, dplusM: number | null | undefined): TypeCourse | null {
  if (!distanceKm || distanceKm <= 0 || dplusM === null || dplusM === undefined || dplusM < 0) return null;
  const densite = dplusM / distanceKm;
  return densite < 20 ? 'roulante' : densite <= 40 ? 'vallonnee' : 'montagne';
}

export type EntreeAttributs = {
  vc_ms: number | null; d_prime_m: number | null;
  prochaineCourse: { date: string | null; distance_km: number | null; dplus_m: number | null } | null;
};
// Les attributs que l'app connaît : ceux qu'elle ne connaît pas ne sont pas envoyés (Brevo garde ce qu'il avait).
export function attributsListe(e: EntreeAttributs): Record<string, string> {
  const a: Record<string, string> = {};
  const style = profilCoureur({ vc_ms: e.vc_ms, d_prime_m: e.d_prime_m });
  if (style) a.STYLE = style.coefficient < 0.9 ? 'rapide' : 'endurant';
  const c = e.prochaineCourse;
  if (c) {
    const type = typeDeCourse(c.distance_km, c.dplus_m);
    if (type) a.TYPE_COURSE = type;
    if (c.date && /^\d{4}-\d{2}-\d{2}$/.test(c.date)) a.DATE_COURSE = c.date;
  }
  return a;
}

// Un appel à Brevo : jamais d'exception, jamais de clé dans un message. true : Brevo a répondu par un succès.
async function appeler(methode: string, chemin: string, corps?: unknown): Promise<boolean> {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) {
    console.warn('Liste e-mail : rien envoyé à Brevo (BREVO_API_KEY absente).');
    return false;
  }
  try {
    const r = await fetch(`${BREVO}/${chemin}`, {
      method: methode,
      headers: { 'api-key': cle, Accept: 'application/json', ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      cache: 'no-store',
    });
    // Un contact déjà absent (404) à retirer ou à supprimer n'est pas un échec.
    if (r.ok || (r.status === 404 && chemin !== 'contacts')) return true;
    console.error(`Liste e-mail : Brevo a répondu ${r.status}.`);
    return false;
  } catch (e) {
    console.error('Liste e-mail : Brevo ne répond pas :', e instanceof Error ? e.name : 'erreur');
    return false;
  }
}

// La liste est-elle branchée ? (la clé et le numéro de la liste)
export const listeBranchee = () => Boolean(process.env.BREVO_API_KEY?.trim()) && numeroDeLaListe() !== null;

function liste(): number | null {
  const id = numeroDeLaListe();
  if (id === null) console.warn('Liste e-mail : rien envoyé à Brevo (BREVO_LISTE_APP absente ou illisible).');
  return id;
}

// Inscrire (ou mettre à jour les attributs d'un contact déjà inscrit) ; l'adresse est celle du compte, prouvée par le code.
export async function inscrireAListe(email: string, attributs: Record<string, string>): Promise<boolean> {
  const id = liste();
  const adresse = email.trim().toLowerCase();
  if (id === null || !adresse) return false;
  return appeler('POST', 'contacts', { email: adresse, listIds: [id], updateEnabled: true, ...(Object.keys(attributs).length ? { attributes: attributs } : {}) });
}

// Retirer de la liste (le contact reste chez Brevo, sans la liste).
export async function retirerDeLaListe(email: string): Promise<boolean> {
  const id = liste();
  const adresse = email.trim().toLowerCase();
  if (id === null || !adresse) return false;
  return appeler('POST', `contacts/lists/${id}/contacts/remove`, { emails: [adresse] });
}

// Supprimer le contact chez Brevo (l'effacement du compte). Sans la clé, rien ; sans numéro de liste, la suppression se fait quand même
// (elle n'en a pas besoin).
export async function supprimerDuCarnet(email: string): Promise<boolean> {
  const adresse = email.trim().toLowerCase();
  if (!adresse) return false;
  return appeler('DELETE', `contacts/${encodeURIComponent(adresse)}?identifierType=email_id`);
}
