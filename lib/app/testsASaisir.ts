// Aucun réseau ni base : les tests que la v1 a écrits et dont le résultat n'est pas encore saisi (scripts/test-tests-a-saisir.mjs).
/**
 * « SAISIR LE RÉSULTAT DE SON TEST », SOUS LA 9.x (décision du coach du 25/11/2026) : la v1 écrit des tests dans ses semaines (`famille: "test"` : la vitesse critique, la FC au seuil 2, la parole pour la FC
 * au seuil 1 ; CONTRAT_API_CTS.md), mais le site ne les relit plus dans Nolio sous la 9.x (lib/app/cacherSousLaV1.ts, (d)). Personne ne saurait donc qu'un test est fait. Le lundi qui suit une semaine où la v1
 * a écrit un test, « À faire pour lui » dit « Saisir le résultat de son test de vitesse critique » (ou « de fréquence cardiaque »), avec le geste qui existe déjà : « Saisir son test de vitesse critique » ou
 * « Modifier ses repères » (la carte de coureur, lib/app/pageAthleteSimple.ts). Le point disparaît dès que le résultat est saisi, par le coach ou par l'athlète dans son app : la fiche garde, pour chaque repère, le jour
 * de sa saisie (`athletes_coaches.reperes_sources`) ; un repère saisi le jour du test ou après le clôt. Un test vieux de plus de huit semaines n'est plus rappelé.
 */
export type TestAEcrit = { forme: string; jour: string; lundi: string };
export type SemaineEcrite = { lundi: string | null; jours: unknown };
export type SourcesDesReperes = Record<string, { le?: string } | undefined>;

// Les trois tests de la v1 (`forme` de la séance) : le repère qu'ils donnent, le mot du coach, le geste de la carte qui le saisit.
export const TESTS_DE_LA_V1 = {
  'vitesse critique': { cle: 'vc_ms', mot: 'vitesse critique', geste: 'test_vc' },
  'FC au seuil 2': { cle: 'fc_seuil2', mot: 'fréquence cardiaque', geste: 'reperes' },
  parole: { cle: 'fc_seuil1', mot: 'fréquence cardiaque', geste: 'reperes' },
} as const;
export type FormeDeTest = keyof typeof TESTS_DE_LA_V1;
const estUneForme = (f: unknown): f is FormeDeTest => typeof f === 'string' && Object.prototype.hasOwnProperty.call(TESTS_DE_LA_V1, f);

// L'adresse de chaque geste dans la carte de coureur (components/app/CarteCoureur.tsx) : le lien ouvre son formulaire.
export const ANCRE_DU_GESTE = { test_vc: '#geste-test-vc', reperes: '#geste-reperes' } as const;

export const TEXTES_TESTS = {
  saisir: (mot: string) => `Saisir le résultat de son test de ${mot}`,
} as const;

const ajouterJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const estUnJour = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Les tests d'une semaine écrite par la v1 : ses jours (`jours[].seance`, famille « test », forme reconnue), chacun avec son jour (sa date, sinon le lundi).
export function testsDeLaSemaine(s: SemaineEcrite): TestAEcrit[] {
  if (!estUnJour(s.lundi) || !Array.isArray(s.jours)) return [];
  const lundi = s.lundi;
  return s.jours.flatMap((j): TestAEcrit[] => {
    const seance = (j as { seance?: { famille?: unknown; forme?: unknown } | null } | null)?.seance;
    if (seance?.famille !== 'test' || !estUneForme(seance.forme)) return [];
    const date = (j as { date?: unknown }).date;
    return [{ forme: seance.forme, jour: estUnJour(date) ? date : lundi, lundi }];
  });
}

export type TestASaisir = { mot: string; geste: 'test_vc' | 'reperes'; jour: string };

/**
 * Les tests dont le résultat est à saisir : écrits dans une semaine de moins de huit semaines, dont le lundi d'après est venu (`aujourdhui` ≥ lundi + 7), et dont le repère n'a pas été saisi le jour du test ou
 * après (`sources[cle].le >= jour`). Un seul point par mot (la vitesse critique, la fréquence cardiaque), le test le plus récent ; la vitesse critique d'abord.
 */
export function testsASaisir({ semaines, sources, aujourdhui, fenetreEnJours = 56 }: {
  semaines: SemaineEcrite[]; sources?: SourcesDesReperes | null; aujourdhui: string; fenetreEnJours?: number;
}): TestASaisir[] {
  const depuis = ajouterJours(aujourdhui, -fenetreEnJours);
  const parMot = new Map<string, TestASaisir>();
  for (const s of semaines) {
    for (const t of testsDeLaSemaine(s)) {
      if (aujourdhui < ajouterJours(t.lundi, 7) || t.lundi < depuis) continue;
      const { cle, mot, geste } = TESTS_DE_LA_V1[t.forme as FormeDeTest];
      const saisi = sources?.[cle]?.le;
      if (typeof saisi === 'string' && saisi >= t.jour) continue;
      const deja = parMot.get(mot);
      if (!deja || t.jour > deja.jour) parMot.set(mot, { mot, geste, jour: t.jour });
    }
  }
  return [...parMot.values()].sort((a, b) => (a.geste === b.geste ? 0 : a.geste === 'test_vc' ? -1 : 1));
}
