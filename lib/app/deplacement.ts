/**
 * Déplacer une séance dans la semaine (cadrage de l'app §7.2, décisions coach E1 à E6 du 08/10/2026).
 * L'athlète échange deux jours de la même semaine, séance ou repos (E2). Le plan vendu ne change pas
 * (5.5) : l'app le range autrement. Un jour est « moins propice » quand l'échange crée une entorse à une
 * règle du moteur (plan.deplacement, v8.313) ; seules comptent les entorses qu'il crée, pas celles que le
 * moteur a posées lui-même (E3). Rien n'est interdit. Ne bougent pas : un jour passé, une séance déjà
 * renseignée, la course, sa veille et ce qui suit.
 */
import { ajouterJours, tousLesJours, type Jour, type Plan, type RegleDeplacement, type Semaine } from './plan';
import type { Retours } from './journal';

// Où est rangée chaque séance déplacée : jour_id -> date ISO (la table deplacements).
export type Deplacements = Record<string, string>;

// Textes validés par le coach le 08/10/2026 (« option 1 »).
export const TEXTES = {
  bouton: 'Changer de jour',
  intro: 'Choisis le jour où courir cette séance : elle échange sa place avec ce qui est prévu ce jour-là.',
  prevuIci: 'Prévue ici',
  moinsPropice: 'Moins propice : ',
  sousLaListe: 'Un jour en rouge reste possible : il va contre une règle de ton plan, et la raison est écrite dessous. À toi de juger.',
  echanger: 'Échanger',
  remettre: 'Remettre la semaine comme prévue',
  // Un plan d'avant le moteur 8.313 n'a pas les classes des jours (E6) : le mode d'emploi de ces plans.
  sansRegles:
    'Les jours de ce plan ne sont pas colorés. Garde en tête les règles de ton mode d’emploi : deux séances à RPE 7 ou plus ne se suivent jamais, et garde au moins deux jours entre une navette dont la descente se court à l’allure de course et ta sortie longue.',
} as const;

// « Déplacée · prévue mardi »
export const mentionDeplacee = (j: Jour) => (j.prevu ? `Déplacée · prévue ${j.prevu.jour.toLowerCase()}` : null);

// Le plan rangé : chaque jour de la semaine (sa date, son nom) reçoit la séance qui y est rangée, avec
// son jour prévu. Une semaine dont les déplacements ne forment pas un échange complet reste comme prévue.
export function ranger(plan: Plan, deplacements: Deplacements): Plan {
  if (!Object.keys(deplacements).length) return plan;
  return {
    ...plan,
    semaines: plan.semaines.map((s) => {
      if (!s.jours.some((j) => deplacements[j.id])) return s;
      const parDate = new Map<string, Jour>();
      for (const j of s.jours) {
        const date = deplacements[j.id] ?? j.date_iso;
        if (!date || parDate.has(date)) return s;
        parDate.set(date, j);
      }
      if (s.jours.some((place) => !place.date_iso || !parDate.has(place.date_iso))) return s;
      const jours = s.jours.map((place) => {
        const j = parDate.get(place.date_iso!)!;
        return j.id === place.id
          ? j
          : { ...j, jour: place.jour, date: place.date, date_iso: place.date_iso, prevu: { jour: j.jour, date_iso: j.date_iso } };
      });
      return { ...s, jours };
    }),
  };
}

// L'échange de deux séances de la même semaine (E2) : chacune prend le jour de l'autre. Une séance
// revenue à son jour prévu n'a plus de ligne. prevu : le plan tel que généré.
export function echanger(prevu: Plan, deplacements: Deplacements, a: string, b: string): Deplacements {
  const origine = new Map(tousLesJours(prevu).map((j) => [j.id, j.date_iso]));
  const ou = (id: string) => deplacements[id] ?? origine.get(id) ?? null;
  const [da, db] = [ou(a), ou(b)];
  const out = { ...deplacements };
  const poser = (id: string, date: string | null) => {
    if (!date || date === origine.get(id)) delete out[id];
    else out[id] = date;
  };
  poser(a, db);
  poser(b, da);
  return out;
}

