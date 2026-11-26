/**
 * Ce que le moteur prévoit dimanche, d'après les signaux gardés du soir (maquette validée par le coach le 24/10/2026 ;
 * « Dimanche », EC4) : une lecture des règles du dimanche (cts_ajustements.py, REGLES), pas leur calcul, qui se fait sur
 * la semaine entière et sa charge. Rouge : le moteur changera sa semaine ; orange : proche d'un seuil ; vert : rien à
 * signaler. Séparée pour se tester sur des données fabriquées.
 *
 * LA FENÊTRE DES SIGNAUX (04/11/2026, Thomas dans la démonstration : « Dimanche » le disait rouge, « fatigue franche »,
 * quand son aperçu disait « Rien : la semaine suit le plan ») : les signaux du soir couvrent les 7 derniers jours, le
 * moteur juge la semaine qui finit le dimanche du passage (signaux_fatigue, du lundi au dimanche). Le samedi, les
 * 7 derniers jours prenaient encore le week-end d'avant, déjà jugé au passage précédent. Seuls comptent ici les signaux
 * datés de la semaine que le passage jugera (depuis son lundi).
 */
import type { Suivi } from './signauxSuivi';

export type Niveau = 'rouge' | 'orange' | 'vert' | 'rien';
export type Prevision = { niveau: Niveau; pourquoi: string; prevoit: string };

// R1 : moins de 60 % de la charge faite ; R3 : trois jours à signal en sept jours, dont un d'état (Hooper, ressenti).
const SEMAINE_FAITE_MIN = 0.6;
const FATIGUE_JOURS = 3;

// Les deux phrases de « ce que le moteur prévoit » qui parlent de la marche : celles d'avant par défaut ; le coach lit les siennes sous la 9.x
// (lib/app/motsDuCoach.ts, décision 220 du coach, 24/11/2026).
export type TextesPrevision = { sousSoixante: string; plusDur: string };
export const TEXTES_PREVISION_D_AVANT: TextesPrevision = {
  sousSoixante: 'Si sa charge reste sous 60 % : ses séances clés refont la même marche',
  plusDur: 'Si c’est une séance clé : la suivante refait la même marche',
};

// depuis : le lundi de la semaine que le passage du dimanche jugera.
export function prevision(suivi: Suivi, depuis: string, textes: TextesPrevision = TEXTES_PREVISION_D_AVANT): Prevision {
  const signaux = suivi.signaux.filter((s) => s.jour.slice(0, 10) >= depuis);
  const fatigue = signaux.filter((s) => s.genre === 'hooper' || s.genre === 'sensations' || s.genre === 'plus_dur');
  const jours = new Set(fatigue.map((s) => s.jour.slice(0, 10))).size;
  const etat = fatigue.some((s) => s.genre === 'hooper' || s.genre === 'sensations');
  // R4 : sept jours sans séance.
  if (suivi.prevues > 0 && suivi.faites === 0) {
    return { niveau: 'rouge', pourquoi: 'aucune séance en 7 jours', prevoit: 'Reprise adaptée après l’arrêt, si rien d’ici dimanche' };
  }
  if (jours >= FATIGUE_JOURS && etat) {
    return { niveau: 'rouge', pourquoi: `fatigue sur ${jours} jours`, prevoit: 'Semaine allégée (fatigue franche), probable' };
  }
  if (jours === FATIGUE_JOURS - 1 && etat) {
    return { niveau: 'orange', pourquoi: `fatigue sur ${jours} jours`, prevoit: 'Semaine normale ; un jour de signal de plus et elle s’allège' };
  }
  if (suivi.prevues > 0 && suivi.faites / suivi.prevues < SEMAINE_FAITE_MIN) {
    return { niveau: 'orange', pourquoi: `${suivi.faites} séance${suivi.faites > 1 ? 's' : ''} sur ${suivi.prevues}`,
      prevoit: textes.sousSoixante };
  }
  // La pastille dit la séance (272) : « Seuil 2 de mardi : RPE 7 pour 5 prévu », la plus récente, et les autres comptées.
  const durs = signaux.filter((s) => s.genre === 'plus_dur').sort((a, b) => b.jour.localeCompare(a.jour));
  if (durs.length) {
    const jour = new Date(`${durs[0].jour.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
    const autres = durs.length - 1;
    return { niveau: 'orange', pourquoi: `${durs[0].type ?? 'Séance'} de ${jour} : ${durs[0].detail}${autres ? `, et ${autres} autre${autres > 1 ? 's' : ''}` : ''}`, prevoit: textes.plusDur };
  }
  return { niveau: 'vert', pourquoi: '', prevoit: 'Semaine normale' };
}

export const RANG: Record<Niveau, number> = { rouge: 0, orange: 1, vert: 2, rien: 3 };
