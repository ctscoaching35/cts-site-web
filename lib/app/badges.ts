/**
 * Les badges du coureur (CTS_NOLIO_CADRAGE.md, BG1 à BG3, décisions coach du 20/10/2026) : 23 badges en quatre familles,
 * débloqués par ses séances de course et de trail réalisées dans Nolio, depuis toujours. Ce module ne fait que compter :
 * la lecture de Nolio et la base vivent dans badgesNolio.ts. On ne garde que les badges débloqués (leur date) et les
 * totaux de chaque mois (pour les cumuls).
 */
export type Famille = 'distance' | 'duree' | 'denivele' | 'cumul';
type Mesure = 'km' | 'min' | 'dplus' | 'km_total' | 'dplus_total';
export type Badge = { cle: string; famille: Famille; court: string; annonce: string; mesure: Mesure; seuil: number };

// Les unités collées au nombre (espaces insécables) : « 2 000 m D+ » ne se coupe pas.
const km = (n: number) => `${n.toLocaleString('fr-FR')}\u00a0km`;
const m = (n: number) => `${n.toLocaleString('fr-FR')}\u00a0m`;
export const BADGES: Badge[] = [
  ...([[20, '20\u00a0km', 'Ta première sortie de 20\u00a0km'], [30, '30\u00a0km', 'Ta première sortie de 30\u00a0km'],
    [42, 'Marathon', 'Ton premier marathon'], [50, '50\u00a0km', 'Tes premiers 50\u00a0km'], [80, '80\u00a0km', 'Tes premiers 80\u00a0km'],
    [100, '100\u00a0km', 'Tes premiers 100\u00a0km'], [160, '100\u00a0miles', 'Tes premiers 100\u00a0miles']] as const)
    .map(([seuil, court, annonce]) => ({ cle: `distance_${seuil}`, famille: 'distance' as const, court, annonce, mesure: 'km' as const, seuil })),
  ...[2, 3, 4, 6, 12, 24].map((h) => ({ cle: `duree_${h}h`, famille: 'duree' as const, court: `${h}\u00a0h`,
    annonce: `Ta première sortie de ${h}\u00a0h`, mesure: 'min' as const, seuil: h * 60 })),
  ...[1000, 2000, 3000, 5000, 10000].map((d) => ({ cle: `denivele_${d}`, famille: 'denivele' as const, court: m(d),
    annonce: `Ta première sortie à ${m(d)}\u00a0D+`, mesure: 'dplus' as const, seuil: d })),
  ...[1000, 5000, 10000].map((k) => ({ cle: `cumul_km_${k}`, famille: 'cumul' as const, court: km(k),
    annonce: `${km(k)} courus`, mesure: 'km_total' as const, seuil: k })),
  ...[50000, 100000].map((d) => ({ cle: `cumul_dplus_${d}`, famille: 'cumul' as const, court: `${m(d)}\u00a0D+`,
    annonce: `${m(d)}\u00a0D+ grimpés`, mesure: 'dplus_total' as const, seuil: d })),
];

export const FAMILLES: [Famille, string][] = [
  ['distance', 'Distance, une sortie'], ['duree', 'Durée, une sortie'], ['denivele', 'Dénivelé, une sortie'],
  ['cumul', 'Cumuls, toute ta vie de coureur'],
];

// Une séance de course ou de trail réalisée : sa distance (km), sa durée (min), son dénivelé (m).
export type Activite = { id: string; date: string; km: number | null; min: number | null; dplus: number | null };
export type EtatBadges = { debloques: Record<string, { date: string }>; mois: Record<string, { km: number; dplus: number }> };
export const ETAT_VIDE: EtatBadges = { debloques: {}, mois: {} };

// Une distance tenue à 99 % compte : une montre arrondit souvent sous la borne (19,9 km pour 20).
const TOLERANCE_DISTANCE = 0.99;

// Ajouter des séances à l'état. depuisMois (« AAAA-MM ») : les mois à partir de lui sont recomptés depuis ces seules
// séances (la relecture des deux derniers mois), ceux d'avant gardés ; null : tout est recompté (l'historique entier).
// Un badge déjà débloqué garde sa date ; un cumul se date de la séance qui franchit sa borne.
export function ajouterSeances(etat: EtatBadges, activites: Activite[], depuisMois: string | null): EtatBadges {
  const debloques = { ...etat.debloques };
  const mois = Object.fromEntries(Object.entries(etat.mois).filter(([cle]) => depuisMois !== null && cle < depuisMois));
  const triees = activites.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let totalKm = Object.values(mois).reduce((t, x) => t + x.km, 0);
  let totalDplus = Object.values(mois).reduce((t, x) => t + x.dplus, 0);
  for (const a of triees) {
    const cle = a.date.slice(0, 7);
    const dansLeMois = mois[cle] ?? { km: 0, dplus: 0 };
    mois[cle] = { km: dansLeMois.km + (a.km ?? 0), dplus: dansLeMois.dplus + (a.dplus ?? 0) };
    totalKm += a.km ?? 0;
    totalDplus += a.dplus ?? 0;
    for (const b of BADGES) {
      if (debloques[b.cle]) continue;
      const valeur = b.mesure === 'km' ? a.km : b.mesure === 'min' ? a.min : b.mesure === 'dplus' ? a.dplus
        : b.mesure === 'km_total' ? totalKm : totalDplus;
      const seuil = b.mesure === 'km' ? b.seuil * TOLERANCE_DISTANCE : b.seuil;
      if (valeur !== null && valeur >= seuil) debloques[b.cle] = { date: a.date };
    }
  }
  return { debloques, mois: Object.fromEntries(Object.entries(mois).map(([k, v]) => [k, { km: Math.round(v.km * 10) / 10, dplus: Math.round(v.dplus) }])) };
}

// Les totaux de toute sa vie de coureur, pour la progression vers un cumul.
export function totaux(etat: EtatBadges) {
  const v = Object.values(etat.mois);
  return { km: Math.round(v.reduce((t, x) => t + x.km, 0)), dplus: Math.round(v.reduce((t, x) => t + x.dplus, 0)) };
}

// Les badges débloqués la semaine écoulée, du plus récent au plus ancien (la carte « Nouveau badge » de l'accueil : le
// premier, et combien d'autres) ; une même sortie en débloque souvent plusieurs.
export function nouveauxBadges(etat: EtatBadges, aujourdhui: string): (Badge & { date: string })[] {
  const depuis = new Date(`${aujourdhui}T12:00:00Z`);
  depuis.setUTCDate(depuis.getUTCDate() - 7);
  const borne = depuis.toISOString().slice(0, 10);
  return BADGES.map((b) => ({ ...b, date: etat.debloques[b.cle]?.date ?? '' }))
    .filter((b) => b.date && b.date > borne && b.date <= aujourdhui).sort((a, b) => b.date.localeCompare(a.date));
}
