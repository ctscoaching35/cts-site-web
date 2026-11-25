/**
 * LES PASSAGES DU SITE SOUS LE MOTEUR v1 (9.x) : le questionnaire du dimanche matin, la semaine du dimanche soir, les passages du lundi. Ce fichier est
 * la colle avec le vrai Nolio et la vraie base ; ce que chaque passage décide est dans lib/app/passeUnPlanV9.ts (essayé avec de fausses pièces,
 * scripts/test-passes-v9.mjs). Les routes (app/api/ecriture/*) ne l'appellent que sous une 9.x (lib/app/chaineDuMoteur.ts) : sous la 8.474, rien ne change.
 *
 * PAS PORTÉ sous le moteur v1 (la liste de la mise en ligne ; le départ d'un objectif l'est, lib/app/departV9.ts) : « Réessayer » et « Annuler », l'aperçu du
 * dimanche, le rattrapage, la saison de fond, les corrections du coach, les tests lus (VC, FC), les fiches de préparation et les courses de préparation.
 */
import { clientService } from './supabase';
import { appelNolio, listeNolio, refusNolio, SPORTS_COURSE } from './nolio';
import { destinataire, envoyerSemaineCible, mettreAJourSemaineCible } from './coaching';
import { lireLuAuDepart } from './luAuDepart';
import {
  aujourdhuiParis, garderNote, indiceHooper, moteur, noteDeLaSemaine, objectifEcrit, plansActifs, plansEnRecuperation, type Compte, type Objectif,
} from './ecriture';
import { HEURE_D_ENVOI, lireReponsesDimanche, repondAuDimanche, type ReponsesDimanche } from './dimancheV9';
import { lireEtatDuPlan, garderLEtat, garderLeQuestionnairePose, garderLesReponsesLues, garderUneEcriture, lireLaDerniereSemaine, lireLeQuestionnairePose } from './stockageV9';
import { noteEnTexte } from './moteurV9';
import { completerLesEtapes, estEnvoyee, lundisALire, lundisDuDepart, nolioDepuisNolio, vueDuDepart, type HooperLu, type NoeudPlanifie, type PlanifieeLue, type ReelleLue } from './nolioV9';
import { parametresDuObjectifV9 } from './parametresPlanV9';
import {
  ecrireLaSemaineDuLundi, ecrireOuReprendre, passeDuLundiSurUnPlan, pointSansReponse, poserLeQuestionnaireDuDimanche, type ContextePlan, type Resultat, type SortDeLaSemaine,
} from './passeUnPlanV9';
import { rappelActif } from './rappelDimanche';
import { heureDuRappelV9, TEXTE_RAPPEL_V9_VALIDE, texteDuRappelV9 } from './rappelDimancheV9';
import type { Semaine } from './plan';

const ajouterJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const jourDeLaSemaine = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 : dimanche, 1 : lundi

