/**
 * Les mises en forme du dossier de course (lot B) : des chiffres que le moteur rend (FC, allures, étapes d'une séance type),
 * lus pour l'écran. Aucun texte de coaching ici : les phrases du dossier sont celles du moteur (CTS_TEXTES_A_VALIDER.md, AF) ;
 * ne figurent que les mots de la mécanique (« échauffement », « min », « RPE »).
 */
import type { CleZone, EtapeSeance, LigneZone, ReponseCourseLibre } from './courseLibre';

// Les noms des zones (AF.6, brouillon du moteur).
export const NOMS_ZONES: Record<CleZone, string> = { ef: 'Endurance fondamentale', seuil1: 'Seuil 1', tempo: 'Tempo', seuil2: 'Seuil 2', vo2max: 'VO2max' };
export const ORDRE_ZONES: CleZone[] = ['ef', 'seuil1', 'tempo', 'seuil2', 'vo2max'];
export const nomDeZone = (z: string) => NOMS_ZONES[z as CleZone] ?? z;

type Fc = { bas: number | null; haut: number | null } | null | undefined;
// « FC 157 à 165 », « FC sous 147 » (le plafond de l'endurance), « FC au-dessus de 165 » ; null sans repère.
export function texteFc(fc: Fc): string | null {
  if (!fc || (fc.bas == null && fc.haut == null)) return null;
  if (fc.bas == null) return `FC sous ${fc.haut}`;
  if (fc.haut == null) return `FC au-dessus de ${fc.bas}`;
  return `FC ${fc.bas} à ${fc.haut}`;
}
// « 5:23 à 5:02 /km » ; null sans vitesse critique.
export function texteAllure(a: LigneZone['allure'] | undefined): string | null {
  return a && a.lente && a.rapide ? `${a.lente} à ${a.rapide} ${a.unite === 'min/km' ? '/km' : a.unite}` : null;
}

// Les zones dans l'ordre de la grille, avec leurs noms.
export const lignesDeZones = (r: ReponseCourseLibre): LigneZone[] =>
  r.zones ? [...r.zones.lignes].sort((a, b) => ORDRE_ZONES.indexOf(a.zone) - ORDRE_ZONES.indexOf(b.zone)) : [];

const secondes = (s: number) => (s % 60 === 0 && s >= 60 ? `${s / 60} min` : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);
const ROLES: Record<string, string> = { echauffement: 'échauffement', effort: 'effort', recuperation: 'récupération', retour_au_calme: 'retour au calme' };

// Les étapes d'une séance type, une ligne chacune : « Échauffement : 15 min, RPE 3 », « 3 fois : effort 12 min (RPE 5), récupération 2 min (RPE 3) ».
export function lignesDesEtapes(etapes: EtapeSeance[]): string[] {
  const une = (e: EtapeSeance): string => {
    const nom = ROLES[e.role ?? ''] ?? e.role ?? '';
    return `${nom} ${e.duree_s ? secondes(e.duree_s) : ''}${e.rpe ? ` (RPE ${e.rpe})` : ''}`.trim();
  };
  return etapes.map((e) => {
    if (e.etapes && e.repetitions) return `${e.repetitions} fois : ${e.etapes.map(une).join(', ')}`;
    const t = une(e);
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
}
