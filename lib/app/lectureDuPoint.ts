/**
 * CE QUE LE COACH LIT DU POINT DU DIMANCHE, SOUS LA 9.x (pilote du Moteur, 26/11/2026) : ses réponses sur la page de chaque coaché, et l'alerte d'arrêt, « c'est la santé » : sur sa page et dans « Mes athlètes »
 * (« Arrêt signalé »). La 8.x la tirait du journal de ses semaines, que la 9.x n'écrit pas : elle se lit désormais des réponses, de tout arrêt dit (quelques jours ou toute la semaine). En automatique, d'après les
 * réponses gardées avec les semaines écrites ; à la main, lues dans Nolio (elles ne sont pas gardées). Côté serveur ; les textes sont lus par le coach seul.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { destinataire } from './coaching';
import { lireReponsesDimanche, NOM_DU_QUESTIONNAIRE, type ItemRepondu, type ReponsesDimanche } from './dimancheV9';
import type { Point } from './espaceParAthlete';
import { listeNolio } from './nolio';
import { ajouterJours } from './plan';
import { QUESTION_OUVERTE } from './questionnaireSamedi';
import { MOTEUR_ECRIT } from './stockageV9';

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

type Resultat = { id: string; name?: string; date_start: string; quiz_planned?: string; items?: ItemRepondu[] };

// Ses réponses à « Ton point du dimanche » entre deux jours, la plus récente d'abord : celles du questionnaire posé (son identifiant), ou de ce nom.
export async function reponsesAuPoint(usr: string, du: string, au: string, nolioId?: string | null): Promise<Resultat[]> {
  const d = await destinataire(usr);
  const resultats = await listeNolio<Resultat>(`real/quiz_results/?date_from=${du}&date_to=${au}${d.moi ? '' : `&athlete=${d.usr}`}`);
  return resultats.filter((r) => (nolioId && r.quiz_planned === nolioId) || String(r.name ?? '').trim().toLowerCase() === NOM_DU_QUESTIONNAIRE.toLowerCase())
    .sort((a, b) => b.date_start.localeCompare(a.date_start));
}

// Ce que sa page montre : sa dernière réponse des 10 derniers jours ; null sans réponse. La cause d'un arrêt avec son accord de lecture seulement ; `mot` : il a écrit à la question ouverte (le texte se lit dans Nolio).
export type PointLu = { date: string; reponses: ReponsesDimanche; mot: boolean };
export async function lireSonPoint(usr: string, accord: boolean, nolioId?: string | null, aujourdhui = aujourdhuiParis()): Promise<PointLu | null> {
  const [dernier] = await reponsesAuPoint(usr, ajouterJours(aujourdhui, -10), aujourdhui, nolioId);
  if (!dernier) return null;
  const items = dernier.items ?? [];
  return {
    date: dernier.date_start.slice(0, 10),
    reponses: lireReponsesDimanche(items, { version: 'normale', accord }).reponses,
    mot: items.some((i) => i.question === QUESTION_OUVERTE && typeof i.value === 'string' && i.value.trim() !== ''),
  };
}

// ─── L'arrêt ───────────────────────────────────────────────────────────────────────────────────────────────

export type ArretDit = { jour: string; arret: 'quelques_jours' | 'semaine'; semaines?: number };
const dit = (jour: string, r: ReponsesDimanche | null | undefined): ArretDit | null =>
  (r?.arret === 'semaine' || r?.arret === 'quelques_jours' ? { jour, arret: r.arret, ...(r.semaines_arret ? { semaines: r.semaines_arret } : {}) } : null);

// En automatique : les réponses gardées avec la semaine la plus récente (celles du week-end d'avant son lundi, ou arrivées le lundi) ; une semaine de plus de 7 jours ne dit plus rien.
export function arretDesSemaines(lignes: { lundi: string | null; reponses: ReponsesDimanche | null }[], aujourdhui: string): ArretDit | null {
  const [recente] = lignes.filter((l) => l.lundi && l.lundi >= ajouterJours(aujourdhui, -7) && l.reponses).sort((a, b) => String(b.lundi).localeCompare(String(a.lundi)));
  return recente ? dit(ajouterJours(String(recente.lundi), -1), recente.reponses) : null;
}

export const arretDuPointLu = (p: PointLu | null, aujourdhui: string): ArretDit | null => (p && p.date >= ajouterJours(aujourdhui, -7) ? dit(p.date, p.reponses) : null);

// Le point de santé : « Arrêt signalé » dans la liste (lib/app/unMot.ts), « Réglé » comme les autres ; une nouvelle réponse le redit.
export function pointDArret(a: { id: string; nom: string }, d: ArretDit): Point {
  const semaines = d.semaines ? (d.semaines >= 5 ? 'plus de 4 semaines' : `${d.semaines} semaine${d.semaines > 1 ? 's' : ''}`) : null;
  const quoi = d.arret === 'semaine' ? `toute la semaine${semaines ? `, depuis ${semaines}` : ''}` : 'quelques jours';
  return { niveau: 'sante', genre: 'arret', cle: `arret:point:${a.id}:${d.jour}`, athlete: a.nom, action: 'Voir ›', href: `/app/coach/athlete/${a.id}#point-du-dimanche`,
    detail: quoi.charAt(0).toUpperCase() + quoi.slice(1), texte: `arrêt de course dit à son point du dimanche : ${quoi}.` };
}

type Athlete = { id: string; usr: string | null; coache: boolean; aLaMain: boolean; accord: boolean };

// L'arrêt de chaque coaché ; une lecture qui échoue ne donne rien pour lui, jamais une erreur de la page.
export async function arretsDitsAuPoint(service: SupabaseClient, athletes: Athlete[], aujourdhui: string): Promise<Map<string, ArretDit>> {
  const arrets = new Map<string, ArretDit>();
  const coaches = athletes.filter((a) => a.coache);
  const auto = coaches.filter((a) => !a.aLaMain).map((a) => a.id);
  if (auto.length) {
    const { data: liens } = await service.from('coaching').select('plan_id, athlete_id').in('athlete_id', auto);
    const planIds = (liens ?? []).map((l) => l.plan_id as string);
    const { data } = planIds.length
      ? await service.from('semaines_ecrites').select('plan_id, lundi:donnees->>lundi, reponses_lues').eq('moteur', MOTEUR_ECRIT).in('plan_id', planIds)
      : { data: [] };
    const lignes = (data ?? []) as unknown as { plan_id: string; lundi: string | null; reponses_lues: ReponsesDimanche | null }[];
    for (const id of auto) {
      const siens = new Set((liens ?? []).filter((l) => l.athlete_id === id).map((l) => l.plan_id as string));
      const d = arretDesSemaines(lignes.filter((l) => siens.has(l.plan_id)).map((l) => ({ lundi: l.lundi, reponses: l.reponses_lues })), aujourdhui);
      if (d) arrets.set(id, d);
    }
  }
  const aLaMain = coaches.filter((a) => a.aLaMain && a.usr);
  if (aLaMain.length) {
    // Lus dans Nolio seulement ceux dont le point a été posé ces 7 derniers jours (lib/app/pointALaMain.ts).
    const { data } = await service.from('athletes_coaches').select('id, questionnaires').in('id', aLaMain.map((a) => a.id));
    const poses = new Map(((data ?? []) as { id: string; questionnaires: { point?: { jour: string; nolio_id: string | null } } | null }[])
      .map((f) => [f.id, f.questionnaires?.point]));
    await Promise.all(aLaMain.map(async (a) => {
      const pose = poses.get(a.id);
      if (!pose || pose.jour < ajouterJours(aujourdhui, -7)) return;
      const d = arretDuPointLu(await lireSonPoint(String(a.usr), a.accord, pose.nolio_id, aujourdhui).catch(() => null), aujourdhui);
      if (d) arrets.set(a.id, d);
    }));
  }
  return arrets;
}
