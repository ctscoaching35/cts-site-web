/**
 * LE CLASSEMENT D'UNE SÉANCE PAR SA STRUCTURE (la continuité, décisions coach du 26/10/2026, CTS_CONTINUITE_REFLEXION.md
 * dans le dépôt du moteur, décision 2) : le temps passé à chaque intensité, lu dans les étapes de la séance prévue,
 * donne sa famille et sa dose, quel qu'en soit l'auteur ou le nom. Chaque étape de travail prend la cible la plus
 * précise qu'elle porte : l'allure visée, le % de la vitesse critique (ou une allure en clair rapportée à la VC de
 * l'athlète), le % de la FC aux seuils (ou des pulsations en clair rapportées à ses seuils), la zone (l'échelle commune,
 * aux numéros du coach), le RPE à défaut ; une montée ou une descente sans autre cible est de la mécanique. Une séance
 * de la barre latérale a sa famille par son nom (C1, classerSeanceNommee). Fonctions pures : aucune lecture ici
 * (lib/app/continuite.ts lit Nolio).
 */
import { FAMILLES_DE_LA_BARRE } from './barreFamilles';
import { lireCode, TRANCHENT_HORS_QUALITE } from './codeSeance';
import { autreEcriture } from './nomsSeances';

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
      // Les cibles de la barre (C1, audit du 03/11/2026) : Seuil 2 à 95-100 % (milieu 97,5), Tempo à 93-97 % (milieu
      // 95), VO2max au-delà de 100 %. À 95 %, le Tempo se lisait Seuil 2 et la VO2max aussi.
      if (c.metric === 'FCSEUIL2') return { famille: p >= 1.0 ? 'vo2max' : p >= 0.965 ? 'seuil2' : p >= 0.9 ? 'tempo' : 'ef' };
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

// Les étapes qui ne sont pas du travail dans une séance en montées répétées (D5, décision coach du 04/11/2026, « A ») :
// les descentes et les récupérations.
const HORS_TRAVAIL = new Set(['ramp_down', 'rest']);

// Les minutes et les répétitions de chaque famille dans les étapes d'une séance ; travailSeul : sans les descentes ni les
// récupérations (HORS_TRAVAIL).
function parFamille(workout: NoeudNolio[], profil: ProfilLu, travailSeul = false) {
  const minutes = new Map<FamilleLue, number>();
  const reps = new Map<FamilleLue, number>();
  const parcourir = (noeuds: NoeudNolio[], fois: number) => {
    for (const n of noeuds) {
      if (n.kind === 'repeat') {
        parcourir(n.steps ?? [], fois * (n.times ?? 1));
        continue;
      }
      if (travailSeul && HORS_TRAVAIL.has(String(n.intensity))) continue;
      const f = familleDuPas(n, profil);
      if (!f) continue;
      minutes.set(f.famille, (minutes.get(f.famille) ?? 0) + fois * minutesDuPas(n, f.vitesse, profil));
      reps.set(f.famille, (reps.get(f.famille) ?? 0) + fois);
    }
  };
  parcourir(workout, 1);
  return { minutes, reps };
}

const arrondi = (x: number) => Math.round(x * 10) / 10;

// La famille d'une séance et sa dose : la qualité où elle passe le plus de temps, ses minutes, ses répétitions et la
// durée moyenne de ses blocs ; null pour une séance d'endurance (ou sans structure lisible, D2 du 10/11/2026). Le RPE prévu
// et la durée ne classent plus une séance sans étapes ; gardés dans la signature pour ses appelants.
export function classerSeance(workout: NoeudNolio[] | null | undefined, profil: ProfilLu, _rpePrevu?: number | null,
  _dureeMin?: number | null): Classement | null {
  const { minutes, reps } = parFamille(workout ?? [], profil);
  const qualites = QUALITES.filter((f) => (minutes.get(f) ?? 0) > 0);
  if (!qualites.length) {
    // D2 (accord du coach du 10/11/2026, au soir) : une séance sans étapes (une note seule, « Séance piste club », RPE 8,
    // 1 h 15) compte comme faite pour le volume (son activité), mais ne fixe aucune marche d'échelle : hors des qualités,
    // comme une EF. Avant, son RPE sur sa durée moins 25 min : 50 min de VO2max, une échelle faussée.
    return null;
  }
  const famille = qualites.reduce((a, b) => ((minutes.get(b) ?? 0) > (minutes.get(a) ?? 0) ? b : a));
  const m = arrondi(minutes.get(famille) ?? 0);
  // Des lignes droites ou quelques accélérations au bout d'une EF (moins de 5 min, après au moins 15 min d'endurance) :
  // la séance reste une EF.
  if (m < 5 && (minutes.get('ef') ?? 0) >= 15) return null;
  const r = reps.get(famille) ?? 1;
  return { famille, minutes: m, reps: r, bloc_min: arrondi(m / r) };
}

