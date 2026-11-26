// Fonctions pures, sans réseau ni base : ce qui a été fait une semaine écrite par le moteur v1 (scripts/test-realise-v9.mjs).
/**
 * LE RÉALISÉ D'UNE SEMAINE DU MOTEUR v1 (décisions du coach 198 et 199, 24/11/2026 ; doctrine A2 : « Le résumé du réalisé »), dans la forme de semaines_ecrites.realise que lisent les graphiques et la jauge.
 * Le moteur v1 n'en rend pas (`/v1/realise` retirée) : le site le tire de Nolio, la nuit (lib/app/realiseDuV1.ts).
 *
 * NOLIO FAIT FOI : le prévu est ce que Nolio montre cette semaine-là (une séance que le coach retire ou change compte comme il l'a laissée, une séance qu'il ajoute compte). La semaine du moteur ne sert qu'à
 * dire quelles séances sont les siennes, et lesquelles sont clés.
 * UNE SÉANCE EST FAITE quand une activité y est reliée par Nolio ; une activité reliée à rien l'est à la séance prévue non faite la plus proche, en jour puis en durée, à ±25 % (A2).
 * UNE SÉANCE CLÉ EST RÉUSSIE quand elle est faite sans écart (199) : ni tenue en partie ou pas du tout (262, sa réponse à « Séance tenue ? »), ni cochée « pas faite » au point du dimanche, ni écourtée (moins de la moitié de sa durée), ni trop dure (un RPE donné au moins 2 au-dessus
 * du prévu, 3 pour la sortie longue ; jamais au-delà de 10). Écourtée ou trop dure, elle compte comme faite, pas comme réussie.
 * LA CHARGE (RPE × minutes) prend le RPE donné, sinon le RPE prévu de la séance reliée (`rpe_lu` dit si un seul a été donné) ; `charge_tenue` compte chaque séance prévue au plus à sa charge prévue.
 */
import { FAMILLES_CLES } from './dimancheV9';
import type { Realise } from './ecriture';
import type { Prevue, Reelle } from './resumeSemaine';
import { tenueDeLaSeance } from './seanceTenue';

export const ECOURTEE_SOUS = 0.5;
export const TROP_DUR_RPE = 2;
export const TROP_DUR_RPE_SL = 3;
const RELIEE_A = 0.25;
// La sortie longue et le week-end choc : la « sortie longue » des graphiques.
const LONGUES = ['sl', 'wec'];

const minutes = (d: { value?: number } | null | undefined) => (typeof d?.value === 'number' && d.value > 0 ? Math.round(d.value / 60) : 0);
const nombre = (v: unknown): v is number => typeof v === 'number';
const somme = (liste: number[]) => liste.reduce((n, x) => n + x, 0);
const jour = (iso: string) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);

// Quelle activité a fait quelle séance prévue : le lien de Nolio d'abord (la plus longue s'il y en a deux), puis, pour une activité reliée à rien, la séance prévue encore sans activité la plus proche.
export function relier<R extends Reelle>(prevues: Prevue[], reelles: R[]): Map<string, R> {
  const faites = new Map<string, R>();
  const connues = new Set(prevues.map((p) => p.id));
  for (const r of reelles) {
    if (!r.planned || !connues.has(r.planned)) continue;
    const deja = faites.get(r.planned);
    if (!deja || minutes(r.duration) > minutes(deja.duration)) faites.set(r.planned, r);
  }
  const libres = reelles.filter((r) => !r.planned && minutes(r.duration) > 0).sort((a, b) => a.date_start.localeCompare(b.date_start));
  for (const r of libres) {
    const duree = minutes(r.duration);
    const proche = prevues
      .filter((p) => !faites.has(p.id) && Math.abs(minutes(p.duration) - duree) <= RELIEE_A * minutes(p.duration))
      .sort((a, b) => Math.abs(jour(a.date_start) - jour(r.date_start)) - Math.abs(jour(b.date_start) - jour(r.date_start))
        || Math.abs(minutes(a.duration) - duree) - Math.abs(minutes(b.duration) - duree))[0];
    if (proche) faites.set(proche.id, r);
  }
  return faites;
}

