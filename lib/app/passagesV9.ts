/**
 * LES PASSAGES DU SITE SOUS LE MOTEUR v1 (9.x) : le questionnaire du dimanche matin, la semaine du dimanche soir, les passages du lundi. Ce fichier est
 * la colle avec le vrai Nolio et la vraie base ; ce que chaque passage décide est dans lib/app/passeUnPlanV9.ts (essayé avec de fausses pièces,
 * scripts/test-passes-v9.mjs). Les routes (app/api/ecriture/*) ne l'appellent que sous une 9.x (lib/app/chaineDuMoteur.ts) : sous la 8.474, rien ne change.
 *
 * PAS PORTÉ sous le moteur v1 (la liste de la mise en ligne) : le départ d'un objectif (`demarrerObjectif`), « Réessayer » et « Annuler », l'aperçu du
 * dimanche, le rattrapage, la saison de fond, les corrections du coach, les tests lus (VC, FC), les fiches de préparation et les courses de préparation.
 */
import { clientService } from './supabase';
import { appelNolio, listeNolio, refusNolio, SPORTS_COURSE } from './nolio';
import { destinataire, envoyerSemaineCible, mettreAJourSemaineCible } from './coaching';
import {
  aujourdhuiParis, garderNote, indiceHooper, moteur, noteDeLaSemaine, objectifEcrit, plansActifs, plansEnRecuperation, type Compte, type Objectif,
} from './ecriture';
import { HEURE_D_ENVOI, lireReponsesDimanche, NOM_DU_QUESTIONNAIRE, type ReponsesDimanche } from './dimancheV9';
import { lireEtatDuPlan, garderLEtat, garderLeQuestionnairePose, garderLesReponsesLues, garderUneEcriture, lireLaDerniereSemaine, lireLeQuestionnairePose } from './stockageV9';
import { noteEnTexte } from './moteurV9';
import { lundisALire, nolioDepuisNolio, type HooperLu, type PlanifieeLue, type ReelleLue } from './nolioV9';
import { parametresDuObjectifV9 } from './parametresPlanV9';
import {
  ecrireLaSemaineDuLundi, passeDuLundiSurUnPlan, poserLeQuestionnaireDuDimanche, type ContextePlan, type Resultat,
} from './passeUnPlanV9';
import type { Semaine } from './plan';

const ajouterJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const jourDeLaSemaine = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 : dimanche, 1 : lundi

// Le contexte réel d'un plan : son objectif, son état, ce que Nolio montre. null : pas de Nolio relié, rien à passer.
async function contextePlan(planId: string): Promise<{ c: ContextePlan; o: Objectif } | null> {
  const o = await objectifEcrit(planId);
  if (!o?.nolioAthlete) return null;
  const service = clientService();
  const [etat, derniere] = await Promise.all([lireEtatDuPlan(service, planId), lireLaDerniereSemaine(service, planId)]);
  const premierLundi = o.plan.semaines.find((s) => s.lundi)?.lundi ?? null;
  const parametres = await parametresDuObjectifV9(o);
  const qui = async () => {
    const d = await destinataire(o.nolioAthlete);
    return d.moi ? '' : `&athlete=${d.usr}`;
  };

  const c: ContextePlan = {
    planId, coache: o.coache, parametres, etat,
    ports: { appeler: <T>(chemin: string, corps: unknown) => moteur<T>(chemin, corps) },
    derniere: derniere && { ...derniere },

    // Ce que Nolio montre : les séances prévues et les activités des semaines à lire, rangées pour le moteur. Une lecture qui échoue donne null : la clé
    // `nolio` ne part pas (une semaine lue sans séance dirait au moteur que le coach les a supprimées).
    lireNolio: async (lundi, avecLaSemaine) => {
      const lundis = lundisALire(avecLaSemaine ? ajouterJours(lundi, 7) : lundi, premierLundi ?? ajouterJours(lundi, -91));
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
        const parNolio = new Map<string, string>();
        for (const e of o.envois) for (const s of e.seances) if (s.nolio_id && (s.genre ?? 'seance') === 'seance' && !s.jour_id.includes(':')) parNolio.set(String(s.nolio_id), s.jour_id);
        const joursDeCourse = new Set([o.plan.course.date, ...((o.parametres.courses_secondaires ?? []) as { date: string }[]).map((x) => x.date)]);
        return nolioDepuisNolio({ lundis, planifiees, reelles, hooper, parNolio, accordLecture: o.accordLecture, sportsDeCourse: SPORTS_COURSE, joursDeCourse });
      } catch (e) {
        console.error(`Nolio de ${planId} non lu pour le moteur :`, e instanceof Error ? e.message : e);
        return null;
      }
    },

    // Les réponses au questionnaire posé à la fin de la semaine `numero` : par son identifiant Nolio ; celui d'avant la première, par son nom.
    lireLesReponses: async (numero, pose) => {
      try {
        const q = await qui();
        const aujourdhui = aujourdhuiParis();
        const resultats = await listeNolio<{ id: string; name?: string; date_start: string; quiz_planned?: string; items?: { question?: string; order?: number | null; value: unknown }[] }>(
          `real/quiz_results/?date_from=${ajouterJours(aujourdhui, -10)}&date_to=${aujourdhui}${q}`);
        const siens = resultats.filter((r) => (pose?.nolio_id ? r.quiz_planned === pose.nolio_id
          : numero === 0 && String(r.name ?? '').trim().toLowerCase() === NOM_DU_QUESTIONNAIRE.toLowerCase()))
          .sort((a, b) => b.date_start.localeCompare(a.date_start));
        if (!siens[0]) return null;
        const { reponses, illisibles } = lireReponsesDimanche(siens[0].items ?? [], { version: pose?.version ?? 'normale', cles: pose?.cles ?? [] });
        return { reponses, illisibles };
      } catch (e) {
        console.error(`Réponses de ${planId} non lues :`, e instanceof Error ? e.message : e);
        return null;
      }
    },
    questionnaireDe: async (numero) => lireLeQuestionnairePose(service, planId, numero),

    // Nolio : la première fois, ses séances et son bandeau ; une semaine déjà partie (une réécriture, une reprise en route) se met à jour sur place, ses retouches
    // gardées (envoyerSemaineCible et mettreAJourSemaineCible, comme avant : seancesDuMoteur lit /v1/nolio/seances du moteur v1). Puis sa note.
    envoyer: async (ecrite) => {
      const numero = `S${ecrite.numero}`;
      const semaine = ecrite.semaine as unknown as Semaine;
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
