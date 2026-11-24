// Aucun réseau, aucune base : tout passe par des PORTS que l'appelant fournit. PRÉPARÉ, PAS BRANCHÉ (rien ne le lit encore ; scripts/test-ecriture-v9.mjs).
/**
 * LA CHAÎNE D'ÉCRITURE DU SITE SUR LE MOTEUR v1 (CONTRAT_API_CTS.md, « MOTEUR v1 ») : sous une 9.x, la semaine d'un plan s'écrit par
 * `POST /v1/semaine`, qui remplace `/v1/semaine/lundi` et `/v1/recuperation` (une semaine `type: "recuperation"` de la trame).
 *
 *   - ÉCRIRE : le numéro vient de `POST /v1/trame` (le rang de la semaine dans sa liste, jamais calculé ici), l'état de lib/app/etatMoteur.ts ;
 *     `nolio` et `reponses` partent seulement quand ils sont lus : un `nolio` présent veut dire « lu » (une semaine lue sans séance dit au moteur que le
 *     coach les a toutes supprimées), une réponse absente veut dire « semaine prévue » ;
 *   - RÉÉCRIRE : une nouvelle réponse avant la première séance, le même numéro avec l'état d'avant cette semaine ;
 *   - LE DIMANCHE MATIN : `POST /v1/questionnaire` choisit la version (normale, aucune séance vue, fatigue) du questionnaire de la semaine écrite ;
 *   - APRÈS UNE SÉANCE FAITE : `POST /v1/reponse-tardive`, qui ne rejoue rien et rend l'état à garder ;
 *   - NOLIO : `POST /v1/nolio/seances` rend les séances et le bandeau déjà prêts pour l'API de Nolio.
 * Toute réponse du moteur est lue avant d'être crue (lib/app/moteurV9.ts) ; une réponse illisible arrête, elle n'est pas devinée.
 */
import { questionnaireDuDimanche, seancesCles, type QuestionnaireDimanche, type SeanceCle, type VersionDimanche } from './dimancheV9';
import { apresUneEcriture, apresUneReponseTardive, etatPourEcrire, type Etat, type EtatDuPlan } from './etatMoteur';
import { actionDuLundi, type ActionDuLundi, type SemaineEnCours } from './lundiV9';
import {
  corpsDeLaSemaine, corpsDuQuestionnaire, corpsNolioSeances, lireReponseTardive, lireSeancesNolio, lireSortieV9, lireTrame, noteEnTexte,
  numeroDeLaSemaine, versionDuQuestionnaire, type NolioVu, type SeancesNolioV9, type SortieV9, type TrameV9,
} from './moteurV9';
import type { ReponsesDimanche } from './dimancheV9';

export type Ports = { appeler: <T>(chemin: string, corps: unknown) => Promise<T> };

export class ReponseIllisible extends Error {
  constructor(chemin: string) { super(`Moteur ${chemin} : la réponse n'a pas la forme du contrat 9.0.`); }
}

// ─── La trame et le numéro ──────────────────────────────────────────────────────────────────────────

export async function lireLaTrame(ports: Ports, parametres: Record<string, unknown>): Promise<TrameV9> {
  const trame = lireTrame(await ports.appeler('/v1/trame', { parametres }));
  if (!trame) throw new ReponseIllisible('/v1/trame');
  return trame;
}

// trame : celle qu'on vient de lire (un passage la lit une fois par plan, pas une fois par appel).
async function numeroDe(ports: Ports, parametres: Record<string, unknown>, lundi: string, trame?: TrameV9): Promise<number> {
  const numero = numeroDeLaSemaine(trame ?? await lireLaTrame(ports, parametres), lundi);
  if (numero === null) throw new Error(`Le lundi ${lundi} ne commence aucune semaine de la trame du moteur.`);
  return numero;
}

// ─── Écrire, réécrire ───────────────────────────────────────────────────────────────────────────────