// Le contexte réel d'un plan : son objectif, son état, ce que Nolio montre. null : pas de Nolio relié, rien à passer.
async function contextePlan(planId: string): Promise<{ c: ContextePlan; o: Objectif } | null> {
  const o = await objectifEcrit(planId);
  if (!o?.nolioAthlete) return null;
  // La saison de fond d'un coaché (décisions du coach du 24/10/2026) n'est pas portée sous le moteur v1 : le contrat n'a ni sa route ni sa trame.
  if ((o.parametres as { fond?: unknown }).fond) return null;
  const service = clientService();
  const [etat, derniere] = await Promise.all([lireEtatDuPlan(service, planId), lireLaDerniereSemaine(service, planId)]);
  const premierLundi = o.plan.semaines.find((s) => s.lundi)?.lundi ?? null;
  const parametres = await parametresDuObjectifV9(o);
  const qui = async () => {
    const d = await destinataire(o.nolioAthlete);
    return d.moi ? '' : `&athlete=${d.usr}`;
  };

  // Les réponses de Nolio au point du dimanche de la semaine `numero` (ses 10 derniers jours) ; une lecture qui échoue remonte.
  type ResultatDuPoint = { id: string; name?: string; date_start: string; quiz_planned?: string; items?: { question?: string; order?: number | null; value: unknown }[] };
  const resultatsDuPoint = async (numero: number, pose: Parameters<ContextePlan['reponduAuPoint']>[1]): Promise<ResultatDuPoint[]> => {
    const q = await qui();
    const aujourdhui = aujourdhuiParis();
    const resultats = await listeNolio<ResultatDuPoint>(`real/quiz_results/?date_from=${ajouterJours(aujourdhui, -10)}&date_to=${aujourdhui}${q}`);
    return resultats.filter((r) => repondAuDimanche(r, numero, pose));
  };

  const c: ContextePlan = {
    planId, coache: o.coache, accordLecture: o.accordLecture, parametres, etat,
    ports: { appeler: <T>(chemin: string, corps: unknown) => moteur<T>(chemin, corps) },
    derniere: derniere && { ...derniere },

    // Ce que Nolio montre : les séances prévues et les activités des semaines à lire, rangées pour le moteur. Une lecture qui échoue donne null : la clé
    // `nolio` ne part pas (une semaine lue sans séance dirait au moteur que le coach les a supprimées).
    lireNolio: async (lundi, avecLaSemaine, depart = false, sansEtapes = false) => {
      // Au premier passage d'un coaché (240) : les 4 lundis d'avant `lundi` (avant son entrée), et non depuis le premier lundi du plan.
      const lundis = depart ? lundisDuDepart(lundi) : lundisALire(avecLaSemaine ? ajouterJours(lundi, 7) : lundi, premierLundi ?? ajouterJours(lundi, -91));
      if (!lundis.length) return null;
      try {
        const q = await qui();
        const du = lundis[0];
        const au = ajouterJours(lundis[lundis.length - 1], 6);
        const planifiees = await listeNolio<PlanifieeLue>(`planned/trainings/?date_from=${du}&date_to=${au}${q}`);
        const reelles = await listeNolio<ReelleLue>(
          `real/trainings/?date_from=${du}&date_to=${au}&fields=id,name,date_start,sport,duration,planned${o.accordLecture ? ',debrief' : ''}${q}`);
        const item = o.accordLecture ? await indiceHooper() : null;
        const hooper = item ? await listeNolio<HooperLu & { id: string }>(`metrics/values/?item=${item}&date_from=${du}&date_to=${au}${q}`) : [];
        // Au premier passage, aucun `id` : ceux des envois de la 8.x (« S12-mardi ») seraient pris pour ceux de la v1 ; ses séances se lisent à leur titre et à leurs étapes.
        const parNolio = new Map<string, string>();
        if (!depart) for (const e of o.envois) for (const s of e.seances) if (s.nolio_id && (s.genre ?? 'seance') === 'seance' && !s.jour_id.includes(':')) parNolio.set(String(s.nolio_id), s.jour_id);
        const joursDeCourse = new Set([o.plan.course.date, ...((o.parametres.courses_secondaires ?? []) as { date: string }[]).map((x) => x.date)]);
        // La liste ne rend pas les étapes : celles des séances qui partent au moteur sont relues une par une (completerLesEtapes), sauf pour le point du dimanche, qui n'en lit aucune (sansEtapes).
        const detail = q ? `?${q.slice(1)}` : '';
        const completes = sansEtapes ? planifiees : await completerLesEtapes(planifiees, (p) => estEnvoyee(p, lundis, parNolio, SPORTS_COURSE), async (id) => {
          const r = await appelNolio('GET', `planned/trainings/${id}/${detail}`);
          return { statut: r.statut, workout: (r.corps as { workout?: NoeudPlanifie[] } | null)?.workout };
        });
        const vu = nolioDepuisNolio({ lundis, planifiees: completes, reelles, hooper, parNolio, accordLecture: o.accordLecture, sportsDeCourse: SPORTS_COURSE, joursDeCourse });
        // Au premier passage, sans les semaines sans séance (vueDuDepart).
        return depart ? vueDuDepart(vu) : vu;
      } catch (e) {
        console.error(`Nolio de ${planId} non lu pour le moteur :`, e instanceof Error ? e.message : e);
        return null;
      }
    },

    // Ce qu'il court au départ (entrée 203) : d'un coaché relié seulement (le lecteur demande lui-même l'accord de lecture) ; un acheteur garde le déclaré de son achat.
    lireLeDepart: async (lundi) => (o.coache ? lireLuAuDepart(o.coachId, o.nolioAthlete, lundi) : null),
    // Gardé avec le plan, dans ses réponses (`parametres.champs.lu`, lu comme le reste de l'intake) ; le plan est relu avant, pour ne rien écraser de ce qu'un autre a changé.
    // La trame gardée repart de zéro (elle se refait avec `lu`).
    garderLu: async (lu) => {
      const { data, error } = await service.from('plans').select('parametres').eq('id', planId).single();
      if (error || !data?.parametres) throw new Error(`Ce qu'il court au départ n'a pas pu être gardé : ${error?.message ?? 'plan sans paramètres'}`);
      const parametres = data.parametres as Record<string, unknown>;
      const garde = { ...parametres, champs: { ...((parametres.champs ?? {}) as Record<string, unknown>), lu } };
      const { error: erreur } = await service.from('plans').update({ parametres: garde, trame: null }).eq('id', planId);
      if (erreur) throw new Error(`Ce qu'il court au départ n'a pas pu être gardé : ${erreur.message}`);
      o.parametres = garde;
    },

    // Les réponses au questionnaire posé à la fin de la semaine `numero` : par son identifiant Nolio ; celui d'avant la première, par son nom.
    reponduAuPoint: async (numero, pose) => (await resultatsDuPoint(numero, pose)).length > 0,
    lireLesReponses: async (numero, pose) => {
      try {
        const siens = (await resultatsDuPoint(numero, pose)).sort((a, b) => b.date_start.localeCompare(a.date_start));
        if (!siens[0]) return null;
        const { reponses, illisibles } = lireReponsesDimanche(siens[0].items ?? [], { version: pose?.version ?? 'normale', cles: pose?.cles ?? [], accord: o.accordLecture });
        return { reponses, illisibles };
      } catch (e) {
        console.error(`Réponses de ${planId} non lues :`, e instanceof Error ? e.message : e);
        return null;
      }
    },
    questionnaireDe: async (numero) => lireLeQuestionnairePose(service, planId, numero),

    // Nolio : la première fois, ses séances et son bandeau ; une semaine déjà partie (une réécriture, une reprise en route) se met à jour sur place, ses retouches
    // gardées (envoyerSemaineCible et mettreAJourSemaineCible, comme avant : seancesDuMoteur lit /v1/nolio/seances du moteur v1). Puis sa note.
    envoyer: async (ecrite, options) => {
      const numero = `S${ecrite.numero}`;
      // Un départ en milieu de semaine : les jours d'avant ne partent pas dans Nolio (la semaine gardée reste entière).
      const depuis = options?.depuis;
      const semaine = (depuis ? { ...ecrite.semaine, jours: (ecrite.semaine.jours ?? []).filter((j) => !(j as { date?: string }).date || (j as { date: string }).date >= depuis) } : ecrite.semaine) as unknown as Semaine;
      if (o.envois.some((e) => e.semaine === numero)) await mettreAJourSemaineCible(o, numero, semaine);
      else await envoyerSemaineCible(o, numero, semaine);
      const texte = noteEnTexte(ecrite.note);
      if (texte && ecrite.lundi) await noteDeLaSemaine(o, numero, ecrite.lundi, texte);
    },
    garderEcriture: (ecrite, apres) => garderUneEcriture(service, planId, ecrite, apres),
    garderEtat: (etatRendu) => garderLEtat(service, planId, etatRendu),
    garderReponsesLues: (numero, reponses) => garderLesReponsesLues(service, planId, numero, reponses),

    // Le coach a retouché cette semaine dans Nolio : une de ses séances n'a plus la révision qu'elle avait à l'envoi, ou n'y est plus.
    retouchee: async (numero, lundi) => {
      const attendues = new Map((o.envois.find((e) => e.semaine === `S${numero}`)?.seances ?? [])
        .filter((s) => s.nolio_id && s.revision && (s.genre ?? 'seance') === 'seance').map((s) => [String(s.nolio_id), String(s.revision)]));
      if (!attendues.size) return false;
      const vues = await listeNolio<{ id: string; revision?: string }>(`planned/trainings/?date_from=${ajouterJours(lundi, -1)}&date_to=${ajouterJours(lundi, 7)}&with_revision=true${await qui()}`);
      const parId = new Map(vues.map((v) => [v.id, v.revision ?? '']));
      return [...attendues].some(([id, revision]) => !parId.has(id) || (parId.get(id) !== '' && parId.get(id) !== revision));
    },
    poserLaNote: async (numero, lundi, lignes) => {
      const cle = `S${numero}:reponse`;
      if (!o.envois.some((e) => e.semaine === cle)) await garderNote(o, cle, lundi, 'Ta réponse', noteEnTexte(lignes));
    },

    // Le questionnaire du dimanche, posé dans Nolio à 12 h le jour même ; son identifiant sert à retrouver les réponses.
    poserLeQuiz: async (quiz, jour) => {
      const d = await destinataire(o.nolioAthlete);
      const r = await appelNolio('POST', 'planned/quizzes/', { ...quiz, date_start: jour, hour_start: HEURE_D_ENVOI, ...(d.moi ? {} : { athletes: [d.usr] }) });
      if (r.statut !== 201 && r.statut !== 200) throw new Error(refusNolio(r, 'le questionnaire du dimanche'));
      return String(r.corps?.id ?? '') || null;
    },
    garderLeQuestionnaire: (numero, q) => garderLeQuestionnairePose(service, planId, numero, q),
  };
  return { c, o };
}