export function realiseDeLaSemaineV9({ numero, lundi, type, prevues, reelles, idDuMoteur, familleDe, pasFaites, hooper, lireTenue = false }: {
  numero: string; lundi: string; type: string | null;
  // La course à pied et le trail seulement, prévus et réalisés (la même mesure que les autres résumés).
  prevues: Prevue[]; reelles: Reelle[];
  // L'identifiant Nolio d'une séance envoyée vers son id du moteur (« S9-mardi »), et la famille de chaque id.
  idDuMoteur: ReadonlyMap<string, string>; familleDe: ReadonlyMap<string, string>;
  // Les séances clés cochées « pas faite » à un point du dimanche (leurs ids).
  pasFaites: ReadonlySet<string>; hooper: number | null;
  // « Séance tenue ? » (262), à l'essai sur « (toi) » puis partout (lib/app/seanceTenue.ts).
  lireTenue?: boolean;
}): Realise {
  const p = prevues.filter((x) => minutes(x.duration) > 0);
  const faites = relier(p, reelles);
  const parId = new Map(p.map((x) => [x.id, x]));
  const prevueDe = new Map([...faites].map(([id, r]) => [r.id, parId.get(id) as Prevue]));
  const rpeDe = (r: Reelle) => r.debrief?.rpe ?? prevueDe.get(r.id)?.rpe ?? null;
  const charge = (r: Reelle) => { const rpe = rpeDe(r); return nombre(rpe) ? rpe * minutes(r.duration) : 0; };
  const chargePrevue = (x: Prevue) => (nombre(x.rpe) ? x.rpe * minutes(x.duration) : 0);
  const familleDeLaPrevue = (x: Prevue) => familleDe.get(idDuMoteur.get(x.id) ?? '') ?? '';

  const longues = p.filter((x) => LONGUES.includes(familleDeLaPrevue(x)));
  const longuesFaites = longues.flatMap((x) => (faites.has(x.id) ? [minutes((faites.get(x.id) as Reelle).duration)] : []));
  const cles = p.filter((x) => (FAMILLES_CLES as readonly string[]).includes(familleDeLaPrevue(x)));
  const reussie = (x: Prevue) => {
    const r = faites.get(x.id);
    if (!r || pasFaites.has(idDuMoteur.get(x.id) ?? '')) return false;
    const tenue = lireTenue ? tenueDeLaSeance(r.debrief?.questions) : null;
    if (tenue && tenue !== 'entierement') return false;
    if (minutes(r.duration) < ECOURTEE_SOUS * minutes(x.duration)) return false;
    const rpe = r.debrief?.rpe;
    const ecart = LONGUES.includes(familleDeLaPrevue(x)) ? TROP_DUR_RPE_SL : TROP_DUR_RPE;
    return !(nombre(rpe) && nombre(x.rpe) && rpe >= Math.min(x.rpe + ecart, 10));
  };
  const dplus = reelles.filter((r) => nombre(r.elevation_gain?.value));

  return {
    numero, lundi, type,
    charge_prevue: Math.round(somme(p.map(chargePrevue))),
    charge_faite: Math.round(somme(reelles.map(charge))),
    charge_tenue: Math.round(somme(p.map((x) => (faites.has(x.id) ? Math.min(charge(faites.get(x.id) as Reelle), chargePrevue(x)) : 0)))),
    rpe_lu: reelles.some((r) => nombre(r.debrief?.rpe)),
    seances_prevues: p.length, seances_faites: reelles.length,
    duree_prevue_min: somme(p.map((x) => minutes(x.duration))), duree_faite_min: somme(reelles.map((r) => minutes(r.duration))),
    sl_prevue_min: longues.length ? Math.max(...longues.map((x) => minutes(x.duration))) : null,
    sl_faite_min: longuesFaites.length ? Math.max(...longuesFaites) : null,
    cles_prevues: cles.length, cles_reussies: cles.filter(reussie).length,
    dplus_m: dplus.length ? Math.round(somme(dplus.map((r) => r.elevation_gain?.value as number))) : null,
    hooper,
    rpe_complet: reelles.length > 0 && reelles.every((r) => nombre(r.debrief?.rpe) || !minutes(r.duration)),
  };
}
