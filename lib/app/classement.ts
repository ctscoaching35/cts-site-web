/**
 * LE CLASSEMENT D'UNE SÉANCE PAR SA STRUCTURE (la continuité, décisions coach du 26/10/2026, CTS_CONTINUITE_REFLEXION.md
 * dans le dépôt du moteur, décision 2) : le temps passé à chaque intensité, lu dans les étapes de la séance prévue,
 * donne sa famille et sa dose, quel qu'en soit l'auteur ou le nom. Chaque étape de travail prend la cible la plus
 * précise qu'elle porte : l'allure visée, le % de la vitesse critique (ou une allure en clair rapportée à la VC de
 * l'athlète), le % de la FC aux seuils (ou des pulsations en clair rapportées à ses seuils), la zone (l'échelle commune,
 * aux numéros du coach), le RPE à défaut ; une montée ou une descente sans autre cible est de la mécanique. Fonctions
 * pures : aucune lecture ici (lib/app/continuite.ts lit Nolio).
 */

export type CibleNolio = {
  type: string; metric?: string; percent?: number; percent_max?: number; zone?: number; stream?: string;
  value?: number | string; value_max?: number | string; unit?: string; rpe?: number;
};
export type NoeudNolio = {
  kind: string; intensity?: string; duration?: { value: number; unit?: string } | null;
  distance?: { value: number; unit?: string } | null; targets?: CibleNolio[]; times?: number; steps?: NoeudNolio[];
};
export type ProfilLu = { vc_ms?: number | null; fc_seuil1?: number | null; fc_seuil2?: number | null };
export type FamilleLue = 'ef' | 'seuil1' | 'tempo' | 'seuil2' | 'vo2max' | 'allure' | 'sprint' | 'mecanique';
export type Classement = { famille: FamilleLue; minutes: number; reps: number; bloc_min: number };

// Les bornes de l'échelle commune en part de la VC (cts_route : Seuil 1 80-85 %, Seuil 2 90-95 %, VO2max 105-115 %).
const parVc = (p: number): FamilleLue =>
  p < 0.8 ? 'ef' : p < 0.86 ? 'seuil1' : p < 0.9 ? 'tempo' : p < 1.01 ? 'seuil2' : p < 1.15 ? 'vo2max' : 'sprint';
const parRpe = (r: number): FamilleLue =>
  r <= 4 ? 'ef' : r === 5 ? 'seuil1' : r === 6 ? 'tempo' : r === 7 ? 'seuil2' : r <= 9 ? 'vo2max' : 'sprint';
// Les zones aux numéros du coach (décision du 26/10/2026) : Z2 porte l'EF et le Seuil 1, la zone ne les sépare pas.
const parZone = (z: number): FamilleLue => (z <= 2 ? 'ef' : z === 3 ? 'tempo' : z === 4 ? 'seuil2' : z === 5 ? 'vo2max' : 'sprint');

