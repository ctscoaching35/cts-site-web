/**
 * Lire un test fait dans Nolio (CTS_NOLIO_CADRAGE.md, TN3 et TN4, décisions coach du 19/10/2026) : les calculs, sans
 * appel à Nolio, pour qu'ils s'éprouvent seuls. La vitesse critique depuis les tours de la séance (l'effort de
 * 12 min et celui de 3 min, la séance test est écrite pour que la montre les coupe), sinon depuis la trace (la plus
 * grande distance sur 12 et sur 3 min) ; la FC au seuil 2, celle de la dernière minute du deuxième bloc de 10 min ;
 * la FC et l'allure du test de la parole, depuis le questionnaire du soir. Les garde-fous sont ceux de Z4 et de la
 * saisie dans l'app (lib/app/zones.ts) : un résultat qui ne les passe pas n'est pas enregistré.
 */
import { vitesseCritique, type Effort } from './zones';

export type Tour = { distance: number | null; duration: number | null; start_index: number | null; end_index: number | null };
export type Flux = { temps: number[]; distance: number[]; fc: number[] };

// Nolio rend les distances en mètres ou en kilomètres selon la ressource : moins de 100, ce sont des kilomètres.
const metres = (d: number) => (d < 100 ? d * 1000 : d);

// Le tour le plus rapide dont la durée tombe dans [min, max] secondes.
function plusRapide(tours: Tour[], min: number, max: number): Effort | null {
  const efforts = tours
    .filter((t) => t.distance && t.duration && t.duration >= min && t.duration <= max)
    .map((t) => ({ distance_m: metres(t.distance as number), duree_s: t.duration as number }));
  return efforts.sort((a, b) => b.distance_m / b.duree_s - a.distance_m / a.duree_s)[0] ?? null;
}

// La plus grande distance couverte sur `duree_s` secondes d'une trace (deux curseurs sur le temps).
export function meilleurEffort(temps: number[], distance: number[], duree_s: number): Effort | null {
  if (temps.length < 2 || temps.length !== distance.length) return null;
  const echelle = Math.max(...distance) < 100 ? 1000 : 1;
  let meilleur = 0;
  let debut = 0;
  for (let fin = 0; fin < temps.length; fin += 1) {
    while (temps[fin] - temps[debut] > duree_s) debut += 1;
    if (temps[fin] - temps[debut] >= duree_s - 2) meilleur = Math.max(meilleur, (distance[fin] - distance[debut]) * echelle);
  }
  return meilleur > 0 ? { distance_m: meilleur, duree_s } : null;
}

export type ResultatVc = { vc_ms: number; d_prime_m: number; source: 'tours' | 'trace' } | { erreur: string };

export function vcDuTest(tours: Tour[], flux: Flux | null): ResultatVc {
  const long = plusRapide(tours, 600, 840);
  const court = plusRapide(tours, 150, 210);
  if (long && court) {
    const r = vitesseCritique(court, long);
    return 'erreur' in r ? r : { ...r, source: 'tours' };
  }
  if (flux) {
    const l = meilleurEffort(flux.temps, flux.distance, 720);
    const c = meilleurEffort(flux.temps, flux.distance, 180);
    if (l && c) {
      const r = vitesseCritique(c, l);
      return 'erreur' in r ? r : { ...r, source: 'trace' };
    }
  }
  return { erreur: 'La séance ne montre pas les deux efforts de 12 et de 3 minutes.' };
}

// La FC de la dernière minute du deuxième bloc de 10 min (« Tes zones » élargi : au premier bloc elle monte encore).
export function fcSeuil2DuTest(tours: Tour[], flux: Flux | null): number | null {
  if (!flux || !flux.fc.length || flux.fc.length !== flux.temps.length) return null;
  const blocs = tours.filter((t) => t.duration && t.duration >= 540 && t.duration <= 660 && t.end_index !== null);
  const second = blocs[1];
  if (!second || second.end_index === null || second.end_index >= flux.temps.length) return null;
  const fin = flux.temps[second.end_index];
  const valeurs = flux.fc.filter((v, i) => v > 0 && flux.temps[i] > fin - 60 && flux.temps[i] <= fin);
  if (valeurs.length < 10) return null;
  const fc = Math.round(valeurs.reduce((a, b) => a + b, 0) / valeurs.length);
  return fc >= 100 && fc <= 230 ? fc : null;
}

// Les deux réponses du questionnaire du test de la parole (TN4), avec les garde-fous de la saisie dans l'app.
export function lireParole(fcBrute: unknown, allureBrute: unknown): { fc_seuil1: number; v_seuil1_ms: number | null } | null {
  const fc = Math.round(Number(String(fcBrute ?? '').replace(',', '.')));
  if (!Number.isFinite(fc) || fc < 80 || fc > 220) return null;
  const m = /^\s*(\d{1,2})\s*[:'’h]\s*(\d{1,2})\s*$/.exec(String(allureBrute ?? ''));
  const s = m ? Number(m[1]) * 60 + Number(m[2]) : null;
  return { fc_seuil1: fc, v_seuil1_ms: s !== null && s >= 150 && s <= 720 ? 1000 / s : null };
}
