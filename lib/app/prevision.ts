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

// depuis : le lundi de la semaine que le passage du dimanche jugera.
export function prevision(suivi: Suivi, depuis: string): Prevision {
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
      prevoit: 'Si sa charge reste sous 60 % : ses séances clés refont la même marche' };
  }
  if (signaux.some((s) => s.genre === 'plus_dur')) {
    return { niveau: 'orange', pourquoi: 'plus dur que prévu', prevoit: 'Si c’est une séance clé : la suivante refait la même marche' };
  }
  return { niveau: 'vert', pourquoi: '', prevoit: 'Semaine normale' };
}

export const RANG: Record<Niveau, number> = { rouge: 0, orange: 1, vert: 2, rien: 3 };