export const nomNormal = (nom: string) => nom.normalize('NFC').replace(/\s+/g, ' ').trim();

// C1 (décision coach du 04/11/2026, « A ») : une séance de la barre latérale (son nom, lib/app/barreFamilles.ts) a sa
// famille par son nom, sûre ; sa structure donne la dose, toutes ses étapes de qualité comptées (un Tempo dont la FC
// se lirait Seuil 2, un sprint en côte trop court pour sortir d'une EF) — sauf, hors de la mécanique, les descentes et
// les récupérations d'une séance en montées répétées (D5, 04/11/2026 : « Seuil 1 côte · 30 min — 6 × 5 min » se lisait
// 42 min, ses descentes comptées). Hors de la barre, la structure seule.
export function classerSeanceNommee(nom: string | null | undefined, workout: NoeudNolio[] | null | undefined, profil: ProfilLu,
  rpePrevu?: number | null, dureeMin?: number | null): Classement | null {
  const c = classerSeance(workout, profil, rpePrevu, dureeMin);
  // LE CODE EN TÊTE DU NOM (décision 12-5 du coach, 09/11/2026 ; lib/app/codeSeance.ts) : une séance de la barre en
  // séances clés en main, ou écrite par le moteur 8.461, a sa famille par son code, même si le coach a changé son chiffre
  // (« S2c 6×3′/1′ R ») ; sa structure donne la dose. Une sortie longue, un week-end choc, un test, un renfo ou un sport
  // croisé ne sont jamais une qualité, quels que soient leurs blocs ; une EF, une récupération, une activation se lisent
  // par leur contenu. Sans code : les noms de l'ancienne barre (lib/app/barreFamilles.ts), puis le contenu.
  const lu = nom ? lireCode(nom) : null;
  if (lu && TRANCHENT_HORS_QUALITE.includes(lu.famille)) return null;
  // Une EF à fin courte (sprints ou descentes en côte, lignes droites), une récupération, une activation : une EF, même
  // quand ses montées et ses descentes se liraient mécanique ; seul un vrai bloc de qualité (le coach l'a changée) compte.
  if (lu && !lu.lue) return c && ['seuil1', 'tempo', 'seuil2', 'vo2max', 'allure'].includes(c.famille) ? c : null;
  // Q2 (05/11/2026 au soir) : un nom de la barre sous l'ancienne ou la nouvelle écriture du week-end choc
  // (lib/app/nomsSeances.ts), quelle que soit celle que lib/app/barreFamilles.ts a gardée.
  const famille = lu?.lue ?? (nom ? FAMILLES_DE_LA_BARRE[nomNormal(nom)] ?? FAMILLES_DE_LA_BARRE[nomNormal(autreEcriture(nomNormal(nom)))] : undefined);
  if (!famille) return c;
  // La dose d'une séance codée (hors mécanique) : ses efforts, chaque étape de travail ou de montée à RPE 4 et plus ou à
  // la cible d'une qualité (cts_barre.travail_min, la même lecture que le moteur). Les cibles de la barre clés en main
  // visent la zone 2 au Seuil 1 (« Z2 FC » et RPE 4 ou 5) : lues étape par étape, elles se liraient EF.
  if (lu?.lue && famille !== 'mecanique') {
    let minutes = 0;
    let reps = 0;
    const parcourir = (noeuds: NoeudNolio[], fois: number) => {
      for (const n of noeuds) {
        if (n.kind === 'repeat') { parcourir(n.steps ?? [], fois * (n.times ?? 1)); continue; }
        if (n.intensity !== 'work' && n.intensity !== 'ramp_up') continue;
        const r = (n.targets ?? []).find((t) => t.type === 'rpe' && typeof t.rpe === 'number')?.rpe;
        const f = familleDuPas(n, profil);
        if (!((typeof r === 'number' && r >= 4) || (f && QUALITES.includes(f.famille) && f.famille !== 'mecanique'))) continue;
        minutes += fois * minutesDuPas(n, f?.vitesse, profil);
        reps += fois;
      }
    };
    parcourir(workout ?? [], 1);
    if (minutes > 0) {
      const m = arrondi(minutes);
      return { famille, minutes: m, reps: reps || 1, bloc_min: arrondi(m / (reps || 1)) };
    }
  }
  const { minutes, reps } = parFamille(workout ?? [], profil, famille !== 'mecanique');
  const travail = QUALITES.reduce((t, f) => t + (minutes.get(f) ?? 0), 0);
  if (travail > 0) {
    const r = QUALITES.reduce((t, f) => t + (reps.get(f) ?? 0), 0) || 1;
    const m = arrondi(travail);
    return { famille, minutes: m, reps: r, bloc_min: arrondi(m / r) };
  }
  return c ? { ...c, famille } : null;
}
