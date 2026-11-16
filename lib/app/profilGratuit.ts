/**
 * LE PROFIL DE L'APP GRATUITE (lot A1, maquette « Profil » validée par le coach le 16/11/2026) : l'expérience en trail,
 * les trois tests (la vitesse critique, le test de la parole, la FC au seuil 2) et leur calcul. AUCUNE règle nouvelle : la
 * vitesse critique et le style de coureur viennent de lib/app/zones.ts (vitesseCritique, profilCoureur), à l'identique de
 * l'app des acheteurs. Pur : le même calcul tourne dans le navigateur (le visiteur, qui n'enregistre rien) et sur le serveur
 * (le compte gratuit, qui garde ses tests).
 */
import { PROFIL_VIDE, lireDistance, lireDuree, vitesseCritique, type Effort, type Profil } from './zones';

export type Experience = 'debutant' | 'intermediaire' | 'confirme';
// Les phrases de la maquette, mot pour mot.
export const EXPERIENCES: { cle: Experience; titre: string; texte: string }[] = [
  { cle: 'debutant', titre: 'Débutant', texte: 'Moins d’un an de trail, ou peu de dénivelé couru.' },
  { cle: 'intermediaire', titre: 'Intermédiaire', texte: 'Des trails finis, des côtes et des descentes déjà travaillées.' },
  { cle: 'confirme', titre: 'Confirmé', texte: 'Plusieurs saisons, de l’intensité et des sauts déjà pratiqués.' },
];
export const estExperience = (v: unknown): v is Experience => EXPERIENCES.some((e) => e.cle === v);
export const titreExperience = (v: Experience | null) => EXPERIENCES.find((e) => e.cle === v)?.titre.toLowerCase() ?? null;

// Ce que la personne a tapé, tel quel (des textes : « 3 », « 3:00 », « 1020 », « 4:30 »).
export type Saisie = {
  experience: Experience | null;
  e1t: string; e1d: string; e2t: string; e2d: string; // la vitesse critique : deux efforts (durée, distance)
  fc1: string; al1: string; // le test de la parole : FC et allure au premier palier où la respiration coupe
  fc2: string; // la FC au seuil 2, facultative
};
export const SAISIE_VIDE: Saisie = { experience: null, e1t: '', e1d: '', e2t: '', e2d: '', fc1: '', al1: '', fc2: '' };

// Ce qui se garde (jsonb de profils_gratuits.tests).
export type TestsGratuits = {
  vc?: { efforts: [Effort, Effort]; vc_ms: number; d_prime_m: number; le: string };
  parole?: { fc_seuil1: number; v_seuil1_ms: number | null; le: string };
  fc2?: { fc_seuil2: number; le: string };
};

export type Calcul =
  | { ok: true; experience: Experience | null; tests: TestsGratuits; profil: Profil }
  | { ok: false; message: string };

const plein = (t: string) => t.trim() !== '';
const lireFc = (t: string) => {
  const fc = Number(t.trim());
  return Number.isInteger(fc) && fc >= 80 && fc <= 220 ? fc : null;
};

export const aDesFc = (s: Pick<Saisie, 'fc1' | 'fc2'>) => plein(s.fc1) || plein(s.fc2);
export const aDesTests = (t: TestsGratuits) => Boolean(t.vc || t.parole || t.fc2);
export const aDesFcGardees = (t: TestsGratuits) => Boolean(t.parole || t.fc2);

// Le calcul d'une saisie : une erreur dite en clair, ou les tests et le profil de repères qui en sortent. Les mêmes bornes
// que l'app des acheteurs (lib/app/actionsZones.ts) : une FC de 80 à 220, une allure de 2:30 à 12:00 par km, deux efforts de
// 2 à 15 minutes, au moins 5 minutes d'écart.
export function calculer(s: Saisie, jour: string): Calcul {
  const tests: TestsGratuits = {};
  let profil: Profil = { ...PROFIL_VIDE };
  if ([s.e1t, s.e1d, s.e2t, s.e2d].some(plein)) {
    const efforts = [[s.e1t, s.e1d], [s.e2t, s.e2d]].map(([t, d]) => ({ duree_s: lireDuree(t ?? ''), distance_m: lireDistance(d ?? '') }));
    if (efforts.some((e) => e.duree_s === null || e.distance_m === null))
      return { ok: false, message: 'Entre la durée (12 ou 12:00) et la distance (3150 m ou 3,15 km) de chaque effort.' };
    const [a, b] = efforts as [Effort, Effort];
    const vc = vitesseCritique(a, b);
    if ('erreur' in vc) return { ok: false, message: vc.erreur };
    tests.vc = { efforts: [a, b], vc_ms: vc.vc_ms, d_prime_m: vc.d_prime_m, le: jour };
    profil = { ...profil, vc_ms: vc.vc_ms, d_prime_m: vc.d_prime_m, vc_le: jour };
  }
  if (plein(s.fc1) || plein(s.al1)) {
    const fc = lireFc(s.fc1);
    if (fc === null) return { ok: false, message: 'Entre ta FC en battements par minute, entre 80 et 220.' };
    let v: number | null = null;
    if (plein(s.al1)) {
      const t = lireDuree(s.al1);
      if (t === null || t < 150 || t > 720)
        return { ok: false, message: 'Écris ton allure en minutes et secondes, entre 2:30 et 12:00 par km : par exemple 6:00.' };
      v = Math.round((1000 / t) * 1000) / 1000;
    }
    tests.parole = { fc_seuil1: fc, v_seuil1_ms: v, le: jour };
    profil = { ...profil, fc_seuil1: fc, v_seuil1_ms: v, fc_seuil1_le: jour };
  }
  if (plein(s.fc2)) {
    const fc = lireFc(s.fc2);
    if (fc === null) return { ok: false, message: 'Entre ta FC en battements par minute, entre 80 et 220.' };
    // Comme dans l'app des acheteurs (testOuvert) : la FC au seuil 2 attend la vitesse critique.
    if (!tests.vc) return { ok: false, message: 'Ta FC au seuil 2 se mesure une fois ta vitesse critique connue : entre d’abord ton test de vitesse critique.' };
    tests.fc2 = { fc_seuil2: fc, le: jour };
    profil = { ...profil, fc_seuil2: fc, fc_seuil2_le: jour };
  }
  if (!aDesTests(tests) && s.experience === null)
    return { ok: false, message: 'Entre au moins un test, ou ton expérience en trail.' };
  return { ok: true, experience: s.experience, tests, profil };
}

