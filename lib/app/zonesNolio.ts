/**
 * Les zones CTS dans Nolio (CTS_NOLIO_CADRAGE.md, ZN1, décision coach du 19/10/2026 : pour tous) : à chaque nouvelle
 * valeur, les mêmes zones que l'app (le tableau de « Tes zones », Z6 et Z7, seuil 1 recoupé), écrites dans les réglages
 * Nolio de l'athlète. Lu le 19/10/2026 sur le compte du coach (lecture seule) : une enveloppe active de FC (5 zones, pour
 * tous ses sports) et une d'allure (6 zones) ; les sports d'une enveloppe sont des identifiants ; les zones se suivent
 * sans trou ; une allure se range du plus lent (`min`, « 07:06 ») au plus rapide (`max`). L'API règle les bornes par
 * enveloppe (`settings/zones/wrappers/{id}/`, `auto_recompute: false` pour les garder) et les noms au niveau du flux
 * (`settings/zones/streams/{id}/zones/{zone}/`). Droits `settings:read` et `settings:write` sur la clé.
 *
 * ÉCRITURE LIMITÉE AU COMPTE DU COACH (« (toi) ») TANT QUE L'ESSAI N'EST PAS FAIT : POUR_TOUS passe à true après
 * l'essai, avec l'accord du coach.
 *
 * Choix faits en construisant, à montrer au coach : la FC s'écrit avec les deux seuils (5 zones : endurance de seuil 1
 * − 25 à seuil 1 − 5, la plage déjà donnée aux séances ; seuil 1 ; tempo ; seuil 2 ; VO2max de seuil 2 à seuil 2 + 15) ;
 * l'allure avec la VC (6 zones, la récupération bornée à 50 % de la VC ; la VO2max dès 100 % de la VC, sans le trou de
 * l'app entre 100 et 105 %, comme les zones de Nolio se suivent) ; la FC vaut pour tous les sports de l'athlète (son
 * enveloppe de FC les couvre tous) ; un athlète dont Nolio n'a pas le même nombre de zones garde les siennes, et le
 * coach est prévenu.
 */
import type { Zones } from './plan';
import { appelNolio, refusNolio } from './nolio';
import { allure, decalageSeuil1, type Profil } from './zones';

export const POUR_TOUS = false;

// min, max : comme l'enveloppe Nolio les range (la FC du bas vers le haut ; l'allure du plus lent au plus rapide).
type Borne = { nom: string; min: number | string; max: number | string };

// Les noms des lignes du tableau des zones de l'app (cts_contenu.ZONES_RPE).
const NOMS_FC = ['Zone 2 — endurance fondamentale', 'Seuil 1', 'Zone 3 — tempo', 'Zone 4 — seuil 2', 'Zone 5 — VO2max'];
const NOMS_ALLURE = ['Zone 1 — récupération', 'Zone 2 — endurance fondamentale', 'Seuil 1', 'Zone 3 — tempo',
  'Zone 4 — seuil 2', 'Zone 5 — VO2max'];

export function zonesFc(p: Profil): Borne[] | null {
  const s1 = p.fc_seuil1;
  const s2 = p.fc_seuil2;
  if (s1 === null || s2 === null) return null;
  const bornes = [s1 - 25, s1 - 5, s1 + 5, s2 - 5, s2, s2 + 15];
  if (bornes.some((b, i) => i && b <= bornes[i - 1])) return null;
  return NOMS_FC.map((nom, i) => ({ nom, min: bornes[i], max: bornes[i + 1] }));
}