export type SemaineEcriteV9 = {
  numero: number; lundi: string; semaine: SortieV9['semaine']; note: string[]; pourquoi: unknown[]; branche: number | null;
  etatUtilise: Etat | null; etatRendu: Etat; reecrite: boolean;
  // Les réponses du dimanche qui ont servi à l'écrire (null : aucune lue) : le lundi, une réponse différente est une réponse nouvelle.
  reponses: ReponsesDimanche | null;
};

// Une empreinte stable des réponses lues (les clés triées) : deux lectures de la même réponse se ressemblent, une réponse changée non.
export function signatureDesReponses(r: ReponsesDimanche | null | undefined): string {
  if (!r) return '';
  const trier = (v: unknown): unknown => (Array.isArray(v) ? v.map(trier) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, trier(x)])) : v);
  return JSON.stringify(trier(r));
}

/**
 * Écrit (ou réécrit) la semaine qui commence ce lundi. nolio : ce que Nolio montre, ou null s'il n'a pas pu se lire (alors la clé ne part pas) ;
 * reponses : le questionnaire du dimanche lu, ou null. Rend ce que le moteur a rendu, avec l'état qui a servi, à garder avec la semaine.
 */
export async function ecrireLaSemaine(ports: Ports, { parametres, lundi, etat, nolio = null, reponses = null, trame }: {
  parametres: Record<string, unknown>; lundi: string; etat: EtatDuPlan; nolio?: NolioVu | null; reponses?: ReponsesDimanche | null; trame?: TrameV9;
}): Promise<SemaineEcriteV9> {
  const numero = await numeroDe(ports, parametres, lundi, trame);
  const { etat: etatUtilise, reecrite } = etatPourEcrire(etat, numero);
  const sortie = lireSortieV9(await ports.appeler('/v1/semaine', corpsDeLaSemaine({ parametres, numero, etat: etatUtilise, nolio, reponses })));
  if (!sortie) throw new ReponseIllisible('/v1/semaine');
  // Le moteur a répondu pour une autre semaine : jamais rangée.
  if (sortie.semaine.numero !== numero || (sortie.semaine.lundi !== undefined && sortie.semaine.lundi !== lundi)) {
    throw new Error(`Moteur /v1/semaine : la semaine rendue (${String(sortie.semaine.numero)}, ${String(sortie.semaine.lundi)}) n'est pas celle demandée (${numero}, ${lundi}).`);
  }
  return { numero, lundi, semaine: sortie.semaine, note: sortie.note, pourquoi: sortie.pourquoi, branche: sortie.branche, etatUtilise, etatRendu: sortie.etat, reecrite,
    reponses: reponses ?? null };
}

/** L'état du plan après une écriture. */
export const etatApresEcriture = (avant: EtatDuPlan, e: SemaineEcriteV9): EtatDuPlan => apresUneEcriture(avant, e.numero, e.etatUtilise, e.etatRendu);

// ─── Le dimanche matin ──────────────────────────────────────────────────────────────────────────────

export type QuestionnairePose = { version: VersionDimanche; cles: SeanceCle[]; quiz: QuestionnaireDimanche };

/**
 * La version du questionnaire de la semaine écrite, choisie par le moteur d'après ce que Nolio montre, et le questionnaire qui en sort.
 * lundiASuivre : le lundi de la semaine que le moteur écrira (« la semaine suivante ») ; derniere : la semaine écrite que le questionnaire
 * interroge (ses séances clés) ; null au dimanche d'avant la première semaine (seulement les jours, le nombre, la sortie longue).
 */
