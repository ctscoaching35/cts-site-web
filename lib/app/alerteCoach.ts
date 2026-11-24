// Aucun réseau dans les fonctions pures ; la lecture de la route est donnée en port (scripts/test-preparer-coaches-v1.mjs). Côté serveur pour `lirePrerequisDuMoteur`.
/**
 * L'ALERTE DU COACH, SOUS LA 9.x (entrée 234 du coach, 25/11/2026 ; texte de la section 5 de « Lot de textes à valider — moteur, 25-11 », validé « Tout A » ; CONTRAT_API_CTS.md, `POST /v1/prerequis`) :
 * pour un objectif de coaché, le moteur projette le plan entier avec ses réponses et rend `prerequis` ; son `alerte_coach` = `{ active, raisons }` (`raisons` : « sl » et/ou « seances »).
 * Le site n'invente rien : quand l'alerte est active, il dit au coach, dans « À faire pour lui », les phrases validées, avec les nombres que le moteur rend :
 *   - « sl » : « Pour cet objectif, il lui faudrait une sortie longue de {X} au départ : il court aujourd'hui {Y}. » (X = `sl_depart_min_min_5`, la plus petite sortie longue de départ qui tient, arrondie à 5 min au-dessus ;
 *     Y = `sl_depart_min`, celle qu'il court) ;
 *   - « seances » : « Pour cet objectif, il lui faudrait {N} séances par semaine : il en a déclaré {M}. » (N = `seances_min`, M = `seances_declarees`).
 * Une alerte à qui il manque un nombre n'écrit pas sa phrase (rien d'inventé) ; une saison de fond sans date (`applicable: false`), une route qui ne répond pas, un corps qui n'est pas celui du contrat : pas d'alerte.
 * L'alerte ne se pose que pour un objectif qui n'a pas démarré (c'est « au départ »), et seulement sur la page de l'athlète : « Mes athlètes » ne la montre pas encore (elle demande un appel du moteur par objectif).
 */
import { enHeures } from './tableau';

export type Prerequis = {
  applicable?: boolean; vendable?: boolean; seances_min?: number | null; seances_declarees?: number | null;
  sl_depart_min?: number | null; sl_depart_min_min?: number | null; sl_depart_min_min_5?: number | null;
  alerte_coach?: { active?: boolean; raisons?: string[] } | null;
};

export const TEXTES_ALERTE = {
  sl: (x: string, y: string) => `Pour cet objectif, il lui faudrait une sortie longue de ${x} au départ : il court aujourd’hui ${y}.`,
  seances: (n: number, m: number) => `Pour cet objectif, il lui faudrait ${n} séances par semaine : il en a déclaré ${m}.`,
} as const;

const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

// La réponse de `POST /v1/prerequis` : son `prerequis`, ou null si elle n'a pas la forme du contrat.
export function lirePrerequis(reponse: unknown): Prerequis | null {
  const p = (reponse as { prerequis?: unknown } | null)?.prerequis;
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Prerequis) : null;
}

// Les phrases de l'alerte du coach ; aucune quand l'alerte n'est pas active ou n'a pas ses nombres.
export function phrasesDeLAlerte(p: Prerequis | null | undefined): string[] {
  const alerte = p?.alerte_coach;
  if (!p || p.applicable === false || !alerte || alerte.active !== true) return [];
  const raisons = Array.isArray(alerte.raisons) ? alerte.raisons : [];
  return [
    ...(raisons.includes('sl') && nombre(p.sl_depart_min_min_5) && nombre(p.sl_depart_min)
      ? [TEXTES_ALERTE.sl(enHeures(Math.round(p.sl_depart_min_min_5)), enHeures(Math.round(p.sl_depart_min)))] : []),
    ...(raisons.includes('seances') && nombre(p.seances_min) && nombre(p.seances_declarees)
      ? [TEXTES_ALERTE.seances(p.seances_min, p.seances_declarees)] : []),
  ];
}

export type AlerteDeLObjectif = { planId: string; nom: string; phrases: string[] };
export type ObjectifAAlerter = { planId: string; nom: string; parametres: Record<string, unknown> };

// Les alertes de ses objectifs : un appel du moteur par objectif, en parallèle ; une lecture qui échoue ne donne pas d'alerte et ne fait rien échouer. `lire` : la route (lirePrerequisDuMoteur).
export async function alertesDuCoach(objectifs: ObjectifAAlerter[], lire: (parametres: Record<string, unknown>) => Promise<unknown>): Promise<AlerteDeLObjectif[]> {
  const lues = await Promise.all(objectifs.map(async (o) => {
    const phrases = phrasesDeLAlerte(lirePrerequis(await lire(o.parametres).catch(() => null)));
    return phrases.length ? [{ planId: o.planId, nom: o.nom, phrases }] : [];
  }));
  return lues.flat();
}

// Le lundi qui vient (jamais aujourd'hui), pour l'entrée d'un objectif qui n'a pas démarré : le moteur projette le plan à partir de lui.
export function prochainLundi(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  const rang = d.getUTCDay();
  return new Date(d.getTime() + (((8 - rang) % 7) || 7) * 86_400_000).toISOString().slice(0, 10);
}

// La route du moteur (`POST /v1/prerequis`, corps `{ parametres }`) ; null quand elle ne répond pas bien (pas encore en ligne, corps illisible, délai).
export async function lirePrerequisDuMoteur(parametres: Record<string, unknown>): Promise<unknown> {
  const [{ API_URL }, { enTetesMoteur }] = await Promise.all([import('@/lib/plan'), import('./cleMoteur')]);
  const r = await fetch(`${API_URL}/v1/prerequis`, {
    method: 'POST', headers: enTetesMoteur({ 'Content-Type': 'application/json' }), body: JSON.stringify({ parametres }), cache: 'no-store', signal: AbortSignal.timeout(4_000),
  }).catch(() => null);
  return r?.ok ? r.json().catch(() => null) : null;
}
