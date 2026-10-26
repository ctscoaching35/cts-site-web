/**
 * Les zones CTS dans Nolio (CTS_NOLIO_CADRAGE.md, ZN1, décision coach du 19/10/2026 : pour tous) : à chaque nouvelle
 * valeur, les mêmes zones que l'app (le tableau de « Tes zones », Z6 et Z7, seuil 1 recoupé), écrites dans les réglages
 * Nolio de l'athlète. Lu le 19/10/2026 sur le compte du coach (lecture seule) : une enveloppe active de FC (5 zones, pour
 * tous ses sports) et une d'allure (6 zones) ; les sports d'une enveloppe sont des identifiants ; les zones se suivent
 * sans trou ; une allure se range du plus lent (`min`, « 07:06 ») au plus rapide (`max`). L'API règle les bornes par
 * enveloppe (`settings/zones/wrappers/{id}/`, `auto_recompute: false` pour les garder) et les noms au niveau du flux
 * (`settings/zones/streams/{id}/zones/{zone}/`). Droits `settings:read` et `settings:write` sur la clé.
 *
 * OUVERTE À TOUS le 25/10/2026 (décision du coach, « calibrer dans Nolio zones de vitesse et zones bpm
 * automatiquement ») : l'essai sur son compte a tenu (FC et allure écrites, noms de l'app, recalcul de Nolio coupé).
 *
 * LES NUMÉROS DU COACH (décision du 26/10/2026, CTS_STRUCTURE_COMMUNE.md, décision 1) : les zones écrites le 25/10
 * suivaient les lignes de l'app, le seuil 1 comme zone à part, et décalaient d'un cran les numéros que visent les
 * séances types du coach (son allure Z4, le seuil 2, devenait le tempo ; sa Z5, la VO2max, le seuil 2 ; sa FC Z2,
 * l'endurance, le seuil 1). Une échelle commune, ses numéros : Z1 récupération, Z2 endurance fondamentale, Z2+ seuil 1,
 * Z3 tempo, Z4 seuil 2, Z5 VO2max, Z6 sprint. Nolio numérote ses zones à la suite, sans « 2+ » : le seuil 1 vit dans
 * sa Z2 (il se vise en % de la VC ou en valeurs). L'allure, 6 zones : la récupération bornée à 50 % de la VC, la Z2 de
 * l'endurance au haut du seuil 1 (le seuil 1 recoupé les décale), le tempo jusqu'à 92 %, le seuil 2 jusqu'à 100 %, la
 * VO2max jusqu'à 112 % (sans le trou de l'app entre 100 et 105 % : les zones de Nolio se suivent), le sprint jusqu'à
 * 140 %. La FC, 5 zones : la récupération jusqu'à seuil 1 − 15, la Z2 jusqu'à seuil 1 + 5, le tempo jusqu'à seuil 2
 * − 5, le seuil 2, la VO2max jusqu'à seuil 2 + 15 ; elle vaut pour tous les sports de l'athlète (son enveloppe de FC
 * les couvre tous). Un athlète dont Nolio n'a pas le même nombre de zones garde les siennes, et le coach est prévenu.
 */
import type { Zones } from './plan';
import { appelNolio, refusNolio } from './nolio';
import { allure, decalageSeuil1, type Profil } from './zones';

export const POUR_TOUS = true;

// min, max : comme l'enveloppe Nolio les range (la FC du bas vers le haut ; l'allure du plus lent au plus rapide).
type Borne = { nom: string; min: number | string; max: number | string };

// Les noms de l'échelle commune (cts_contenu.ZONES_RPE), le seuil 1 dans la zone 2.
const Z2 = 'Zone 2 — endurance fondamentale et seuil 1';
const NOMS_FC = ['Zone 1 — récupération', Z2, 'Zone 3 — tempo', 'Zone 4 — seuil 2', 'Zone 5 — VO2max'];
const NOMS_ALLURE = ['Zone 1 — récupération', Z2, 'Zone 3 — tempo', 'Zone 4 — seuil 2', 'Zone 5 — VO2max', 'Zone 6 — sprint'];
const SPRINT_HAUT = 140;

export function zonesFc(p: Profil): Borne[] | null {
  const s1 = p.fc_seuil1;
  const s2 = p.fc_seuil2;
  if (s1 === null || s2 === null) return null;
  const bornes = [s1 - 40, s1 - 15, s1 + 5, s2 - 5, s2, s2 + 15];
  if (bornes.some((b, i) => i && b <= bornes[i - 1])) return null;
  return NOMS_FC.map((nom, i) => ({ nom, min: bornes[i], max: bornes[i + 1] }));
}

// Les allures, chaque zone du plus lent (min) au plus rapide (max), comme l'enveloppe Nolio les range.
export function zonesAllure(p: Profil, zones: Pick<Zones, 'tableau' | 'recoupement'>): Borne[] | null {
  if (p.vc_ms === null) return null;
  const vc = p.vc_ms;
  const d = decalageSeuil1(p, zones);
  const l = zones.tableau.lignes;
  // Les lignes de l'app : 0 récupération, 1 endurance, 2 seuil 1, 3 tempo, 4 seuil 2, 5 VO2max, 6 sprint.
  const pcts: [number, number][] = [
    [50, (l[0]?.allure_sous_vc ?? 70) + d],
    [(l[1]?.allure_vc?.[0] ?? 70) + d, (l[2]?.allure_vc?.[1] ?? 85) + d],
    [(l[3]?.allure_vc?.[0] ?? 85) + d, l[3]?.allure_vc?.[1] ?? 92],
    [l[4]?.allure_vc?.[0] ?? 92, l[4]?.allure_vc?.[1] ?? 100],
    [l[4]?.allure_vc?.[1] ?? 100, l[5]?.allure_vc?.[1] ?? 112],
    [l[5]?.allure_vc?.[1] ?? 112, SPRINT_HAUT],
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
    // Les noms de l'échelle commune (au niveau du flux : toutes ses enveloppes les prennent).
    for (const [i, z] of w.zones.entries()) {
      if (!z.id) continue;
      await appelNolio('PATCH', `settings/zones/streams/${w.stream}/zones/${z.id}/${q}`, { name: bornes[i].nom }).catch(() => null);
    }
  }
  return soucis;
}