// Sans l'accord de la personne, la FC (une donnée de santé) ne se garde pas : le reste, si.
export const sansLaFc = (t: TestsGratuits): TestsGratuits => (t.vc ? { vc: t.vc } : {});

export const profilDesTests = (t: TestsGratuits): Profil => ({
  ...PROFIL_VIDE,
  vc_ms: t.vc?.vc_ms ?? null, d_prime_m: t.vc?.d_prime_m ?? null, vc_le: t.vc?.le ?? null,
  fc_seuil1: t.parole?.fc_seuil1 ?? null, v_seuil1_ms: t.parole?.v_seuil1_ms ?? null, fc_seuil1_le: t.parole?.le ?? null,
  fc_seuil2: t.fc2?.fc_seuil2 ?? null, fc_seuil2_le: t.fc2?.le ?? null,
});

const minutesSecondes = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
// Ce qui est gardé, remis dans les champs du formulaire.
export function saisieDepuis(experience: Experience | null, t: TestsGratuits): Saisie {
  return {
    experience,
    e1t: t.vc ? minutesSecondes(t.vc.efforts[0].duree_s) : '', e1d: t.vc ? String(Math.round(t.vc.efforts[0].distance_m)) : '',
    e2t: t.vc ? minutesSecondes(t.vc.efforts[1].duree_s) : '', e2d: t.vc ? String(Math.round(t.vc.efforts[1].distance_m)) : '',
    fc1: t.parole ? String(t.parole.fc_seuil1) : '',
    al1: t.parole?.v_seuil1_ms ? minutesSecondes(1000 / t.parole.v_seuil1_ms) : '',
    fc2: t.fc2 ? String(t.fc2.fc_seuil2) : '',
  };
}

// Une saisie lue d'un envoi du navigateur : jamais crue sur parole.
export function saisieSure(brut: unknown): Saisie {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  const t = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).slice(0, 12) : '');
  return {
    experience: estExperience(o.experience) ? o.experience : null,
    e1t: t('e1t'), e1d: t('e1d'), e2t: t('e2t'), e2d: t('e2d'), fc1: t('fc1'), al1: t('al1'), fc2: t('fc2'),
  };
}

// Les tests relus de la base : seulement ce qui a la bonne forme.
export function testsSurs(brut: unknown): TestsGratuits {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, any>;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const out: TestsGratuits = {};
  const e = o.vc?.efforts;
  if (Array.isArray(e) && e.length === 2 && e.every((x) => n(x?.duree_s) !== null && n(x?.distance_m) !== null) && n(o.vc.vc_ms) !== null && n(o.vc.d_prime_m) !== null)
    out.vc = { efforts: [e[0], e[1]], vc_ms: o.vc.vc_ms, d_prime_m: o.vc.d_prime_m, le: String(o.vc.le ?? '') };
  if (n(o.parole?.fc_seuil1) !== null) out.parole = { fc_seuil1: o.parole.fc_seuil1, v_seuil1_ms: n(o.parole.v_seuil1_ms), le: String(o.parole.le ?? '') };
  if (n(o.fc2?.fc_seuil2) !== null) out.fc2 = { fc_seuil2: o.fc2.fc_seuil2, le: String(o.fc2.le ?? '') };
  return out;
}

// Les conseils de la maquette (« Profil »), sous le style de coureur. « Plutôt endurant » : les mots de la maquette ;
// « plutôt rapide » : la même phrase, retournée (À VALIDER par le coach : la maquette ne montre que le cas endurant).
export const CONSEILS_GRATUITS = {
  endurant: {
    loin: 'Plus de vitesse : des intervalles courts, des côtes courtes, des accélérations, sans lâcher ton volume d’endurance.',
    pres: 'Appuie-toi sur ton endurance, et sur ce que demande ta course : sa durée, son dénivelé, son allure.',
  },
  rapide: {
    loin: 'Plus d’endurance : des blocs longs juste sous ta vitesse critique, du tempo, du seuil 1, du volume, avec quelques rappels de vitesse.',
    pres: 'Appuie-toi sur ta vitesse, et sur ce que demande ta course : sa durée, son dénivelé, son allure.',
  },
  note: 'Ce style oriente ton entraînement ; tes sensations et ton objectif décident.',
};
