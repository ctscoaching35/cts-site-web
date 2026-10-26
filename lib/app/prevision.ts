/**
 * Ce que le moteur prévoit dimanche, d'après les signaux des 7 derniers jours (maquette validée par le coach le
 * 24/10/2026, « Suivi des 7 jours ») : une lecture des règles du dimanche (cts_ajustements.py, REGLES), pas leur calcul,
 * qui se fait sur la semaine entière et sa charge. Rouge : le moteur changera sa semaine ; orange : proche d'un seuil ;
 * vert : rien à signaler ; sans niveau : le moteur n'écrit pas ses semaines. Séparée pour se tester sur des données
 * fabriquées.
 */
import type { Suivi } from './signauxSuivi';

export type Niveau = 'rouge' | 'orange' | 'vert' | 'rien';
export type Prevision = { niveau: Niveau; pourquoi: string; prevoit: string };
// ecrit : le moteur écrit ses semaines (objectif démarré, programmé automatiquement) ; aLaMain : le coach les écrit ;
// pasParti : pourquoi il ne les écrit pas encore — ni objectif ni saison, ou un objectif et le lundi de son départ
// programmé (null : à démarrer).
export type Statut = { ecrit: boolean; aLaMain: boolean; pasParti?: { objectif: boolean; depart: string | null } };

// Le départ programmé au lundi part la veille au soir (lib/app/ecriture.ts, departsDuJour) : « dimanche 1/11 ».
const veille = (lundi: string) => {
  const d = new Date(`${lundi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
};

// R1 : moins de 60 % de la charge faite ; R3 : trois jours à signal en sept jours, dont un d'état (Hooper, ressenti).
const SEMAINE_FAITE_MIN = 0.6;
const FATIGUE_JOURS = 3;

export function prevision(suivi: Suivi, statut: Statut): Prevision {
  if (statut.aLaMain) return { niveau: 'rien', pourquoi: '', prevoit: 'Rien : tu écris ses séances' };
  if (!statut.ecrit) {
    // Pourquoi rien, et ce qui vient (décision coach du 26/10/2026 : « la raison »).
    const p = statut.pasParti;
    const prevoit = !p ? 'Rien : le moteur n’écrit pas ses semaines'
      : !p.objectif ? 'Rien : pas encore de saison, vois « À regarder »'
        : p.depart ? `Sa première semaine part ${veille(p.depart)} au soir` : 'Rien : son objectif est à démarrer';
    return { niveau: 'rien', pourquoi: '', prevoit };
  }
  const fatigue = suivi.signaux.filter((s) => s.genre === 'hooper' || s.genre === 'sensations' || s.genre === 'plus_dur');
  const jours = new Set(fatigue.map((s) => s.jour)).size;
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
  if (suivi.signaux.some((s) => s.genre === 'plus_dur')) {
    return { niveau: 'orange', pourquoi: 'plus dur que prévu', prevoit: 'Si c’est une séance clé : la suivante refait la même marche' };
  }
  return { niveau: 'vert', pourquoi: '', prevoit: 'Semaine normale' };
}

export const RANG: Record<Niveau, number> = { rouge: 0, orange: 1, vert: 2, rien: 3 };
