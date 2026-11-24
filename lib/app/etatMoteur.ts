// Fonctions pures, sans réseau ni base : PRÉPARÉ, PAS BRANCHÉ (rien ne les lit encore ; scripts/test-ecriture-v9.mjs).
/**
 * L'ÉTAT DU MOTEUR v1, GARDÉ PAR PLAN (CONTRAT_API_CTS.md, « MOTEUR v1 » : « `etat` : ce que le moteur a rendu l'appel d'avant, tel quel (le
 * site le garde) ; réécrire une semaine (une nouvelle réponse avant sa première séance) rend le même `numero` avec le même `etat` d'avant »).
 *
 * Ce que le site garde (supabase/migrations/20261124120000_etat_du_moteur_v1.sql, écrite, pas appliquée) :
 *   - `plans.etat_moteur` : l'état rendu par la dernière écriture, ou par la dernière réponse tardive ;
 *   - par semaine écrite (`semaines_ecrites`, `moteur = '9.0'`), `etat_avant_moteur` : l'état que le moteur a REÇU pour l'écrire, rien pour la
 *     première. Réécrire cette semaine, c'est le lui rendre : le moteur remplace la semaine et refait le même état.
 * L'état d'une 8.x (`plans.etat_ecriture`, `semaines_ecrites.etat_avant`) n'est jamais lu ici ni modifié : un retour à la 8.474 retrouve les siens.
 */
import { etatV9 } from './moteurV9';

export type Etat = Record<string, unknown>;
export type SemaineGardee = { numero: number; etatAvant: Etat | null };
export type EtatDuPlan = { courant: Etat | null; ecrites: SemaineGardee[] };

export const ETAT_VIDE: EtatDuPlan = { courant: null, ecrites: [] };

export type ChoixDeLEtat = { etat: Etat | null; reecrite: boolean };

/**
 * L'état à rendre au moteur pour écrire la semaine `numero`.
 *   - une semaine déjà écrite se réécrit avec l'état d'avant elle, et seulement si c'est la dernière (une plus ancienne ferait reculer la
 *     suite de la préparation, comme « Annuler » aujourd'hui) ;
 *   - sinon, l'état de la dernière écriture ; un plan qui n'a jamais été écrit par le moteur v1 part sans état (une 8.x n'est pas lue) ;
 *   - une semaine plus ancienne que la dernière écrite, jamais écrite, est refusée.
 */
export function etatPourEcrire(e: EtatDuPlan, numero: number): ChoixDeLEtat {
  const derniere = e.ecrites.reduce((m, w) => Math.max(m, w.numero), 0);
  const deja = e.ecrites.find((w) => w.numero === numero);
  if (deja) {
    if (numero !== derniere) {
      throw new Error(`La semaine ${numero} n'est pas la dernière écrite (${derniere}) : une plus ancienne ne se réécrit pas, la suite de la préparation en dépend.`);
    }
    return { etat: etatV9(deja.etatAvant) ? deja.etatAvant : null, reecrite: true };
  }
  if (numero < derniere) throw new Error(`La semaine ${numero} précède la dernière écrite (${derniere}) : elle ne s'écrit plus.`);
  return { etat: etatV9(e.courant) ? e.courant : null, reecrite: false };
}

/** Ce que le plan garde après une écriture : le nouvel état, et l'état qui a servi à écrire cette semaine (pour la réécrire). */
export function apresUneEcriture(e: EtatDuPlan, numero: number, etatUtilise: Etat | null, etatRendu: Etat): EtatDuPlan {
  return { courant: etatRendu, ecrites: [...e.ecrites.filter((w) => w.numero !== numero), { numero, etatAvant: etatUtilise }].sort((a, b) => a.numero - b.numero) };
}

/** Ce que le plan garde après une réponse tardive : le nouvel état seul, les semaines gardées n'y touchent pas. */
export const apresUneReponseTardive = (e: EtatDuPlan, etatRendu: Etat): EtatDuPlan => ({ ...e, courant: etatRendu });