// Les allures, chaque zone du plus lent (min) au plus rapide (max), comme l'enveloppe Nolio les range.
export function zonesAllure(p: Profil, zones: Pick<Zones, 'tableau' | 'recoupement'>): Borne[] | null {
  if (p.vc_ms === null) return null;
  const vc = p.vc_ms;
  const d = decalageSeuil1(p, zones);
  const l = zones.tableau.lignes;
  const pcts: [number, number][] = [
    [50, (l[0]?.allure_sous_vc ?? 70) + d],
    [(l[1]?.allure_vc?.[0] ?? 70) + d, (l[1]?.allure_vc?.[1] ?? 80) + d],
    [(l[2]?.allure_vc?.[0] ?? 80) + d, (l[2]?.allure_vc?.[1] ?? 85) + d],
    [(l[3]?.allure_vc?.[0] ?? 85) + d, l[3]?.allure_vc?.[1] ?? 92],
    [l[4]?.allure_vc?.[0] ?? 92, l[4]?.allure_vc?.[1] ?? 100],
    [l[4]?.allure_vc?.[1] ?? 100, l[5]?.allure_vc?.[1] ?? 112],
  ];
  if (pcts.some(([a, b], i) => b <= a || (i && a < pcts[i - 1][0]))) return null;
  return NOMS_ALLURE.map((nom, i) => ({ nom, min: allure((vc * pcts[i][0]) / 100), max: allure((vc * pcts[i][1]) / 100) }));
}

type Enveloppe = { id: string; stream: string; stream_type: string; is_active: boolean; sports: (string | { id: string })[];
  zones: { id?: string; order?: number }[] };

// L'enveloppe de la course à pied d'un flux (la première active qui vise la course ou le trail, sinon toutes).
const COURSE = ['spt_kNYHjuEzDJRiYCX', 'spt_YprHS7jgV5vdsz0'];
const enveloppe = (liste: Enveloppe[], flux: string) => {
  const actives = liste.filter((w) => w.stream_type === flux && w.is_active);
  const idDe = (s: string | { id: string }) => (typeof s === 'string' ? s : s.id);
  return actives.find((w) => w.sports.some((s) => COURSE.includes(idDe(s)))) ?? actives.find((w) => !w.sports.length) ?? null;
};

// Écrit les zones CTS dans le Nolio d'un athlète. Rend ce qui n'a pas pu s'écrire (pour le coach), [] si tout va.
export async function ecrireZonesNolio(usr: string, moi: boolean, p: Profil, zones: Zones | null | undefined): Promise<string[]> {
  if (!zones || (!moi && !POUR_TOUS)) return [];
  const q = moi ? '' : `?athlete=${usr}`;
  const voulu: [string, Borne[] | null][] = [['heartrate', zonesFc(p)], ['pace', zonesAllure(p, zones)]];
  if (!voulu.some(([, b]) => b)) return [];
  const r = await appelNolio('GET', `settings/zones/wrappers/${q}`);
  if (r.statut !== 200) return [refusNolio(r, 'la lecture des zones')];
  const liste = (Array.isArray(r.corps) ? r.corps : (r.corps?.data ?? [])) as Enveloppe[];
  const soucis: string[] = [];
  for (const [flux, bornes] of voulu) {
    if (!bornes) continue;
    const w = enveloppe(liste, flux);
    if (!w) {
      soucis.push(`pas de zones ${flux === 'pace' ? 'd’allure' : 'de FC'} pour la course dans Nolio`);
      continue;
    }
    if (w.zones.length !== bornes.length) {
      soucis.push(`${w.zones.length} zones ${flux === 'pace' ? 'd’allure' : 'de FC'} dans Nolio au lieu de ${bornes.length} : les siennes restent`);
      continue;
    }
    const e = await appelNolio('PATCH', `settings/zones/wrappers/${w.id}/${q}`, {
      auto_recompute: false, zones: bornes.map((b, i) => ({ order: i + 1, min: String(b.min), max: String(b.max) })),
    });
    if (e.statut !== 200) {
      soucis.push(refusNolio(e, `les zones ${flux === 'pace' ? 'd’allure' : 'de FC'}`));
      continue;
    }
    // Les noms, ceux du tableau de l'app (au niveau du flux : toutes ses enveloppes les prennent).
    for (const [i, z] of w.zones.entries()) {
      if (!z.id) continue;
      await appelNolio('PATCH', `settings/zones/streams/${w.stream}/zones/${z.id}/${q}`, { name: bornes[i].nom }).catch(() => null);
    }
  }
  return soucis;
}
