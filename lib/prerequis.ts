// Aucun réseau : les phrases des prérequis d'un plan, dites à l'acheteur avant le paiement (scripts/test-prerequis-achat.mjs). Ce fichier est lu par le navigateur et par le serveur.
/**
 * LES PRÉREQUIS D'UN PLAN, DITS À L'ACHETEUR (entrée 234 du coach, 25/11/2026 ; textes de la section 4 de « Lot de textes à valider — moteur, 25-11 », validés « Tout A » ; CONTRAT_API_CTS.md,
 * `POST /v1/prerequis`) : le moteur v1 projette le plan entier avec les réponses de l'acheteur et rend `prerequis`. Quand `vendable` est faux, le site le DIT à l'acheteur, dans le récapitulatif, avant le
 * paiement : il ne refuse jamais (c'est « dire à l'athlète », pas refuser). Les phrases viennent des nombres que le moteur rend :
 *   - la sortie longue manque (`raisons` contient « sl ») : X = `sl_depart_min_min_5` (la plus petite sortie longue de départ qui tient, arrondie à 5 min au-dessus), Y = `sl_depart_min` (celle qu'il court),
 *     k = `semaines_pour_s_y_preparer` ; avec `sl_depart_min_min` à null (même un départ au pic n'y arrive pas), seulement la phrase « Tu peux aussi choisir un plan plus long ou une course plus courte. » ;
 *   - les séances manquent (« seances ») : N = `seances_min` ;
 *   - les deux : les deux phrases, l'une après l'autre.
 * Sans les nombres qu'une phrase dit, elle n'est pas écrite : rien d'inventé. Un plan vendable, une saison de fond sans date (`applicable: false`), une réponse qui n'a pas la forme du contrat : aucune phrase.
 * Le bouton qui suit (un plan plus long, une course plus courte) revient aux réponses : c'est « Modifier mes réponses » du récapitulatif.
 *
 * LA VENTE EST FERMÉE (décision 234 du coach : « sans les deux prérequis, on ne vend pas cette course ») : quand le moteur répond `vendable: false`, le récapitulatif ne propose plus de payer ce plan : les phrases,
 * puis « ← Modifier mes réponses ». Quand le moteur ne répond pas (route absente, délai, forme inattendue), la vente suit son cours, sans message : un moteur muet ne ferme jamais une vente (`venteFermee`).
 */
export type PrerequisAchat = {
  applicable?: boolean; vendable?: boolean; raisons?: string[];
  seances_min?: number | null; sl_depart_min?: number | null; sl_depart_min_min?: number | null; sl_depart_min_min_5?: number | null; semaines_pour_s_y_preparer?: number | null;
};

const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
// Une durée en minutes, comme le reste du site : « 1h30 », « 2h », « 45 min ».
export const enDuree = (min: number): string => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);

export const TEXTES_PREREQUIS = {
  choix: 'Tu peux aussi choisir un plan plus long ou une course plus courte.',
  sl: (x: string, y: string, k: number) => `Pour démarrer ce plan, il faut pouvoir courir ${x} d’affilée lors de ta sortie longue. Aujourd’hui, ta plus longue sortie est de ${y}. `
    + `En l’allongeant d’environ 10 % chaque semaine, tu y seras dans ${k} semaine${k > 1 ? 's' : ''} environ : c’est le bon moment pour commencer.`,
  seances: (n: number) => `Pour une course de cette durée, il faut t’entraîner au moins ${n} fois par semaine : en dessous, ta sortie longue porterait presque toute ta semaine, `
    + `et le risque de te blesser monte. Tu peux prévoir ${n} séances, ou choisir une course plus courte.`,
} as const;

// La réponse de `POST /v1/prerequis` : son `prerequis`, ou null si elle n'a pas la forme du contrat.
export function prerequisDeLaReponse(reponse: unknown): PrerequisAchat | null {
  const p = (reponse as { prerequis?: unknown } | null)?.prerequis;
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as PrerequisAchat) : null;
}