export async function preparerLeQuestionnaire(ports: Ports, { parametres, lundiASuivre, etat, nolio = null, derniere, coache = false, ligneEffet = null, trame }: {
  parametres: Record<string, unknown>; lundiASuivre: string; etat: EtatDuPlan; nolio?: NolioVu | null;
  derniere: SortieV9['semaine'] | null; coache?: boolean; ligneEffet?: string | null; trame?: TrameV9;
}): Promise<QuestionnairePose> {
  const numero = await numeroDe(ports, parametres, lundiASuivre, trame);
  if (!derniere) {
    return { version: 'normale', cles: [], quiz: questionnaireDuDimanche({ version: 'normale', premiere: true, coache }) };
  }
  const reponse = await ports.appeler('/v1/questionnaire', corpsDuQuestionnaire({ parametres, numero, etat: etat.courant, nolio }));
  const version = versionDuQuestionnaire(reponse);
  if (!version) throw new ReponseIllisible('/v1/questionnaire');
  const cles = seancesCles(derniere as Parameters<typeof seancesCles>[0]);
  return { version, cles, quiz: questionnaireDuDimanche({ version, cles, coache, ligneEffet }) };
}

// ─── Une réponse qui arrive après ───────────────────────────────────────────────────────────────────

export type ReponseTardive = { note: string[]; etat: EtatDuPlan };

/** Une réponse arrivée alors qu'une séance de la semaine est déjà faite : le moteur ne réécrit rien, l'état rendu est à garder. */
export async function repondreEnRetard(ports: Ports, { parametres, lundi, etat, nolio = null, reponses, trame }: {
  parametres: Record<string, unknown>; lundi: string; etat: EtatDuPlan; nolio?: NolioVu | null; reponses: ReponsesDimanche; trame?: TrameV9;
}): Promise<ReponseTardive> {
  const numero = await numeroDe(ports, parametres, lundi, trame);
  // Le moteur ne connaît que les semaines de son état : une semaine jamais écrite par lui n'a rien à garder.
  if (!etat.ecrites.some((w) => w.numero === numero) || !etat.courant) throw new Error(`La semaine ${numero} n'a pas été écrite par le moteur v1 : une réponse tardive n'a rien à y garder.`);
  const r = lireReponseTardive(await ports.appeler('/v1/reponse-tardive', { parametres, numero, etat: etat.courant, ...(nolio ? { nolio } : {}), reponses }));
  if (!r) throw new ReponseIllisible('/v1/reponse-tardive');
  return { note: r.note, etat: apresUneReponseTardive(etat, r.etat) };
}

// ─── La passe du lundi : réécrire, répondre en retard, ou rien ──────────────────────────────────────

export type SuiteDeLaReponse =
  | { action: 'rien'; etat: EtatDuPlan }
  | { action: 'reecrire'; ecrite: SemaineEcriteV9; etat: EtatDuPlan }
  | { action: 'reponse_tardive'; note: string[]; etat: EtatDuPlan };

// Ce que Nolio montre de la semaine écrite, tel que la décision le lit ; null si cette semaine n'est pas dans ce qui a été lu.
export const semaineEnCours = (nolio: NolioVu | null | undefined, lundi: string): SemaineEnCours | null =>
  nolio?.semaines.find((w) => w.lundi === lundi) ?? null;

/**
 * La suite d'une réponse du dimanche arrivée le lundi (décisions du coach du 24/11/2026, entrée 191) : avant la première séance de la semaine,
 * la semaine se réécrit ; après une séance faite, c'est une réponse tardive ; rien de nouveau ou Nolio illisible : rien. lundi : celui de la
 * semaine écrite (la dernière). reponseNouvelle : une réponse arrivée depuis la dernière lecture.
 */
export async function suiteDeLaReponse(ports: Ports, e: {
  parametres: Record<string, unknown>; lundi: string; etat: EtatDuPlan; nolio: NolioVu | null; reponses: ReponsesDimanche | null; reponseNouvelle: boolean;
  trame?: TrameV9;
}): Promise<SuiteDeLaReponse> {
  const action: ActionDuLundi = actionDuLundi({ reponseNouvelle: e.reponseNouvelle, semaine: semaineEnCours(e.nolio, e.lundi) });
  if (action === 'rien' || !e.reponses) return { action: 'rien', etat: e.etat };
  if (action === 'reponse_tardive') {
    const r = await repondreEnRetard(ports, { parametres: e.parametres, lundi: e.lundi, etat: e.etat, nolio: e.nolio, reponses: e.reponses, trame: e.trame });
    return { action, note: r.note, etat: r.etat };
  }
  const ecrite = await ecrireLaSemaine(ports, { parametres: e.parametres, lundi: e.lundi, etat: e.etat, nolio: e.nolio, reponses: e.reponses, trame: e.trame });
  return { action, ecrite, etat: etatApresEcriture(e.etat, ecrite) };
}

