/**
 * L'accueil de l'espace coach (maquette validée par le coach le 19/10/2026) : ses athlètes, chacun avec son prochain
 * objectif, sa semaine, l'état de sa préparation (la jauge de l'athlète, T4), Nolio et l'app ; et « À regarder »,
 * ce qui attend le coach, d'abord. « À regarder » (décision coach du 21/10/2026, « une liste, quatre niveaux ») : tout
 * ce qui demande son intervention, classé par urgence, chaque ligne avec son geste — ce qui bloque (objectif demandé,
 * Nolio à associer ou quitté, accord manquant, objectif pas démarré, semaine pas partie), la santé (arrêt, fatigue
 * franche, RPE à revoir), les décisions du moteur (semaine manquée, séance trop dure), ce qui arrive (course de
 * préparation, objectif sans suite, test illisible, course A de Nolio sans objectif). Les choix de l'athlète
 * (disponibilités, séance en plus) n'y sont pas : son objectif les montre. Tout vient de la base, sauf l'équipe Nolio
 * que la page lit déjà et les courses A de Nolio, lues une fois par heure : les signaux de chaque séance restent dans
 * « Suivi des 7 jours ». Côté serveur seulement.
 */
import { athletesCoaches, type FicheAthlete } from './coaching';
import { demandesDuCoach, estRetrait, type Demande } from './demandes';
import { coursesGardees, pasEncoreIci, type CourseNolio } from './coursesNolio';
import { entreeDe } from './entree';
import { plansALaMain, type LigneTrame, type Realise } from './ecriture';
import { ajouterJours, dateLongue, jourMois, joursEntre, type Semaine } from './plan';
import { clientService } from './supabase';
import { jaugeDuPlan, type Verdict } from './tableau';

export type LigneAthlete = {
  id: string; nom: string; usr: string | null; nolio: boolean; accord: boolean; app: boolean;
  objectif: { plan_id: string; course_nom: string; course_date: string; demarre: boolean; prevu: string | null;
    semaine: number | null; total: number | null; verdict: Verdict | null; ecrit: boolean } | null;
  ensuite: { texte: string; ton: 'rien' | 'action' | 'alerte'; href: string };
  // Son entrée, tant qu'elle n'est pas complète (décision coach du 22/10/2026) : « Entrée 3/5 » sur sa ligne.
  entree: { faites: number; total: number } | null;
};
type DemandeAthlete = Demande & { nom: string };
export type Niveau = 'bloque' | 'sante' | 'moteur' | 'arrive';
export const NIVEAUX: { cle: Niveau; titre: string }[] = [
  { cle: 'bloque', titre: 'Ce qui bloque' }, { cle: 'sante', titre: 'Santé' },
  { cle: 'moteur', titre: 'Décisions du moteur' }, { cle: 'arrive', titre: 'Ce qui arrive' },
];
// semaine : le geste est un bouton (Réessayer), planId le porte ; externe : le lien sort de l'app (Nolio).
export type ARegarder = { niveau: Niveau; genre: string; athlete: string; texte: string; action: string; href: string;
  planId?: string; externe?: boolean };
export type VueCoach = { athletes: LigneAthlete[]; aRegarder: ARegarder[]; demandes: DemandeAthlete[]; enRoute: number };

const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const lundiDe = (jour: string) => ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
const NOLIO = 'https://www.nolio.io/';
const ARRET: Record<string, string> = {
  reprendre: 'reprise au niveau de sa dernière semaine courue', reprise: 'une semaine de reprise allégée',
  reconstruire: 'préparation reconstruite sur la moitié de ce qu’il courait avant',
};
const MOTEUR: Record<string, string> = { R1: 'semaine en grande partie manquée', R2: 'séance clé trop dure ou écourtée' };
const TEST: Record<string, string> = { illisible: 'est illisible dans Nolio', sans_reponse: 'est resté sans réponse au questionnaire du soir', non_fait: 'n’a pas été fait' };
type Journal = { regle?: string; effet?: string; trop_dur?: boolean }[];