const milieu = (a: number, b?: number | null) => (typeof b === 'number' && b > 0 ? (a + b) / 2 : a);
// « 4:39 » -> 279 s ; un nombre reste un nombre.
const enSecondes = (x: number | string | undefined): number | null => {
  if (typeof x === 'number') return x;
  const m = /^(\d+):(\d{2})$/.exec(String(x ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// La famille d'une étape de travail, et sa vitesse quand une allure la donne (pour une étape en distance).
export function familleDuPas(pas: NoeudNolio, profil: ProfilLu): { famille: FamilleLue; vitesse?: number } | null {
  if (pas.intensity === 'warmup' || pas.intensity === 'cooldown') return null;
  const cibles = pas.targets ?? [];
  const vc = profil.vc_ms ?? null;
  for (const c of cibles) {
    if (c.type === 'metric' && c.metric === 'ALLUREVISEE') return { famille: 'allure' };
    if (c.type === 'metric' && c.metric === 'VITESSECRITIQUERUNNING' && typeof c.percent === 'number') {
      const p = milieu(c.percent, c.percent_max) / 100;
      return { famille: parVc(p), ...(vc ? { vitesse: vc * p } : {}) };
    }
    if (c.type === 'raw' && c.unit === '/km') {
      const a = enSecondes(c.value), b = enSecondes(c.value_max);
      if (a) {
        const v = 1000 / milieu(a, b);
        if (vc) return { famille: parVc(v / vc), vitesse: v };
      }
    }
  }
  for (const c of cibles) {
    if (c.type === 'metric' && typeof c.percent === 'number' && (c.metric === 'FCSEUIL2' || c.metric === 'FCSEUIL1'
      || c.metric === 'VITESSESEUIL1RUNNING')) {
      const p = milieu(c.percent, c.percent_max) / 100;
      if (c.metric === 'FCSEUIL2') return { famille: p >= 0.95 ? 'seuil2' : p >= 0.9 ? 'tempo' : 'ef' };
      return { famille: p >= 0.97 ? (p >= 1.05 ? 'tempo' : 'seuil1') : 'ef' };
    }
    if (c.type === 'raw' && c.unit === 'bpm' && typeof c.value === 'number') {
      const b = milieu(c.value, typeof c.value_max === 'number' ? c.value_max : null);
      if (profil.fc_seuil2 && b >= 0.95 * profil.fc_seuil2) return { famille: 'seuil2' };
      if (profil.fc_seuil1 && b >= 0.97 * profil.fc_seuil1) return { famille: 'seuil1' };
      if (profil.fc_seuil1 || profil.fc_seuil2) return { famille: 'ef' };
    }
    if (c.type === 'zone' && typeof c.zone === 'number' && c.zone >= 3) return { famille: parZone(c.zone) };
  }
  const rpe = cibles.find((c) => c.type === 'rpe' && typeof c.rpe === 'number')?.rpe;
  if (pas.intensity === 'ramp_up' || pas.intensity === 'ramp_down') {
    return { famille: typeof rpe === 'number' && rpe >= 7 ? parRpe(rpe) : 'mecanique' };
  }
  if (typeof rpe === 'number') return { famille: parRpe(rpe) };
  // Une zone basse (Z1, Z2) sans RPE : de l'endurance.
  return cibles.some((c) => c.type === 'zone') ? { famille: 'ef' } : null;
}

// Les minutes d'une étape : sa durée, ou sa distance à sa vitesse (à défaut celle de la VC, sinon 12 km/h).
function minutesDuPas(pas: NoeudNolio, vitesse: number | undefined, profil: ProfilLu): number {
  if (pas.duration?.value) return pas.duration.value / 60;
  if (pas.distance?.value) {
    const metres = pas.distance.unit === 'km' ? pas.distance.value * 1000 : pas.distance.unit === 'mi'
      ? pas.distance.value * 1609.34 : pas.distance.value;
    return metres / (vitesse ?? profil.vc_ms ?? 3.33) / 60;
  }
  return 0;
}

const QUALITES: FamilleLue[] = ['seuil1', 'tempo', 'seuil2', 'vo2max', 'allure', 'sprint', 'mecanique'];

// La famille d'une séance et sa dose : la qualité où elle passe le plus de temps, ses minutes, ses répétitions et la
// durée moyenne de ses blocs ; null pour une séance d'endurance (ou sans structure lisible). rpePrevu : le RPE de la
// séance, quand ses étapes n'en disent rien.
export function classerSeance(workout: NoeudNolio[] | null | undefined, profil: ProfilLu, rpePrevu?: number | null,
  dureeMin?: number | null): Classement | null {
  const minutes = new Map<FamilleLue, number>();
  const reps = new Map<FamilleLue, number>();
  const parcourir = (noeuds: NoeudNolio[], fois: number) => {
    for (const n of noeuds) {
      if (n.kind === 'repeat') {
        parcourir(n.steps ?? [], fois * (n.times ?? 1));
        continue;
      }
      const f = familleDuPas(n, profil);
      if (!f) continue;
      minutes.set(f.famille, (minutes.get(f.famille) ?? 0) + fois * minutesDuPas(n, f.vitesse, profil));
      reps.set(f.famille, (reps.get(f.famille) ?? 0) + fois);
    }
  };
  parcourir(workout ?? [], 1);
  const qualites = QUALITES.filter((f) => (minutes.get(f) ?? 0) > 0);
  if (!qualites.length) {
    // Sans structure lisible : le RPE de la séance, sur sa durée moins l'échauffement et le retour.
    if (!(workout ?? []).length && typeof rpePrevu === 'number' && rpePrevu >= 5 && dureeMin && dureeMin > 30) {
      const m = Math.round(dureeMin - 25);
      return { famille: parRpe(rpePrevu), minutes: m, reps: 1, bloc_min: m };
    }
    return null;
  }
  const famille = qualites.reduce((a, b) => ((minutes.get(b) ?? 0) > (minutes.get(a) ?? 0) ? b : a));
  const m = Math.round((minutes.get(famille) ?? 0) * 10) / 10;
  // Des lignes droites ou quelques accélérations au bout d'une EF (moins de 5 min, après au moins 15 min d'endurance) :
  // la séance reste une EF.
  if (m < 5 && (minutes.get('ef') ?? 0) >= 15) return null;
  const r = reps.get(famille) ?? 1;
  return { famille, minutes: m, reps: r, bloc_min: Math.round((m / r) * 10) / 10 };
}