// ─── Nolio ──────────────────────────────────────────────────────────────────────────────────────────

/** Les séances et le bandeau d'une semaine écrite, prêts pour l'API de Nolio. profil : ce que Nolio a de l'athlète (une valeur absente n'est jamais visée). */
export async function seancesPourNolio(ports: Ports, semaine: SortieV9['semaine'], profil?: { vc_ms?: number | null; fc_seuil1?: number | null; fc_seuil2?: number | null } | null): Promise<SeancesNolioV9> {
  const r = lireSeancesNolio(await ports.appeler('/v1/nolio/seances', corpsNolioSeances(semaine, profil)));
  if (!r) throw new ReponseIllisible('/v1/nolio/seances');
  return r;
}

// NOTE : la chaîne vivante (lib/app/passagesV9.ts) envoie par envoyerSemaineCible et mettreAJourSemaineCible (lib/app/coaching.ts), qui lisent /v1/nolio/seances
// sous une 9.x (seancesDuMoteur) : leurs retouches gardées, leurs reprises en route et leurs séances en trop sont celles d'avant. `seancesPourNolio` et
// `envoyerLaSemaine` ci-dessous sont la version à ports de la même chose, essayée seule (scripts/test-ecriture-v9.mjs), que la chaîne vivante n'appelle pas.
export type EnvoiNolio = { jour_id: string; nolio_id: string | null; erreur?: string; deja?: boolean; genre?: string };
export type PortNolio = {
  creer: (jourId: string, corps: Record<string, unknown>, genre: 'seance' | 'cycle') => Promise<EnvoiNolio>;
  poserLaNote: (cle: string, dateIso: string, titre: string, texte: string) => Promise<void>;
  garder: (envoyes: EnvoiNolio[]) => Promise<void>;
};

/**
 * Pose une semaine écrite dans Nolio, la première fois : son bandeau, ses séances (la course n'a pas de séance, `nolio` est null), puis la note du
 * lundi (celle du moteur, ses lignes). Ce qui est créé est gardé AU FIL DE L'EAU : une écriture coupée en route ne perd rien, et sa reprise
 * ne le double pas (comme envoyerSemaineCible, lib/app/coaching.ts). Une erreur de Nolio arrête, après avoir gardé ce qui est parti.
 */
export async function envoyerLaSemaine(port: PortNolio, { numero, lundi, seances, note }: {
  numero: number; lundi: string; seances: SeancesNolioV9; note: string[];
}): Promise<{ seances: number; bandeau: boolean; note: boolean }> {
  const crees: EnvoiNolio[] = [];
  let bandeau = false;
  if (seances.cycle) {
    const c = await port.creer('semaine', seances.cycle, 'cycle');
    if (c.erreur) throw new Error(c.erreur);
    if (!c.deja) { crees.push({ ...c, genre: 'cycle' }); bandeau = true; await port.garder(crees); }
  }
  let posees = 0;
  for (const s of seances.seances) {
    if (!s.nolio) continue;
    const c = await port.creer(s.id, s.nolio, 'seance');
    if (c.erreur) {
      if (crees.length) await port.garder(crees);
      throw new Error(c.erreur);
    }
    crees.push(c);
    posees += 1;
    await port.garder(crees);
  }
  const texte = noteEnTexte(note);
  if (texte) await port.poserLaNote(`S${numero}:bilan`, lundi, 'Ta semaine', texte);
  await port.garder(crees);
  return { seances: posees, bandeau, note: Boolean(texte) };
}
