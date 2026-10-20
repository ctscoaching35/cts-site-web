/**
 * Nolio, côté serveur seulement (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur) : l'API v2, avec la clé de
 * l'application personnelle du coach (NOLIO_API_KEY, saisie par le coach dans Vercel ; passage en v2 décidé le
 * 13/10/2026). Ses droits : le calendrier prévu (lire, écrire, supprimer), le réalisé, les métriques et la
 * bibliothèque en lecture. Documentation : www.nolio.io/api/v2/docs/.
 */
import { notFound, redirect } from 'next/navigation';
import { clientServeur } from './supabase';

const NOLIO = 'https://www.nolio.io/api/v2';

export const nolioConfigure = () => Boolean(process.env.NOLIO_API_KEY?.trim());
// « Course à pied » et « Trail » dans le catalogue de Nolio (cts_nolio.SPORT_COURSE, SPORT_TRAIL).
export const SPORTS_COURSE = ['spt_kNYHjuEzDJRiYCX', 'spt_YprHS7jgV5vdsz0'];

// Une erreur de Nolio dite au coach : sa phrase est faite pour lui et ne contient jamais la clé. Toute autre erreur
// reste dans les journaux du serveur (elle pourrait la contenir : un en-tête refusé est cité en entier).
export class ErreurNolio extends Error {}

// La forme d'une clé d'application personnelle : « nolio_sk_ » puis des lettres, chiffres, « _ » ou « - ». Vérifiée
// avant tout appel, pour ne jamais envoyer (ni laisser citer) autre chose (13/10/2026 : une variable collée avec un
// autre texte que la clé).
const FORME_CLE = /^nolio_sk_[A-Za-z0-9_-]{20,}$/;
function cle(): string {
  const valeur = process.env.NOLIO_API_KEY?.trim() ?? '';
  if (!FORME_CLE.test(valeur))
    throw new ErreurNolio('La variable NOLIO_API_KEY de Vercel ne contient pas une clé Nolio (elle commence par nolio_sk_) : recolle la clé, puis redéploie.');
  return valeur;
}

// Les coachs : les e-mails de la variable CTS_COACHS (séparés par des virgules), saisie par le coach dans Vercel.
export const coachs = () => (process.env.CTS_COACHS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

// Les pages coach : sans session, la connexion ; connecté sans être coach, une page introuvable.
export async function exigerCoach(): Promise<{ compteId: string; email: string }> {
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/app/connexion');
  const coach = await coachConnecte();
  if (!coach) notFound();
  return coach;
}

// Le coach connecté, ou null : la page coach n'existe pour personne d'autre.
export async function coachConnecte(): Promise<{ compteId: string; email: string } | null> {
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const email = String(data?.claims?.email ?? '').toLowerCase();
  const compteId = data?.claims?.sub;
  return compteId && email && coachs().includes(email) ? { compteId, email } : null;
}

export type ReponseNolio = { statut: number; corps: Record<string, unknown> | null };

// Un appel à l'API v2. Les erreurs ont toutes la même forme : {"error": {"code", "message"}}.
export async function appelNolio(methode: string, chemin: string, corps?: unknown, entetes: Record<string, string> = {}): Promise<ReponseNolio> {
  const reponse = await fetch(`${NOLIO}/${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${cle()}`, 'Accept-Language': 'fr',
      ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }), ...entetes,
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
    cache: 'no-store',
  });
  return { statut: reponse.status, corps: reponse.status === 204 ? null : await reponse.json().catch(() => null) };
}

// Ce que Nolio refuse, dit au coach : les deux refus qui demandent un geste de sa part, sinon le code d'erreur.
export function refusNolio(r: ReponseNolio, quoi: string): string {
  const erreur = (r.corps?.error ?? {}) as { code?: string; athlete_name?: string };
  if (erreur.code === 'team_scope_forbidden')
    return 'Ton équipe Nolio interdit l’écriture par l’API : autorise-la dans les options de l’équipe (API et MCP), puis recommence.';
  if (erreur.code === 'athlete_api_access_denied')
    return `${erreur.athlete_name ?? 'Cet athlète'} a coupé l’accès de l’API à son compte Nolio.`;
  if (r.statut === 401) return 'Nolio refuse la clé de l’API : vérifie NOLIO_API_KEY dans Vercel.';
  if (r.statut === 429) return 'Nolio limite le nombre d’appels pour l’instant : réessaie dans quelques minutes.';
  return `Nolio a refusé ${quoi} (${r.statut}${erreur.code ? ` ${erreur.code}` : ''}).`;
}

// Toutes les pages d'une liste (pagination par curseur : limit, starting_after, has_more).
export async function listeNolio<T extends { id: string }>(chemin: string): Promise<T[]> {
  const tous: T[] = [];
  let apres = '';
  for (let page = 0; page < 50; page += 1) {
    const r = await appelNolio('GET', `${chemin}${chemin.includes('?') ? '&' : '?'}limit=100${apres ? `&starting_after=${apres}` : ''}`);
    if (r.statut !== 200) throw new ErreurNolio(refusNolio(r, 'la lecture'));
    const lot = (r.corps?.data ?? []) as T[];
    tous.push(...lot);
    if (!r.corps?.has_more || !lot.length) break;
    apres = lot[lot.length - 1].id;
  }
  return tous;
}

export type AthleteNolio = { id: string; name: string };

// Le compte du coach (GET me/) : ses propres séances se créent sans destinataire et se lisent sans ?athlete=.
export async function moiNolio(): Promise<AthleteNolio> {
  const r = await appelNolio('GET', 'me/');
  if (r.statut !== 200 || typeof r.corps?.id !== 'string') throw new ErreurNolio(refusNolio(r, 'la lecture de ton compte'));
  return { id: r.corps.id, name: [r.corps.first_name, r.corps.last_name].filter(Boolean).join(' ') || 'Toi' };
}

// Les athlètes que le coach suit dans Nolio (GET me/athletes/), puis lui-même, marqué « (toi) », pour un envoi
// d'essai dans son propre calendrier.
export async function athletesNolio(): Promise<AthleteNolio[]> {
  const athletes = (await listeNolio<AthleteNolio>('me/athletes/')).map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const moi = await moiNolio();
  return [...athletes.filter((a) => a.id !== moi.id), { id: moi.id, name: `${moi.name} (toi)` }];
}

// Les identifiants de la v1 (des nombres) en identifiants v2 (GET migration/ids/, jusqu'au 30/06/2027) :
// { « 1234 »: « usr_… » } ; ceux que Nolio ne retrouve pas manquent.
export async function convertirIdsV1(type: 'user' | 'planned.event', ids: string[], athlete?: string): Promise<Record<string, string>> {
  const nombres = ids.filter((x) => /^\d+$/.test(x));
  if (!nombres.length) return {};
  const params = new URLSearchParams({ type, ids: nombres.slice(0, 100).join(',') });
  if (athlete) params.set('athlete', athlete);
  const r = await appelNolio('GET', `migration/ids/?${params}`);
  if (r.statut !== 200) return {};
  return Object.fromEntries(((r.corps?.data ?? []) as { v1_id: number; id: string }[]).map((x) => [String(x.v1_id), x.id]));
}