// Les plans à passer : ceux en route et ceux en récupération (la récupération est une semaine de la trame du moteur v1), sans doublon.
const plansAPasser = async () => [...new Set([...await plansActifs(), ...await plansEnRecuperation()])];

async function passer(budgetMs: number, quoi: string, faire: (c: ContextePlan) => Promise<Resultat>): Promise<Compte[]> {
  const debut = Date.now();
  const comptes: Compte[] = [];
  for (const planId of await plansAPasser()) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: planId, quoi: 'remis à la reprise' });
      continue;
    }
    try {
      const cx = await contextePlan(planId);
      if (!cx) continue;
      const r = await faire(cx.c);
      if (r) comptes.push({ plan: planId, quoi: r.quoi, coache: cx.o.coache });
    } catch (e) {
      comptes.push({ plan: planId, quoi, erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// Le dimanche soir (17 h, 19 h, 21 h UTC) : la semaine du lundi qui vient ; un lundi déjà écrit est sauté.
export const passageDuDimancheV9 = (budgetMs = 240_000, jour = aujourdhuiParis()): Promise<Compte[]> =>
  passer(budgetMs, 'semaine non écrite', (c) => ecrireLaSemaineDuLundi(c, ajouterJours(jour, 1)));

// Le lundi, de 5 h à 21 h UTC : le filet d'une semaine pas écrite, puis la réponse arrivée tard. Ni un autre jour.
export const passageDuLundiV9 = (budgetMs = 240_000, jour = aujourdhuiParis()): Promise<Compte[]> =>
  jourDeLaSemaine(jour) === 1 ? passer(budgetMs, 'passe du lundi en échec', (c) => passeDuLundiSurUnPlan(c, jour)) : Promise.resolve([]);

// Le dimanche matin : le questionnaire de la semaine écrite, posé dans Nolio pour 12 h. Ni un autre jour.
export const questionnaireDuMatinV9 = (budgetMs = 120_000, jour = aujourdhuiParis()): Promise<Compte[]> =>
  jourDeLaSemaine(jour) === 0 ? passer(budgetMs, 'questionnaire non posé', (c) => poserLeQuestionnaireDuDimanche(c, jour)) : Promise.resolve([]);

// Le rappel du dimanche (décision 206 du coach, 24/11/2026 ; vers 19 h, Paris, par la décision 211) : un seul message Nolio programmé par athlète et par dimanche, seulement à qui n'a pas répondu à son
// point du dimanche posé à midi ; plus de rappel pour les séances non remontées. Même interrupteur que sous la 8.x (CTS_RAPPEL_DIMANCHE : coupé, aucune lecture ni aucun appel),
// même clé « rappel:<dimanche> » (nolio_envois : un seul par dimanche, aussi après un retour à la 8.x), même programmation du message. Une lecture de Nolio qui échoue ne rappelle personne.
export async function rappelDuDimancheV9(budgetMs = 240_000, maintenant = new Date()): Promise<{ actif: boolean; texteValide: boolean; comptes: Compte[] }> {
  if (!rappelActif()) return { actif: false, texteValide: TEXTE_RAPPEL_V9_VALIDE, comptes: [] };
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(maintenant);
  const comptes: Compte[] = [];
  if (jourDeLaSemaine(jour) !== 0) return { actif: true, texteValide: TEXTE_RAPPEL_V9_VALIDE, comptes };
  const heure = heureDuRappelV9(maintenant);
  if (!heure) return { actif: true, texteValide: TEXTE_RAPPEL_V9_VALIDE, comptes: [{ plan: '', quoi: 'rappel non envoyé : trop tard dans l’après-midi' }] };
  const service = clientService();
  const debut = Date.now();
  for (const planId of await plansAPasser()) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: planId, quoi: 'rappel remis : temps épuisé' });
      continue;
    }
    let cle: string | null = null;
    let coache: boolean | undefined;
    try {
      const cx = await contextePlan(planId);
      if (!cx) continue;
      coache = cx.o.coache;
      if (!(await pointSansReponse(cx.c, jour))) continue;
      // Un seul par dimanche : la clé se prend avant l'envoi.
      cle = `rappel:${jour}`;
      const { data: prise } = await service.from('nolio_envois')
        .upsert({ plan_id: planId, semaine: cle, coach_id: cx.o.coachId, seances: [] }, { onConflict: 'plan_id,semaine', ignoreDuplicates: true }).select('plan_id');
      if (!prise?.length) { cle = null; continue; }
      const d = await destinataire(cx.o.nolioAthlete);
      const r = await appelNolio('POST', 'planned/messages/', {
        description: texteDuRappelV9(cx.o.coache), date_start: jour, hour_start: heure, show_to_the_athlete: false, ...(d.moi ? {} : { athletes: [d.usr] }),
      });
      if (r.statut !== 201 && r.statut !== 200) throw new Error(refusNolio(r, 'le rappel du dimanche'));
      cle = null;
      comptes.push({ plan: planId, quoi: `rappel programmé à ${heure}`, coache });
    } catch (e) {
      // Rien d'envoyé : la clé se libère, un nouvel appel peut le refaire.
      if (cle) await service.from('nolio_envois').delete().eq('plan_id', planId).eq('semaine', cle);
      comptes.push({ plan: planId, quoi: 'rappel non programmé', erreur: e instanceof Error ? e.message : String(e), coache });
    }
  }
  return { actif: true, texteValide: TEXTE_RAPPEL_V9_VALIDE, comptes };
}

// La première semaine d'un objectif qui démarre, ou une semaine rattrapée à la main (« Réessayer ») : celle qui commence ce lundi, écrite et envoyée comme le dimanche, à
// partir de `depuis` (les jours d'avant ne partent pas). Une semaine déjà écrite n'est pas refaite (la reprise d'un départ coupé la retrouve) ; hors de la trame du moteur, c'est
// une erreur dite, jamais un silence. Rend le numéro de la semaine.
export async function ecrireLaSemaineDemandee(planId: string, lundi: string, options: { depuis?: string } = {}): Promise<{ numero: string; sort: SortDeLaSemaine }> {
  const cx = await contextePlan(planId);
  if (!cx) throw new Error('Ce plan ne s’écrit pas semaine par semaine (pas de Nolio relié, ou saison de fond, pas portée sous le moteur v1).');
  const sort = await ecrireOuReprendre(cx.c, lundi, options);
  if (sort.statut === 'hors_trame') throw new Error(`Le moteur ne place aucune semaine de ce plan au lundi ${lundi} : son plan d’achat et la trame du moteur v1 ne tombent pas sur les mêmes semaines.`);
  return { numero: `S${sort.numero}`, sort };
}
