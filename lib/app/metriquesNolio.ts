/**
 * Les repères de l'app écrits dans les métriques Nolio de l'athlète (décisions coach du 26/10/2026 : le Seuil 2,
 * décision 6, « le site écrit la VC et la FC au seuil 2 dans Nolio » ; le Seuil 1, la FC et la vitesse au seuil 1). Les
 * séances de la bibliothèque CTS visent un pourcentage de ces métriques (CTS_DOCTRINE_SEANCES.md dans le dépôt du
 * moteur) : sans elles, une séance n'affiche ni allure ni FC chez l'athlète.
 *
 * L'inverse de reperesNolio.ts (Nolio vers l'app, chaque nuit) : une valeur de l'app part dans Nolio, datée du jour de
 * son test (sinon du jour), quand Nolio n'a rien, ou une valeur plus ancienne et différente ; jamais par-dessus une
 * valeur de Nolio plus récente ou du même jour (Nolio l'emporte, et la nuit la ramène dans l'app). Appelée avec les
 * zones (zonesNolio.ecrireZonesNolio) : aux mêmes moments, repère enregistré, test lu, rattrapage de nuit. Côté serveur.
 */
import { appelNolio, refusNolio } from './nolio';
import { decalageSeuil1, type Profil } from './zones';
import type { Zones } from './plan';

// Les métriques du compte du coach (lues et créées le 26/10/2026) : la VC est celle du catalogue de Nolio (une
// allure, en secondes par km) ; la FC au seuil 2, la FC au seuil 1 et la vitesse au seuil 1 (en km/h : une métrique
// créée est un nombre, seul un nombre en km/h garde un pourcentage juste) sont les siennes.
type Metrique = { nom: string; item: string; valeur: (p: Profil, zones: Pick<Zones, 'recoupement'> | null | undefined) => number | null;
  le: (p: Profil) => string | null; egal: (a: number, b: number) => boolean };
const METRIQUES: Metrique[] = [
  { nom: 'la vitesse critique', item: 'mti_AUit0R4USmTdyFZ', valeur: (p) => (p.vc_ms ? Math.round(1000 / p.vc_ms) : null),
    le: (p) => p.vc_le, egal: (a, b) => Math.abs(a - b) < 1 },
  { nom: 'la FC au seuil 2', item: 'mti_zBpan6mEubaMh4i', valeur: (p) => p.fc_seuil2, le: (p) => p.fc_seuil2_le,
    egal: (a, b) => Math.round(a) === Math.round(b) },
  { nom: 'la FC au seuil 1', item: 'mti_z68Hn6mEubaMh4i', valeur: (p) => p.fc_seuil1, le: (p) => p.fc_seuil1_le,
    egal: (a, b) => Math.round(a) === Math.round(b) },
  // Le seuil 1 de l'app : le test de la parole recoupé avec la VC, sinon 82 % de la VC (zones.ts, situerSeuil1).
  { nom: 'la vitesse au seuil 1', item: 'mti_TvxB3cSxOqH6Fbk',
    valeur: (p, zones) => (p.vc_ms ? Math.round(p.vc_ms * (0.82 + decalageSeuil1(p, zones) / 100) * 3.6 * 10) / 10 : null),
    le: (p) => p.fc_seuil1_le ?? p.vc_le, egal: (a, b) => Math.abs(a - b) < 0.15 },
];

const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

// Écrit les repères dans les métriques Nolio d'un athlète. Rend ce qui n'a pas pu s'écrire (pour le coach), [] sinon.
export async function ecrireMetriquesNolio(usr: string, moi: boolean, p: Profil,
  zones: Pick<Zones, 'recoupement'> | null | undefined): Promise<string[]> {
  const qui = moi ? '' : `athlete=${usr}`;
  const jour = aujourdhui();
  const soucis: string[] = [];
  for (const m of METRIQUES) {
    const valeur = m.valeur(p, zones);
    if (valeur === null || !Number.isFinite(valeur)) continue;
    const le = (m.le(p) ?? jour).slice(0, 10);
    const date = le > jour ? jour : le;
    const r = await appelNolio('GET', `metrics/values/?item=${m.item}&limit=1${qui ? `&${qui}` : ''}`);
    if (r.statut !== 200) {
      soucis.push(refusNolio(r, `la lecture de ${m.nom}`));
      continue;
    }
    const derniere = ((r.corps?.data ?? []) as { date_start?: string; value?: number | null }[])[0];
    const sa = derniere && derniere.value !== null && derniere.value !== undefined ? Number(derniere.value) : null;
    const saDate = String(derniere?.date_start ?? '').slice(0, 10);
    if (sa !== null && (m.egal(sa, valeur) || saDate >= date)) continue;
    const e = await appelNolio('POST', `metrics/values/${qui ? `?${qui}` : ''}`, {
      item: m.item, value: valeur, date_start: date, description: 'Repère CTS (app)',
    });
    if (e.statut !== 201 && e.statut !== 200) soucis.push(refusNolio(e, `l'écriture de ${m.nom}`));
  }
  return soucis;
}
