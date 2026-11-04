/**
 * Un coaché sans objectif (décision coach du 20/10/2026, « tableau de bord complet ») : l'app reste son tableau de bord,
 * sans plan. Ce qu'un plan lui apporterait sans course — « Tes zones » (les trois tests, leur saisie, le tableau des
 * zones) et l'effort du mode d'emploi — vient du moteur (GET /v1/reperes), gardé une heure. Le reste du plan n'existe
 * pas : seules les pages qui l'acceptent (contexte(…, { sansObjectif: true })) le reçoivent, et n'en lisent que ces
 * repères et le nom de l'athlète. Côté serveur seulement.
 */
import { API_URL } from '@/lib/plan';
import type { CleTest, Plan, Zones } from './plan';

export type Reperes = { zones: Zones; effort: Plan['mode_emploi']['effort'] };

// LE MOTEUR MUET (B-AT-64, audit du 03/11/2026) : sans ses repères, toute l'app d'un coaché sans objectif tombait
// (accueil, données, profil, bibliothèque, compte). Un repli sans zones : les autres cartes s'affichent, « Tes zones »
// dit qu'elles reviennent dans un moment.
const INDISPONIBLES: Reperes = {
  zones: {
    titre: 'Tes zones', intro: ['Tes zones sont indisponibles pour l’instant : elles reviennent dans quelques minutes.'],
    rpe_decide: '', vitesse_critique_ouverte: false, tests_disponibles: [], tests: [], consentement: '', effacer: '',
    encart: { titre: '', lien: '', libelles: {} as Record<CleTest, string>, complet: '' }, mentions: {} as Record<CleTest, string>,
    derive_sl: '', tableau: { colonnes: ['', ''], lignes: [] },
  },
  effort: { titre: 'L’effort', intro: '', zones: [], note: '' },
};

export async function reperesDeBase(): Promise<Reperes> {
  try {
    const r = await fetch(`${API_URL}/v1/reperes`, { next: { revalidate: 3600 } });
    if (!r.ok) throw new Error(`repères du moteur : ${r.status}`);
    return (await r.json()) as Reperes;
  } catch (e) {
    console.error('Repères du moteur indisponibles :', e instanceof Error ? e.message : e);
    return INDISPONIBLES;
  }
}

// Le « plan » d'un coaché sans objectif : son nom et ses repères, rien d'autre.
export function planSansObjectif(nom: string, reperes: Reperes): Plan {
  return { athlete: { nom }, zones: reperes.zones, mode_emploi: { effort: reperes.effort } } as unknown as Plan;
}