// membres : les athlètes de l'équipe Nolio du coach (la page les lit déjà) ; null si Nolio n'a pas répondu.
export async function vueDuCoach(coachId: string, membres: Set<string> | null = null): Promise<VueCoach> {
  const service = clientService();
  const jour = aujourdhui();
  const fiches = await athletesCoaches(coachId);
  const demandes = await demandesDuCoach(coachId).catch(() => [] as DemandeAthlete[]);
  // Le prochain objectif de chaque athlète, sinon le dernier couru.
  const prochain = (a: FicheAthlete) => a.objectifs.find((o) => o.course_date >= jour) ?? a.objectifs[a.objectifs.length - 1] ?? null;
  const ids = fiches.map(prochain).filter(Boolean).map((o) => o!.plan_id);
  const { data: plans } = ids.length
    ? await service.from('plans').select('id, parametres, demarre_le, depart_prevu, trame, course_date').in('id', ids)
    : { data: [] };
  const { data: lignes } = ids.length
    ? await service.from('semaines_ecrites').select('plan_id, numero, realise, journal, bilan, sans_ajustement, ecrite_le, donnees').in('plan_id', ids)
    : { data: [] };
  const { data: tests } = ids.length
    ? await service.from('tests_lus').select('plan_id, jour_id, statut, lu_le').in('plan_id', ids).neq('statut', 'lu')
      .gte('lu_le', new Date(Date.now() - 8 * 86400_000).toISOString())
    : { data: [] };
  const aLaMain = await plansALaMain();
  const lundi = lundiDe(jour);
  const usrs = fiches.map((a) => a.nolio_athlete_id).filter((x): x is string => Boolean(x));
  const { data: accords } = usrs.length
    ? await service.from('nolio_accords').select('nolio_athlete_id').eq('coach_id', coachId).in('nolio_athlete_id', usrs)
    : { data: [] };
  const avecAccord = new Set((accords ?? []).map((x) => String(x.nolio_athlete_id)));
  const parPlan = new Map((plans ?? []).map((p) => [p.id as string, p]));

  const aRegarder: ARegarder[] = demandes.map((d): ARegarder => {
    const le = d.champs.date_course ? `, le ${String(d.champs.date_course).split('-').reverse().join('/')}` : '';
    // Une demande de retrait (décision coach du 20/10/2026) : le coach confirme ou refuse sur la page de l'objectif.
    return estRetrait(d)
      ? { niveau: 'bloque', genre: 'demande', athlete: d.nom, action: 'Relire ›', href: `/app/coach/plan/${d.plan_id}#retrait`,
        texte: `demande le retrait de ${String(d.champs.course_nom ?? 'son objectif')}${le}.` }
      : { niveau: 'bloque', genre: 'demande', athlete: d.nom, action: 'Relire et lancer ›', href: `/app/coach/nouveau?athlete=${d.athlete_id}&demande=${d.id}`,
        texte: `demande ${String(d.champs.course_nom ?? 'un objectif')}${le}.` };
  });
  // Leurs courses A dans Nolio (décision coach du 22/10/2026, « proposer, tu valides ») : lues une fois par heure.
  const coursesA = new Map<string, CourseNolio[]>(await Promise.all(fiches
    .filter((a) => a.nolio_athlete_id && (!membres || membres.has(a.nolio_athlete_id)))
    .map(async (a) => [a.id, (await coursesGardees(a.nolio_athlete_id as string).catch(() => [] as CourseNolio[]))
      .filter((c) => c.type === 'a')] as [string, CourseNolio[]])));
  const athletes: LigneAthlete[] = fiches.map((a) => {
    const o = prochain(a);
    const p = o ? parPlan.get(o.plan_id) : undefined;
    const semaines = (lignes ?? []).filter((l) => l.plan_id === o?.plan_id);
    const realises = semaines.map((l) => l.realise as Realise | null).filter((r): r is Realise => Boolean(r))
      .sort((x, y) => Number(x.numero.slice(1)) - Number(y.numero.slice(1)));
    const trame = ((p?.trame as { semaines?: LigneTrame[] } | null)?.semaines ?? null);
    const jauge = trame ? jaugeDuPlan(trame, realises, jour) : null;
    const hrefPlan = o ? `/app/coach/plan/${o.plan_id}` : `/app/coach/athlete/${a.id}`;
    const num = (n: unknown) => String(n).replace('S', '');
    // Ce que le moteur a décidé ces 8 derniers jours, une ligne par semaine écrite : l'arrêt et la fatigue d'abord.
    for (const l of semaines) {
      const journal = (l.journal ?? []) as Journal;
      if (!journal.length || l.sans_ajustement || String(l.ecrite_le).slice(0, 10) < ajouterJours(jour, -8)) continue;
      const arret = journal.find((j) => j.regle === 'R4');
      const moteur = [...new Set(journal.map((j) => MOTEUR[j.regle ?? '']).filter(Boolean))];
      if (arret) {
        aRegarder.push({ niveau: 'sante', genre: 'arret', athlete: a.nom, action: 'Relire ›', href: hrefPlan,
          texte: String(arret.effet ?? '').startsWith('course proche')
            ? `arrêt de course à l’approche de son objectif : rien ne remonte, à toi de voir son objectif avec lui.`
            : `arrêt de course : ${ARRET[arret.effet ?? ''] ?? 'reprise adaptée'} en semaine ${num(l.numero)}.` });
      } else if (journal.some((j) => j.regle === 'R3')) {
        aRegarder.push({ niveau: 'sante', genre: 'fatigue', athlete: a.nom, action: 'Relire ›', href: hrefPlan,
          texte: `fatigue franche : sa semaine ${num(l.numero)} est allégée.` });
      } else if (moteur.length) {
        aRegarder.push({ niveau: 'moteur', genre: 'ajustement', athlete: a.nom, action: 'Relire l’ajustement ›', href: hrefPlan,
          texte: `semaine ${num(l.numero)} : ${moteur.join(', ')}.` });
      }
    }
    // La fatigue de la semaine en cours (R3 en cours de semaine) : la séance passée en EF.
    for (const l of semaines.filter((x) => (x.donnees as Semaine | null)?.lundi === lundi)) {
      for (const j of ((l.donnees as Semaine | null)?.jours ?? []) as (Semaine['jours'][number] & { origine?: { seance?: string } })[]) {
        if (j.origine) aRegarder.push({ niveau: 'sante', genre: 'fatigue', athlete: a.nom, action: 'Relire ›', href: hrefPlan,
          texte: `fatigue franche : sa séance ${j.origine.seance ?? ''} de ${j.jour.toLowerCase()} est passée en EF.` });
      }
    }
    // Un mot à la question ouverte du dimanche, ces 7 derniers jours (décision coach du 21/10/2026) : à lire dans Nolio.
    if ((a.questionnaires?.mot_le ?? '') >= ajouterJours(jour, -7)) {
      aRegarder.push({ niveau: 'sante', genre: 'mot', athlete: a.nom, action: 'Lire dans Nolio ›', href: NOLIO, externe: true,
        texte: 'a un mot pour toi dans son questionnaire du dimanche.' });
    }
    // Le RPE à revoir (décision coach du 21/10/2026) : une séance clé jugée trop dure sur son RPE deux semaines de suite.
    const deuxDernieres = [...semaines].sort((x, y) => Number(num(y.numero)) - Number(num(x.numero))).slice(0, 2);
    if (deuxDernieres.length === 2 && Number(num(deuxDernieres[0].numero)) === Number(num(deuxDernieres[1].numero)) + 1
        && deuxDernieres.every((l) => !l.sans_ajustement && ((l.journal ?? []) as Journal).some((j) => j.regle === 'R2' && j.trop_dur))
        && String(deuxDernieres[0].ecrite_le).slice(0, 10) >= ajouterJours(jour, -8)) {
      aRegarder.push({ niveau: 'sante', genre: 'rpe', athlete: a.nom, action: 'Lui écrire ›', href: NOLIO, externe: true,
        texte: 'RPE à revoir avec lui : séance clé jugée trop dure deux semaines de suite.' });
    }
    const demarre = Boolean(p?.demarre_le);
    const ecrit = Boolean(p?.parametres);
    const avenir = Boolean(o && o.course_date >= jour);
    const demande = demandes.find((d) => d.athlete_id === a.id);
    let ensuite: LigneAthlete['ensuite'];
    if (demande) ensuite = { texte: 'Objectif demandé', ton: 'action', href: `/app/coach/nouveau?athlete=${a.id}&demande=${demande.id}` };
    else if (!o || !avenir) ensuite = { texte: 'Nouvel objectif', ton: 'action', href: `/app/coach/athlete/${a.id}` };
    else if (!a.nolio_athlete_id) ensuite = { texte: 'Associer Nolio', ton: 'action', href: `/app/coach/athlete/${a.id}` };
    else if (ecrit && !demarre && !p?.depart_prevu) ensuite = { texte: 'À démarrer', ton: 'action', href: `/app/coach/plan/${o.plan_id}` };
    else if (jauge?.verdict && jauge.verdict.ton !== 'bien') ensuite = { texte: 'Lui écrire', ton: 'alerte', href: `/app/coach/athlete/${a.id}` };
    else ensuite = { texte: 'Rien à faire', ton: 'rien', href: `/app/coach/athlete/${a.id}` };
    if (o && avenir && ecrit && !demarre && !p?.depart_prevu && a.nolio_athlete_id) {
      aRegarder.push({ niveau: 'bloque', genre: 'demarrer', athlete: a.nom, action: 'Démarrer ›', href: `/app/coach/plan/${o.plan_id}`,
        texte: `${o.course_nom} n’a pas démarré dans Nolio.` });
    }
    if (o && avenir && !a.nolio_athlete_id) {
      aRegarder.push({ niveau: 'bloque', genre: 'nolio', athlete: a.nom, action: 'Associer ›', href: `/app/coach/athlete/${a.id}`,
        texte: 'son compte Nolio n’est pas encore associé à sa fiche.' });
    }
    if (a.nolio_athlete_id && membres && !membres.has(a.nolio_athlete_id)) {
      // Le message de Nolio perdu (la corbeille) : le retrait se fait d'ici, sur sa fiche.
      aRegarder.push({ niveau: 'bloque', genre: 'equipe', athlete: a.nom, action: 'Retirer ›', href: `/app/coach/athlete/${a.id}#retirer`,
        texte: 'n’est plus dans ton équipe Nolio : retire-le de l’app.' });
    } else if (a.nolio_athlete_id && !avecAccord.has(a.nolio_athlete_id)) {
      aRegarder.push({ niveau: 'bloque', genre: 'accord', athlete: a.nom, action: 'Accord reçu ›', href: '/app/coach/suivi#sans-accord',
        texte: 'sans accord de lecture : envoie-lui le message d’accord dans Nolio.' });
    }
    // La semaine en cours pas partie dans Nolio (le passage du dimanche en échec, même après ses reprises).
    if (o && avenir && ecrit && demarre && !aLaMain.has(o.plan_id) && o.course_date >= lundi && semaines.length
        && !semaines.some((l) => (l.donnees as Semaine | null)?.lundi === lundi)
        && semaines.some((l) => String((l.donnees as Semaine | null)?.lundi ?? '') < lundi)) {
      aRegarder.push({ niveau: 'bloque', genre: 'semaine', athlete: a.nom, action: 'Réessayer ›', href: hrefPlan, planId: o.plan_id,
        texte: `sa semaine du ${jourMois(lundi)} n’est pas partie dans Nolio.` });
    }
    // Ce qui arrive : une course A posée dans Nolio sans objectif ici, à créer d'un clic.
    const dejaIci = new Set([...a.objectifs.map((x) => x.course_date), ...((((p?.parametres as { courses_secondaires?: { date?: string }[] } | null)
      ?.courses_secondaires) ?? []).map((c) => String(c.date)))]);
    for (const c of pasEncoreIci(coursesA.get(a.id) ?? [], dejaIci)) {
      aRegarder.push({ niveau: 'arrive', genre: 'course_nolio', athlete: a.nom, action: 'Créer l’objectif ›',
        href: `/app/coach/nouveau?athlete=${a.id}&course=${c.id}`, texte: `${c.nom}, le ${dateLongue(c.date, true)}, est dans Nolio sans objectif ici.` });
    }
    // Ce qui arrive : une course de préparation dans les 14 jours, un objectif dans les 21 jours sans suite, un test raté.
    if (o && avenir) {
      for (const c of (((p?.parametres as { courses_secondaires?: { nom?: string; date?: string }[] } | null)?.courses_secondaires) ?? [])) {
        const dans = c.date ? joursEntre(jour, c.date) : -1;
        if (dans >= 0 && dans <= 14) aRegarder.push({ niveau: 'arrive', genre: 'preparation', athlete: a.nom, action: 'Voir ›', href: hrefPlan,
          texte: `${c.nom ?? 'sa course de préparation'} dans ${dans} jour${dans > 1 ? 's' : ''} (course de préparation).` });
      }
      const dans = joursEntre(jour, o.course_date);
      if (dans <= 21 && !a.objectifs.some((x) => x.course_date > o.course_date)) {
        aRegarder.push({ niveau: 'arrive', genre: 'suite', athlete: a.nom, action: 'Nouvel objectif ›', href: `/app/coach/nouveau?athlete=${a.id}`,
          texte: `${o.course_nom} dans ${dans} jour${dans > 1 ? 's' : ''}, rien après.` });
      }
      for (const t of (tests ?? []).filter((x) => x.plan_id === o.plan_id)) {
        const [sem, jourTest] = String(t.jour_id).split('-');
        aRegarder.push({ niveau: 'arrive', genre: 'test', athlete: a.nom, action: 'Voir ›', href: hrefPlan,
          texte: `son test du ${jourTest ?? ''} de sa semaine ${num(sem)} ${TEST[String(t.statut)] ?? 'n’a pas pu être lu'}.` });
      }
    }
    const entree = entreeDe({
      athleteId: a.id, nolio: Boolean(a.nolio_athlete_id), accord: Boolean(a.nolio_athlete_id && avecAccord.has(a.nolio_athlete_id)),
      programmation: a.programmation, dimanchesJusqua: a.questionnaires?.jusqua ?? null, aujourdhui: jour,
      objectif: o && avenir ? { plan_id: o.plan_id, ecrit, demarre, prevu: (p?.depart_prevu as string | null) ?? null } : null,
    });
    return {
      id: a.id, nom: a.nom, usr: a.nolio_athlete_id, nolio: Boolean(a.nolio_athlete_id), accord: Boolean(a.nolio_athlete_id && avecAccord.has(a.nolio_athlete_id)),
      app: Boolean(a.compte_id),
      objectif: o ? { plan_id: o.plan_id, course_nom: o.course_nom, course_date: o.course_date, demarre, prevu: (p?.depart_prevu as string | null) ?? null,
        semaine: jauge?.semaine ?? null, total: trame?.length ?? null, verdict: jauge?.verdict ?? null, ecrit } : null,
      ensuite, entree: entree.complete ? null : { faites: entree.faites, total: entree.total },
    };
  });
  const rang = (n: Niveau) => NIVEAUX.findIndex((x) => x.cle === n);
  aRegarder.sort((x, y) => rang(x.niveau) - rang(y.niveau));
  return { athletes, aRegarder, demandes, enRoute: athletes.filter((a) => a.objectif?.demarre && a.objectif.course_date >= jour).length };
}