// Pourquoi un jour ne bouge pas, ou null. j : un jour du plan rangé.
export type Blocage = 'Passé' | 'Déjà renseignée' | 'Jour de course' | 'Veille de course' | 'Après la course';
export function blocage(j: Jour, plan: Plan, retours: Retours, aujourdhui: string): Blocage | null {
  const d = j.date_iso;
  if (!d || d < aujourdhui) return 'Passé';
  const course = plan.course.date;
  const veille = ajouterJours(course, -1);
  // Le moteur dit les jours fixes (v8.313) ; un plan plus ancien, par la date de la course.
  if (j.placement ? j.placement.fixe : d >= veille) {
    return d === course ? 'Jour de course' : d === veille ? 'Veille de course' : 'Après la course';
  }
  if (retours[j.id]) return 'Déjà renseignée';
  return null;
}

// Le bouton « Changer de jour » d'une séance (E4).
export const peutChanger = (j: Jour, plan: Plan, retours: Retours, aujourdhui: string) =>
  j.famille !== 'repos' && j.famille !== 'course' && blocage(j, plan, retours, aujourdhui) === null;

// « Remettre la semaine comme prévue » (E5) : tant que rien de passé ni de renseigné n'y bougerait.
export function peutRemettre(semaine: Semaine, retours: Retours, aujourdhui: string) {
  const deplacees = semaine.jours.filter((j) => j.prevu);
  return deplacees.length > 0
    && deplacees.every((j) => !retours[j.id] && j.date_iso! >= aujourdhui && (j.prevu!.date_iso ?? '') >= aujourdhui);
}

// Les entorses du plan rangé : deux jours de classes a et b à moins de ecart_min jours, jointure des
// semaines comprise. Une règle à deux classes égales ne connaît pas d'ordre ; sinon l'ordre compte (la
// veille de la sortie longue n'est pas son lendemain).
function entorses(plan: Plan, regles: RegleDeplacement[]): Set<string> {
  const jours = tousLesJours(plan);
  const parDate = new Map(jours.filter((j) => j.date_iso).map((j) => [j.date_iso!, j]));
  const out = new Set<string>();
  for (const r of regles) {
    for (const x of jours) {
      if (!x.date_iso || !x.placement?.etiquettes.includes(r.a)) continue;
      for (let e = 1 - r.ecart_min; e <= r.ecart_min - 1; e++) {
        const y = e === 0 ? undefined : parDate.get(ajouterJours(x.date_iso, e));
        if (!y || !y.placement?.etiquettes.includes(r.b)) continue;
        out.add(r.a === r.b ? `${r.cle}|${[x.id, y.id].sort().join('|')}` : `${r.cle}|${x.id}|${y.id}|${Math.sign(e)}`);
      }
    }
  }
  return out;
}

// Les sept jours proposés pour une séance (E3, E4) : ce qui y est rangé, s'il bouge, et les raisons
// des entorses que l'échange créerait. prevu : le plan tel que généré.
export type Choix = { jour: Jour; actuel: boolean; prevuIci: boolean; blocage: Blocage | null; raisons: string[] };
export function choixDuJour(prevu: Plan, deplacements: Deplacements, jourId: string, retours: Retours, aujourdhui: string): Choix[] | null {
  const range = ranger(prevu, deplacements);
  const semaine = range.semaines.find((s) => s.jours.some((j) => j.id === jourId));
  if (!semaine) return null;
  const seance = semaine.jours.find((j) => j.id === jourId)!;
  const prevuLe = seance.prevu?.date_iso ?? seance.date_iso;
  const regles = prevu.deplacement?.regles ?? null;
  const avant = regles ? entorses(range, regles) : new Set<string>();
  return semaine.jours.map((j) => {
    const actuel = j.id === jourId;
    const bloque = actuel ? null : blocage(j, range, retours, aujourdhui);
    let raisons: string[] = [];
    if (regles && !actuel && !bloque) {
      const apres = entorses(ranger(prevu, echanger(prevu, deplacements, jourId, j.id)), regles);
      const creees = new Set([...apres].filter((k) => !avant.has(k)).map((k) => k.split('|')[0]));
      raisons = regles.filter((r) => creees.has(r.cle)).map((r) => r.raison);
    }
    return { jour: j, actuel, prevuIci: j.date_iso === prevuLe, blocage: bloque, raisons };
  });
}
