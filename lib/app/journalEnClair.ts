// Le journal du moteur en clair pour le coach (les règles du dimanche, cts_ajustements), et les doses lues : partagés par
// l'aperçu du dimanche et le rapport du dimanche.
import { CORRECTIONS, type Correction } from './correctionsTextes';
import type { FamilleLue } from './classement';
import type { Questionnaire, Realise } from './ecriture';
import { jourMois } from './plan';

export const FAMILLE: Record<FamilleLue, string> = {
  ef: 'EF', seuil1: 'Seuil 1', tempo: 'Tempo', seuil2: 'Seuil 2', vo2max: 'VO2max', allure: 'Allure', sprint: 'Sprint',
  mecanique: 'Mécanique',
};

export type Entree = Record<string, unknown>;
export type Dose = { date?: string; minutes?: number; reps?: number; bloc_min?: number; monte?: boolean };

// Une dose lue, en clair : « 3 × 12 min », ou « 25 min » d'un seul bloc.
export const dose = (d: Dose) => (d.reps && d.reps > 1 ? `${d.reps} × ${d.bloc_min} min` : `${Math.round(d.minutes ?? 0)} min`);

// Les réponses du questionnaire du samedi, en clair (décision coach du 01/11/2026) : Nolio affiche les cases du choix multiple
// toujours vides, même cochées ; le site les lit par leur rang et les montre ici. du : le jour de la réponse ; ancienne :
// pas de réponse cette semaine, ce sont les jours de la dernière (S11, décision coach du 05/11/2026).
export function reponsesDuSamedi(q: Questionnaire | undefined, du?: string, ancienne = false): string {
  if (!q) return 'Pas de réponse au questionnaire du samedi : le moteur reprend ses jours habituels.';
  if (ancienne) {
    const nom = (j: string) => j[0].toUpperCase() + j.slice(1);
    return `Pas de réponse au questionnaire de cette semaine : le moteur reprend les jours de sa dernière réponse${du ? `, du ${jourMois(du)}` : ''} (${q.jours.map(nom).join(', ')}${q.jour_sl ? ` ; sortie longue le ${q.jour_sl}` : ''}), sans son nombre de séances.`;
  }
  const nom = (j: string) => j[0].toUpperCase() + j.slice(1);
  const morceaux = [
    q.jours.length ? q.jours.map(nom).join(', ') : 'aucun jour coché lisible',
    q.jour_sl ? `sortie longue le ${q.jour_sl}` : null,
    q.nb_seances ? `${q.nb_seances} séance${q.nb_seances > 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  return `Ses réponses du samedi : ${morceaux.join(' ; ')}.`;
}

// Une ligne du journal du moteur, en clair pour le coach. seances : les noms des séances de la semaine ; la mémoire d'une
// qualité absente de la semaine n'est pas dite (retour coach du 01/11/2026 : « plus de seuil 2 au final ? »).
const QUALITES_NOMMEES = new Set(['seuil1', 'tempo', 'seuil2', 'vo2max']);
// « S5-mer » -> « mercredi » : le jour d'une séance par son identifiant de plan.
const JOURS: Record<string, string> = { lun: 'lundi', mar: 'mardi', mer: 'mercredi', jeu: 'jeudi', ven: 'vendredi', sam: 'samedi', dim: 'dimanche' };
const jourDeLaSeance = (id: unknown) => {
  const j = String(id ?? '').split('-')[1]?.toLowerCase() ?? '';
  return JOURS[j.slice(0, 3)] ?? (j || 'la semaine');
};
// realise : la semaine écoulée (moteur, POST /v1/semaine), pour dire la règle des 60 % en charge tenue (Q17).
export function enClair(e: Entree, seances?: string[], realise?: Pick<Realise, 'charge_prevue' | 'charge_tenue'> | null): string[] {
  const effet = typeof e.effet === 'string' ? e.effet : null;
  switch (e.regle) {
    // Q17 (décision coach du 05/11/2026) : la ligne dit la charge TENUE, la mesure du site (chaque séance comptée au plus
    // à sa prévue) ; la règle décide toujours sur la charge faite. Sans la semaine écoulée, la charge faite, dite telle.
    case 'R1': {
      const tenue = typeof e.charge_tenue_pct === 'number' ? Math.round(e.charge_tenue_pct)
        : realise?.charge_prevue ? Math.round((100 * realise.charge_tenue) / realise.charge_prevue) : null;
      return [`Moins de 60 % de la semaine faite (${tenue !== null ? `charge tenue : ${tenue} % de la prévue` : `${e.charge_faite_pct} % de la charge faite`}) : rien ne se rattrape, les séances clés refont la même marche.`];
    }
    case 'R2': return [`Séance ${String(e.seance ?? '')} ${[e.trop_dur && 'plus dure que prévu', e.ecourtee && 'écourtée'].filter(Boolean).join(' et ')} : sa marche est refaite, sous une autre forme.`];
    case 'R3': return [`Fatigue : ${effet ?? 'semaine allégée'}${Array.isArray(e.signaux) && e.signaux.length ? ` (${(e.signaux as string[]).join(' ; ')})` : ''}.`];
    case 'R4': return [`Arrêt${typeof e.jours === 'number' ? ` de ${e.jours} jours` : ''} : ${effet ?? ''}.`];
    // C3 et C5 (moteur 8.445, décisions coach du 04/11/2026).
    // D1 et D6 (moteur 8.449, décisions coach du 04/11/2026) : retirée, remplacée par une autre famille, ou absente de
    // la semaine que le coach a posée.
    case 'R8': return [e.cause === 'retiree' ? `Ta séance de ${jourDeLaSeance(e.seance)} retirée dans Nolio : sa marche se refait, sous une autre forme.`
      : e.cause === 'remplacee' ? `Ta séance de ${jourDeLaSeance(e.seance)} remplacée par une autre famille : sa marche se refait, sous une autre forme.`
        : e.cause === 'laissee' ? `Ta semaine posée n’avait pas la séance de ${jourDeLaSeance(e.seance)} de la trame : sa marche se refait, sous une autre forme.`
          : `Ta séance de ${jourDeLaSeance(e.seance)} n’a pas été faite : elle revient sous une autre forme.`];
    case 'D6': return ['Ta semaine posée dans Nolio est lue comme une semaine écrite : sa plus longue sortie, son volume, ses séances clés.'];
    case 'C5': return ['Ta seconde course arrive pendant ta récupération : semaine de course, sans séance dure.'];
    // D7 (moteur 8.451, audits du 05/11/2026) : la semaine refusée par le contrôle du moteur, écrite par un repli.
    case 'REPLI': return [`Le contrôle du moteur refusait cette semaine${e.refus ? ` (${String(e.refus)})` : ''} : elle part par un repli, ${
      e.niveau === 1 ? 'la même semaine, sortie longue plafonnée' : e.niveau === 2 ? 'la semaine du plan de l’achat, sortie longue plafonnée' : 'la semaine du plan de l’achat'}.`];
    // EC3 (moteur 8.446) : les corrections du coach sur l'aperçu, appliquées ou non, et la marche refaite la semaine d'après.
    case 'COACH': {
      const quoi = (CORRECTIONS[String(e.correction) as Correction] ?? String(e.correction ?? '')).toLowerCase();
      if (!String(effet ?? '').startsWith('correction du coach')) return [`Ta correction « ${quoi} » de la semaine passée : ${effet ?? ''}.`];
      // « correction du coach : sans qualité, en EF de même durée : … » : le détail, après le nom de la correction.
      const texte = String(effet).replace(/^correction du coach : /, '');
      const detail = (texte.includes(', ') ? texte.slice(texte.indexOf(', ') + 2) : texte).replace(/^impossible : /, '');
      const decale = e.depuis && e.vers ? ` (du ${String(e.depuis)} au ${String(e.vers)})` : '';
      return [e.applique === false ? `Ta correction « ${quoi} » n’a rien changé : ${detail}.` : `Ta correction « ${quoi} » : ${detail}${decale}.`];
    }
    case 'C1':
      if (e.doses && typeof e.doses === 'object') {
        return Object.entries(e.doses as Record<string, Dose>)
          .filter(([f]) => !seances || !QUALITES_NOMMEES.has(f) || seances.some((n) => n.startsWith(FAMILLE[f as FamilleLue] ?? f)))
          .map(([f, d]) => `${FAMILLE[f as FamilleLue] ?? f} : la marche part de la séance du ${d.date ? jourMois(d.date) : '?'} (${dose(d)}) ; ${d.monte ? 'la suivante monte d’une marche' : 'la suivante la refait (RPE au-dessus du prévu)'}.`);
      }
      return [`Sortie longue : la tienne (${e.duree_coach_min} min${e.faite ? ', courue' : ', pas courue'}) fixe la suivante, ${e.plafond_min} min au plus (le plafond de sécurité, +10 %).`];
    // Les autres règles (OM4, S4, TN, R5, R7, CH, O3…) : l'effet écrit par le moteur, en phrase ; jamais le code de la
    // règle ni l'entrée brute (06/11/2026). Sans effet, aucune ligne.
    default: {
      const texte = (effet ?? '').trim();
      return texte ? [`${texte.charAt(0).toUpperCase()}${texte.slice(1)}${/[.!?…]$/.test(texte) ? '' : '.'}`] : [];
    }
  }
}

