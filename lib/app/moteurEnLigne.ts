/**
 * LA GARDE DE VERSION (décisions du coach du 24/11/2026, entrée 191, « les six routes retirées par la v1 sont validées ») : le moteur v1
 * (9.x) ne rend plus `/v1/fatigue`, `/v1/veto`, `/v1/realise`, `/v1/course-secondaire` (404) ; tant que le moteur en ligne est une 8.x,
 * ces appels restent ceux d'aujourd'hui. Le site lit la version sur `GET /v1/config` (publique) et ne rappelle une route retirée que si
 * le moteur n'est PAS une 9.x : sans réponse lisible, il reste sur ce qui tourne (une 8.x). Retenue 5 minutes par processus : un
 * passage planifié qui boucle sur les plans ne la relit pas à chaque plan.
 *
 * Retirés encore à remplacer par la chaîne de `POST /v1/semaine` (corps, réponse et `etat` d'une 9.0) : `/v1/recuperation` (une
 * semaine `type: "recuperation"`) et `/v1/semaine/lundi` (une réponse avant la première séance réécrit la semaine, après une séance
 * faite : `POST /v1/reponse-tardive`) ; ils ne se gardent pas d'un appel à l'autre.
 */
import { API_URL } from '@/lib/plan';
import { enTetesMoteur } from './cleMoteur';
import { estAuMoins91, estMoteurV9 } from './versionDuMoteur';

const VALIDITE_MS = 5 * 60_000;
let gardee: { le: number; v9: boolean; v91: boolean } | null = null;

async function lireLaVersion(): Promise<unknown> {
  // Un délai : le menu de l'espace coach lit la version à chaque page (décision 220) ; un moteur muet ne doit pas la bloquer. Sans réponse à temps : la dernière lecture, sinon une 8.x (ci-dessous).
  const r = await fetch(`${API_URL}/v1/config`, { cache: 'no-store', headers: enTetesMoteur(), signal: AbortSignal.timeout(5_000) });
  return r.ok ? ((await r.json().catch(() => null)) as { version_moteur?: unknown } | null)?.version_moteur : null;
}

// Le moteur en ligne est-il une 9.x ? `lire` et `maintenant` : pour les essais.
export async function moteurEstV9(lire: () => Promise<unknown> = lireLaVersion, maintenant = Date.now()): Promise<boolean> {
  if (gardee && maintenant - gardee.le < VALIDITE_MS) return gardee.v9;
  let version: unknown;
  try {
    version = await lire();
  } catch {
    version = null;
  }
  // Sans version lisible (réseau, réponse sans `version_moteur`) : la dernière lecture, sinon une 8.x ; rien n'est retenu.
  if (typeof version !== 'string' || !version.trim()) return gardee?.v9 ?? false;
  const v9 = estMoteurV9(version);
  gardee = { le: maintenant, v9, v91: estAuMoins91(version) };
  return v9;
}

// Le moteur en ligne est-il la 9.1 ou après ? La même lecture, gardée avec elle ; sans version lue : non.
export async function moteurAuMoins91(lire: () => Promise<unknown> = lireLaVersion, maintenant = Date.now()): Promise<boolean> {
  await moteurEstV9(lire, maintenant);
  return gardee?.v91 ?? false;
}

export const oublierLaVersionDuMoteur = () => { gardee = null; };
