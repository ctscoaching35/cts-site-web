/**
 * Nolio, côté serveur seulement (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur) : la page coach relie le
 * compte Nolio du coach (OAuth2, code d'autorisation) et appelle l'API en son nom. Les clés vivent dans
 * Vercel, saisies par le coach : NOLIO_CLIENT_ID, NOLIO_CLIENT_SECRET. Les jetons restent dans la table
 * nolio_comptes, que seule la clé de service lit. Documentation : github.com/NolioApp/NolioAPI-Documentation.
 */
import { notFound, redirect } from 'next/navigation';
import { clientServeur, clientService } from './supabase';

const NOLIO = 'https://www.nolio.io';
export const COOKIE_ETAT_NOLIO = 'cts_nolio_etat';

export const nolioConfigure = () => Boolean(process.env.NOLIO_CLIENT_ID && process.env.NOLIO_CLIENT_SECRET);

// L'adresse de retour déclarée par le coach sur le portail API de Nolio, à l'identique.
export const adresseRetour = (origine: string) => `${origine}/app/coach/nolio/retour`;

export const urlAutorisation = (origine: string, etat: string) =>
  `${NOLIO}/api/authorize/?${new URLSearchParams({
    response_type: 'code', client_id: process.env.NOLIO_CLIENT_ID ?? '', redirect_uri: adresseRetour(origine), state: etat,
  })}`;

// Les coachs : les e-mails de la variable CTS_COACHS (séparés par des virgules), saisie par le coach dans Vercel.
const coachs = () => (process.env.CTS_COACHS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

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

type Jetons = { access_token: string; refresh_token: string; expires_in: number };

// /api/token/ : le code ou le jeton de renouvellement, l'application authentifiée en Basic.
async function demanderJetons(parametres: Record<string, string>): Promise<Jetons> {
  const identite = Buffer.from(`${process.env.NOLIO_CLIENT_ID}:${process.env.NOLIO_CLIENT_SECRET}`).toString('base64');
  const reponse = await fetch(`${NOLIO}/api/token/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${identite}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parametres),
    cache: 'no-store',
  });
  if (!reponse.ok) throw new Error(`Nolio /api/token/ : ${reponse.status}`);
  return reponse.json();
}

async function garderJetons(compteId: string, j: Jetons) {
  const { error } = await clientService().from('nolio_comptes').upsert({
    compte_id: compteId, jeton_acces: j.access_token, jeton_renouvellement: j.refresh_token,
    expire_le: new Date(Date.now() + j.expires_in * 1000).toISOString(),
  });
  if (error) throw new Error(`nolio_comptes : ${error.message}`);
}

export async function relier(compteId: string, code: string, origine: string) {
  await garderJetons(compteId, await demanderJetons({ grant_type: 'authorization_code', code, redirect_uri: adresseRetour(origine) }));
}

export async function estRelie(compteId: string) {
  const { data } = await clientService().from('nolio_comptes').select('compte_id').eq('compte_id', compteId).maybeSingle();
  return Boolean(data);
}

// Un appel à l'API au nom du coach : le jeton se renouvelle seul (il vit 24 h).
export async function appelNolio(compteId: string, chemin: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await clientService().from('nolio_comptes').select('*').eq('compte_id', compteId).maybeSingle();
  if (!data) throw new Error('Compte Nolio non relié');
  let acces: string = data.jeton_acces;
  const renouveler = async () => {
    const j = await demanderJetons({ grant_type: 'refresh_token', refresh_token: data.jeton_renouvellement });
    await garderJetons(compteId, j);
    acces = j.access_token;
  };
  if (new Date(data.expire_le).getTime() < Date.now() + 60_000) await renouveler();
  const appeler = () => fetch(`${NOLIO}/api${chemin}`, {
    ...init, cache: 'no-store', headers: { ...(init.headers ?? {}), Authorization: `Bearer ${acces}` },
  });
  let reponse = await appeler();
  if (reponse.status === 401) {
    await renouveler();
    reponse = await appeler();
  }
  return reponse;
}

export type AthleteNolio = { nolio_id: number; name: string };

// Les athlètes que le coach suit dans Nolio (/api/get/athletes/), et le coach lui-même, que Nolio ajoute en
// dernier (wants_coach) : marqué « (toi) », pour un premier envoi d'essai dans son propre calendrier.
export async function athletesNolio(compteId: string): Promise<AthleteNolio[]> {
  const reponse = await appelNolio(compteId, '/get/athletes/?wants_coach=true');
  if (!reponse.ok) throw new Error(`Nolio /get/athletes/ : ${reponse.status}`);
  const liste = (await reponse.json()) as AthleteNolio[];
  const lui = liste[liste.length - 1];
  const athletes = liste.slice(0, -1).map(({ nolio_id, name }) => ({ nolio_id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return lui ? [...athletes, { nolio_id: lui.nolio_id, name: `${lui.name} (toi)` }] : athletes;
}