// Ce que le navigateur reçoit du serveur : seulement ce qu'il faut pour dire les phrases.
export function prerequisPourLAchat(p: PrerequisAchat | null | undefined): PrerequisAchat | null {
  if (!p) return null;
  const garde = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    applicable: p.applicable === false ? false : true, vendable: typeof p.vendable === 'boolean' ? p.vendable : undefined,
    raisons: Array.isArray(p.raisons) ? p.raisons.filter((r): r is string => typeof r === 'string') : [],
    seances_min: garde(p.seances_min), sl_depart_min: garde(p.sl_depart_min), sl_depart_min_min: garde(p.sl_depart_min_min),
    sl_depart_min_min_5: garde(p.sl_depart_min_min_5), semaines_pour_s_y_preparer: garde(p.semaines_pour_s_y_preparer),
  };
}

// Le moteur dit-il que ce plan ne se vend pas ? Seulement sur `vendable: false` lu (et un plan applicable) ; rien lu, c'est non.
export const venteFermee = (p: PrerequisAchat | null | undefined): boolean => Boolean(p) && p?.applicable !== false && p?.vendable === false;

// L'état de la vente d'un plan, pour le récapitulatif : « en_attente » tant que le moteur n'a pas répondu (au plus quelques secondes : un clic rapide ne passe pas avant lui), « fermee » quand il dit non vendable,
// « ouverte » sinon, y compris quand il n'a rien dit. `achat` : un acheteur ; ni le coach ni la demande d'un coaché n'ont de prérequis à lire.
export type EtatDeLaVente = 'ouverte' | 'en_attente' | 'fermee';
export function etatDeLaVente({ achat, prerequis, enCours }: { achat: boolean; prerequis: PrerequisAchat | null | undefined; enCours: boolean }): EtatDeLaVente {
  if (!achat) return 'ouverte';
  if (enCours) return 'en_attente';
  return venteFermee(prerequis) ? 'fermee' : 'ouverte';
}

// Ce que le navigateur lit : la route du site (`POST /plan/prerequis`, app/plan/prerequis/route.ts). Ne rejette jamais : une réponse qui n'est pas bonne (404, 429, 5xx), un délai, un réseau coupé ou un corps qui
// n'a pas la forme du contrat donnent `null`, et `null` ne ferme rien.
export async function lirePrerequisDeLAchat(reponses: Record<string, unknown>, appeler: typeof fetch = (...a) => fetch(...a), delaiMs = 8_000): Promise<PrerequisAchat | null> {
  try {
    const r = await appeler('/plan/prerequis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reponses), signal: AbortSignal.timeout(delaiMs) });
    if (!r.ok) return null;
    return prerequisPourLAchat(prerequisDeLaReponse(await r.json()));
  } catch {
    return null;
  }
}

// Les phrases dites à l'acheteur, dans l'ordre (la sortie longue, puis les séances) ; aucune quand le plan est vendable ou que la réponse n'en dit pas assez.
export function messagesDesPrerequis(p: PrerequisAchat | null | undefined): string[] {
  if (!p || p.applicable === false || p.vendable !== false) return [];
  const raisons = Array.isArray(p.raisons) ? p.raisons : [];
  const t = TEXTES_PREREQUIS;
  const sl = raisons.includes('sl')
    ? [nombre(p.sl_depart_min_min_5) && nombre(p.sl_depart_min) && nombre(p.semaines_pour_s_y_preparer)
      ? `${t.sl(enDuree(Math.round(p.sl_depart_min_min_5)), enDuree(Math.round(p.sl_depart_min)), Math.round(p.semaines_pour_s_y_preparer))} ${t.choix}`
      : t.choix]
    : [];
  const seances = raisons.includes('seances') && nombre(p.seances_min) ? [t.seances(Math.round(p.seances_min))] : [];
  // Une vente fermée ne reste jamais sans un mot : si aucun nombre ne permet une phrase, celle du choix (« un plan plus long ou une course plus courte ») dit quoi faire.
  return sl.length || seances.length ? [...sl, ...seances] : [t.choix];
}
