/**
 * L'accueil de l'espace coach (maquette validée par le coach le 19/10/2026) : ses athlètes, chacun avec son prochain
 * objectif, sa semaine, l'état de sa préparation (la jauge de l'athlète, T4), Nolio et l'app ; et « À regarder »,
 * ce qui attend le coach, d'abord. « À regarder » (décision coach du 21/10/2026, « une liste, quatre niveaux ») : tout
 * ce qui demande son intervention, classé par urgence, chaque ligne avec son geste — ce qui bloque (objectif demandé,
 * Nolio à associer ou quitté, accord manquant, objectif pas démarré, semaine pas partie), la santé (un arrêt qui dure,
 * RPE à revoir, sans retour, sous le plan, un mot pour lui), ce qui arrive (course de préparation, objectif sans suite,
 * test illisible, course A de Nolio sans objectif, deux courses trop proches). Les décisions du moteur n'y sont plus
 * (« Le moteur s'en est chargé », 04/11/2026), ni les choix de l'athlète (disponibilités, séance en plus) : son objectif
 * les montre. Tout vient de la base, sauf l'équipe Nolio
 * que la page lit déjà et les courses A de Nolio, lues une fois par heure ; les signaux du soir s'y ajoutent sur « Cette
 * semaine » (cetteSemaine.ts), qui en fait une carte par coaché et le signal de chacun dans « Mes athlètes ». Côté
 * serveur seulement.
 */
import { alerteChronoRoute, prerequisMarathon } from './route';
import { athletesCoaches, type FicheAthlete } from './coaching';
import { demandesDuCoach, estRetrait, type Demande } from './demandes';
import { coursesGardees, pasEncoreIci, type CourseNolio } from './coursesNolio';
import { entreeDe } from './entree';
import { cleLaissee, debutApres, plansALaMain, trameDuPlan, type Realise, type Trame } from './ecriture';
import { lireTemps } from '@/lib/plan';
import { ajouterJours, dateAbregee, dateLongue, jourMois, joursEntre, type Semaine } from './plan';
import { athletesNolio, ErreurNolio, nolioConfigure, type AthleteNolio } from './nolio';
import { clientService } from './supabase';
import { jaugeDuPlan, weekEndChoc, type Verdict } from './tableau';

export type LigneAthlete = {
  id: string; nom: string; usr: string | null; nolio: boolean; accord: boolean; app: boolean;
  objectif: { plan_id: string; course_nom: string; course_date: string; demarre: boolean; prevu: string | null;
    semaine: number | null; total: number | null; verdict: Verdict | null; ecrit: boolean;
    cours: { numero: string; type: string; bloc: string } | null;
    // Une saison de fond (décisions coach du 24/10/2026) : son numéro, le thème de la semaine, ses tests dans n semaines.
    fond?: { saison: number; theme: string | null; tests_dans: number | null } } | null;
  // Son entrée, tant qu'elle n'est pas complète (décision coach du 22/10/2026) : « Entrée 3/5 » sur sa ligne.
  entree: { faites: number; total: number } | null;
  // Le tableau de bord (décision coach du 24/10/2026) : sa programmation, sa semaine passée (la dernière complète, du
  // lundi d'avant au dimanche qui le suit, déjà résumée : séances faites sur prévues, charge tenue ; ses dates sous les
  // titres du tableau, décision 2A du 05/11/2026), son Hooper de dimanche et sa tendance. Son signal vient de « Cette
  // semaine » (cetteSemaine.ts, signalDe).
  // coache : false pour une fiche passée en mode plan avant le 04/11/2026 (le mode n'est plus dans l'interface) : rien ne
  // s'écrit pour elle ni ne la signale ici, elle se lit comme programmée à la main (aLaMain).
  coache: boolean; aLaMain: boolean;
  semaine: { faites: number; prevues: number; tenue: number | null } | null;
  hooper: { valeur: number; tendance: 'hausse' | 'baisse' | 'stable' | null } | null;
};
type DemandeAthlete = Demande & { nom: string };
// La trame du moteur (POST /v1/trame) : une saison de fond y porte sa place et le lundi de ses tests.
type TrameLue = Trame & { fond?: { saison: number; tests_le: string; tests_les?: string[] } };
// Les décisions du moteur ne sont plus des lignes d'« À regarder » : « Le moteur s'en est chargé » les lit dans les
// semaines écrites (décision coach du 04/11/2026).
export type Niveau = 'bloque' | 'sante' | 'arrive';
export const NIVEAUX: { cle: Niveau; titre: string }[] = [
  { cle: 'bloque', titre: 'Ce qui bloque' }, { cle: 'sante', titre: 'Santé' }, { cle: 'arrive', titre: 'Ce qui arrive' },
];
// semaine : le geste est un bouton (Réessayer), planId le porte ; externe : le lien sort de l'app (Nolio).
// cle : ce point-là (décision coach du 24/10/2026, « Réglé ») — son genre et ce qu'il désigne ; réglé, il ne revient
// jamais, un nouveau point du même genre (une autre semaine, course, test, un autre mot ou chrono) a une autre clé.
// detail : la ligne courte sous son signal dans « Mes athlètes » (décision 1A du coach, 05/11/2026), quand le texte ne la
// donne pas (la date du questionnaire d'un mot, la durée d'un arrêt).
export type ARegarder = { niveau: Niveau; genre: string; athlete: string; texte: string; action: string; href: string;
  cle: string; planId?: string; externe?: boolean; detail?: string };
export type VueCoach = { athletes: LigneAthlete[]; aRegarder: ARegarder[] };

const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const lundiDe = (jour: string) => ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
const NOLIO = 'https://www.nolio.io/';
// Le week-end choc s'annonce un mois avant (FT1-3).
const WEEK_END_CHOC_PREVENIR_JOURS = 30;
// AC4 : la part de la charge prévue sous laquelle une semaine compte « sous le plan ».
const SOUS_LE_PLAN = 0.8;
const TEST: Record<string, string> = { illisible: 'est illisible dans Nolio', sans_reponse: 'est resté sans réponse au questionnaire du soir', non_fait: 'n’a pas été fait' };
type Journal = { regle?: string; effet?: string; trop_dur?: boolean; jours?: number }[];
// L'équipe Nolio du coach, que le tableau de bord et « À regarder » lisent à l'ouverture ; sans réponse de Nolio,
// personne, et la raison.
export async function equipeNolio(): Promise<{ nolio: AthleteNolio[] | null; erreur: string | null }> {
  if (!nolioConfigure()) return { nolio: null, erreur: null };
  try {
    return { nolio: await athletesNolio(), erreur: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Athlètes Nolio :', message);
    return { nolio: null, erreur: e instanceof ErreurNolio ? message : 'Nolio ne répond pas pour l’instant : réessaie dans un moment.' };
  }
}

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
  // Les semaines que le passage a laissées au coach, ses séances posées avant lui (B-EC-5) : pas « pas parties ».
  const { data: laissees } = ids.length
    ? await service.from('nolio_envois').select('plan_id').in('plan_id', ids).eq('semaine', cleLaissee(lundi))
    : { data: [] };
  const laisseesAuCoach = new Set((laissees ?? []).map((x) => x.plan_id as string));
  const usrs = fiches.map((a) => a.nolio_athlete_id).filter((x): x is string => Boolean(x));
  const { data: accords } = usrs.length
    ? await service.from('nolio_accords').select('nolio_athlete_id').eq('coach_id', coachId).in('nolio_athlete_id', usrs)
    : { data: [] };
  const avecAccord = new Set((accords ?? []).map((x) => String(x.nolio_athlete_id)));
  const parPlan = new Map((plans ?? []).map((p) => [p.id as string, p]));
  // La trame de chaque plan (B-EC-8, bogue du 05/11/2026) : celle gardée avec lui, sinon redemandée au moteur et gardée de
  // nouveau (trameDuPlan, comme la page du plan et l'app de l'athlète). Chaque écriture qui change ses paramètres l'efface
  // (la semaine du dimanche, une reprise, le moteur d'une nouvelle version la nuit) : lue telle quelle, elle manquait
  // jusqu'à l'ouverture de la page du plan — « Entre deux semaines », ni séances ni charge tenue, la saison de fond pas
  // reconnue. Redemandée une fois, pour les seules trames effacées, puis gardée jusqu'à la prochaine écriture.
  const trames = new Map<string, TrameLue | null>(await Promise.all((plans ?? []).map(async (p) => [p.id as string,
    ((p.trame ?? (p.parametres ? await trameDuPlan(p.id as string).catch(() => null) : null)) as TrameLue | null)] as const)));
  // Les semaines que le moteur n'écrit pas (à la main, sans objectif), résumées chaque nuit : les deux dernières
  // complètes, pour le tableau de bord.
  const { data: horsMoteur } = fiches.length
    ? await service.from('semaines_athlete').select('athlete_id, lundi, realise').in('athlete_id', fiches.map((f) => f.id))
      .gte('lundi', ajouterJours(lundi, -14)).lt('lundi', lundi)
    : { data: [] };

  const aRegarder: ARegarder[] = demandes.map((d): ARegarder => {
    const le = d.champs.date_course ? `, le ${String(d.champs.date_course).split('-').reverse().join('/')}` : '';
    // Une demande de retrait (décision coach du 20/10/2026) : le coach confirme ou refuse sur la page de l'objectif.
    return estRetrait(d)
      ? { niveau: 'bloque', genre: 'demande', cle: `demande:${d.id}`, athlete: d.nom, action: 'Relire ›', href: `/app/coach/plan/${d.plan_id}#retrait`,
        texte: `demande le retrait de ${String(d.champs.course_nom ?? 'son objectif')}${le}.` }
      : { niveau: 'bloque', genre: 'demande', cle: `demande:${d.id}`, athlete: d.nom, action: 'Relire et lancer ›', href: `/app/coach/nouveau?athlete=${d.athlete_id}&demande=${d.id}`,
        texte: `demande ${String(d.champs.course_nom ?? 'un objectif')}${le}.` };
  });
  // Leurs courses A dans Nolio (décision coach du 22/10/2026, « proposer, tu valides ») : lues une fois par heure.
  const coursesA = new Map<string, CourseNolio[]>(await Promise.all(fiches
    .filter((a) => a.nolio_athlete_id && (!membres || membres.has(a.nolio_athlete_id)))
    .map(async (a) => [a.id, (await coursesGardees(a.nolio_athlete_id as string).catch(() => [] as CourseNolio[]))
      .filter((c) => c.type === 'a')] as [string, CourseNolio[]])));
  const athletes: LigneAthlete[] = fiches.map((a) => {
    // Une fiche passée en mode plan avant le 04/11/2026 (le mode n'est plus dans l'interface, ni « Passer en plan » ni
    // « Passer en coaching ») : rien ne s'écrit pour elle ; sa ligne se lit comme programmée à la main, rien à regarder.
    if (a.mode === 'plan') {
      return { id: a.id, nom: a.nom, usr: a.nolio_athlete_id, nolio: Boolean(a.nolio_athlete_id),
        accord: Boolean(a.nolio_athlete_id && avecAccord.has(a.nolio_athlete_id)), app: Boolean(a.compte_id), objectif: null,
        entree: null, coache: false, aLaMain: true, semaine: null, hooper: null };
    }
    const o = prochain(a);
    const p = o ? parPlan.get(o.plan_id) : undefined;
    const semaines = (lignes ?? []).filter((l) => l.plan_id === o?.plan_id);
    const realises = semaines.map((l) => l.realise as Realise | null).filter((r): r is Realise => Boolean(r))
      .sort((x, y) => Number(x.numero.slice(1)) - Number(y.numero.slice(1)));
    const trame = (o && trames.get(o.plan_id)?.semaines) || null;
    const jauge = trame ? jaugeDuPlan(trame, realises, jour) : null;
    // Sa semaine en cours dans le plan ; sa semaine passée et celle d'avant : celles du plan, sinon celles résumées hors
    // moteur.
    const enCours = trame?.find((l) => l.lundi && l.lundi <= jour && ajouterJours(l.lundi, 6) >= jour) ?? null;
    const resumeDu = (le: string) => {
      const l = trame?.find((x) => x.lundi === le);
      const r = l ? realises.find((x) => x.numero === l.numero) : undefined;
      return r ?? ((horsMoteur ?? []).find((x) => x.athlete_id === a.id && x.lundi === le)?.realise as Realise | undefined);
    };
    const rPassee = resumeDu(ajouterJours(lundi, -7));
    const hooperPasse = rPassee?.hooper ?? null;
    const hooperAvant = resumeDu(ajouterJours(lundi, -14))?.hooper ?? null;
    const hrefPlan = o ? `/app/coach/plan/${o.plan_id}` : `/app/coach/athlete/${a.id}`;
    const num = (n: unknown) => String(n).replace('S', '');
    // Un arrêt de course que le moteur a écrit ces 8 derniers jours et qui est pour le coach : un arrêt qui dure, deux
    // semaines de suite (au-delà de 7 jours, point 11), ou à l'approche de l'objectif. Ce que le moteur règle seul (la
    // fatigue, un arrêt court, une séance clé refaite…) est dans « Le moteur s'en est chargé », une ligne par coaché et par
    // semaine (ecriture.ajustementsDuCoach ; décision coach du 04/11/2026 : plus de ligne qui la redise ici).
    const arretDe = (l: { journal?: unknown; sans_ajustement?: unknown }) => !l.sans_ajustement && ((l.journal ?? []) as Journal).some((j) => j.regle === 'R4');
    for (const l of semaines) {
      const journal = (l.journal ?? []) as Journal;
      if (!journal.length || l.sans_ajustement || String(l.ecrite_le).slice(0, 10) < ajouterJours(jour, -8)) continue;
      const arret = journal.find((j) => j.regle === 'R4');
      if (!arret) continue;
      const avant = semaines.find((x) => Number(num(x.numero)) === Number(num(l.numero)) - 1);
      const proche = String(arret.effet ?? '').startsWith('course proche');
      const dure = Boolean(avant && arretDe(avant));
      if (proche || dure) {
        // La durée sans courir, lue par le moteur au lundi de la semaine (R4) ; inconnue à l'approche de la course.
        const lundiArret = (l.donnees as Semaine | null)?.lundi ?? null;
        aRegarder.push({ niveau: 'sante', genre: 'arret', cle: `arret:${l.plan_id}:${l.numero}`, athlete: a.nom, action: 'Relire ›', href: hrefPlan,
          // BROUILLON (05/11/2026, à valider)
          ...(typeof arret.jours === 'number' ? { detail: `${arret.jours} jours sans courir${lundiArret ? ` au ${dateAbregee(lundiArret)}` : ''}` } : {}),
          texte: proche
            ? `arrêt de course à l’approche de son objectif : rien ne remonte, à toi de voir son objectif avec lui.`
            : `arrêt de course depuis plus de 7 jours, deux semaines de suite : à voir avec lui, sa reprise est en semaine ${num(l.numero)}.` });
      }
    }
    // Un mot à la question ouverte du dimanche, ces 7 derniers jours (décision coach du 21/10/2026) : à lire dans Nolio.
    if ((a.questionnaires?.mot_le ?? '') >= ajouterJours(jour, -7)) {
      aRegarder.push({ niveau: 'sante', genre: 'mot', cle: `mot:${a.id}:${a.questionnaires?.mot_le}`, athlete: a.nom, action: 'Lire dans Nolio ›', href: NOLIO, externe: true,
        // BROUILLON (05/11/2026, à valider)
        detail: `Questionnaire du ${dateAbregee(String(a.questionnaires?.mot_le))}`,
        texte: 'a un mot pour toi dans son questionnaire du samedi.' });
    }
    // Le RPE à revoir (décision coach du 21/10/2026) : une séance clé jugée trop dure sur son RPE deux semaines de suite.
    const deuxDernieres = [...semaines].sort((x, y) => Number(num(y.numero)) - Number(num(x.numero))).slice(0, 2);
    if (deuxDernieres.length === 2 && Number(num(deuxDernieres[0].numero)) === Number(num(deuxDernieres[1].numero)) + 1
        && deuxDernieres.every((l) => !l.sans_ajustement && ((l.journal ?? []) as Journal).some((j) => j.regle === 'R2' && j.trop_dur))
        && String(deuxDernieres[0].ecrite_le).slice(0, 10) >= ajouterJours(jour, -8)) {
      aRegarder.push({ niveau: 'sante', genre: 'rpe', cle: `rpe:${deuxDernieres[0].plan_id}:${deuxDernieres[0].numero}`, athlete: a.nom, action: 'Lui écrire ›', href: NOLIO, externe: true,
        texte: 'RPE à revoir avec lui : séance clé jugée trop dure deux semaines de suite.' });
    }
    // Pas de retour (AC2, décision coach du 01/11/2026, « A ») : deux semaines de suite avec des séances faites et aucun
    // RPE. Le plan continue (Nolio connaît les séances faites) ; sa note du dimanche le lui demande (moteur 8.406).
    const sansRpe = (l: { realise?: unknown }) => {
      const r = l.realise as Realise | null;
      return Boolean(r && r.seances_faites > 0 && !r.rpe_lu);
    };
    if (deuxDernieres.length === 2 && Number(num(deuxDernieres[0].numero)) === Number(num(deuxDernieres[1].numero)) + 1
        && deuxDernieres.every(sansRpe) && String(deuxDernieres[0].ecrite_le).slice(0, 10) >= ajouterJours(jour, -8)) {
      aRegarder.push({ niveau: 'sante', genre: 'retour', cle: `retour:${deuxDernieres[0].plan_id}:${deuxDernieres[0].numero}`, athlete: a.nom, action: 'Lui écrire ›', href: NOLIO, externe: true,
        texte: 'Pas de retour depuis deux semaines : ses séances sont faites, sans aucun RPE noté.' });
    }
    // Sous le plan (AC4, décision coach du 01/11/2026, « A ») : moins de 80 % de la charge prévue tenue trois semaines de
    // suite (plus de 80 % des semaines faites : un objectif atteint bien plus souvent). La semaine manquée (R1) reste au
    // moteur ; ici, le coach qui en parle avec lui.
    const troisDernieres = [...semaines].sort((x, y) => Number(num(y.numero)) - Number(num(x.numero))).slice(0, 3);
    const sousLePlan = (l: { realise?: unknown }) => {
      const r = l.realise as Realise | null;
      return Boolean(r && r.charge_prevue > 0 && r.charge_tenue < SOUS_LE_PLAN * r.charge_prevue);
    };
    if (troisDernieres.length === 3 && troisDernieres.every((l, i) => i === 0 || Number(num(troisDernieres[i - 1].numero)) === Number(num(l.numero)) + 1)
        && troisDernieres.every(sousLePlan) && String(troisDernieres[0].ecrite_le).slice(0, 10) >= ajouterJours(jour, -8)) {
      aRegarder.push({ niveau: 'sante', genre: 'sous_plan', cle: `sous_plan:${troisDernieres[0].plan_id}:${troisDernieres[0].numero}`, athlete: a.nom, action: 'Lui écrire ›', href: NOLIO, externe: true,
        texte: 'Sous le plan depuis trois semaines : moins de 80 % de la charge prévue tenue, trois semaines de suite.' });
    }
    const demarre = Boolean(p?.demarre_le);
    // Une saison de fond : ni « Nouvel objectif » à 21 jours, ni départ ; elle se renouvelle d'elle-même.
    const infosFond = (o && trames.get(o.plan_id)?.fond) || null;
    const ecrit = Boolean(p?.parametres);
    const avenir = Boolean(o && o.course_date >= jour);
    if (o && avenir && ecrit && !demarre && !p?.depart_prevu && a.nolio_athlete_id) {
      aRegarder.push({ niveau: 'bloque', genre: 'demarrer', cle: `demarrer:${o.plan_id}`, athlete: a.nom, action: 'Démarrer ›', href: `/app/coach/plan/${o.plan_id}`,
        texte: `${o.course_nom} n’a pas démarré dans Nolio.` });
    }
    if (o && avenir && !a.nolio_athlete_id) {
      aRegarder.push({ niveau: 'bloque', genre: 'nolio', cle: `nolio:${a.id}`, athlete: a.nom, action: 'Associer ›', href: `/app/coach/athlete/${a.id}`,
        texte: 'son compte Nolio n’est pas encore associé à sa fiche.' });
    }
    if (a.nolio_athlete_id && membres && !membres.has(a.nolio_athlete_id)) {
      // Le message de Nolio perdu (la corbeille) : le retrait se fait d'ici, sur sa fiche.
      aRegarder.push({ niveau: 'bloque', genre: 'equipe', cle: `equipe:${a.id}`, athlete: a.nom, action: 'Retirer ›', href: `/app/coach/athlete/${a.id}#retirer`,
        texte: 'n’est plus dans ton équipe Nolio : retire-le de l’app.' });
    } else if (a.nolio_athlete_id && !avecAccord.has(a.nolio_athlete_id)) {
      // « Accord reçu » se coche sur sa fiche, dans « Son entrée » (le Suivi des 7 jours est supprimé, 04/11/2026).
      aRegarder.push({ niveau: 'bloque', genre: 'accord', cle: `accord:${a.id}`, athlete: a.nom, action: 'Accord reçu ›', href: `/app/coach/athlete/${a.id}#son-entree`,
        texte: 'sans accord de lecture : envoie-lui le message d’accord dans Nolio.' });
    }
    // Sans objectif ni profil de coureur (25/10/2026 : 4 saisons de fond refusées en silence par le moteur, faute de
    // niveau, de terrain, de jour de sortie longue ou de nombre de séances) : sa saison ne peut pas partir.
    const profilComplet = ['niveau', 'terrain', 'jour_sl', 'freq_hebdo', 'jours_disponibles']
      .every((k) => a.profil?.[k] !== undefined && String(a.profil[k]).length > 0);
    if (a.programmation !== 'main' && a.nolio_athlete_id && !a.objectifs.length && !profilComplet) {
      aRegarder.push({ niveau: 'bloque', genre: 'profil', cle: `profil:${a.id}`, athlete: a.nom, action: 'Son profil ›',
        href: `/app/coach/athlete/${a.id}#son-profil`, texte: 'profil de coureur à remplir : sa saison de fond ne peut pas partir sans lui.' });
    }
    // La semaine en cours pas partie dans Nolio (le passage du dimanche en échec, même après ses reprises). La première
    // d'une saison de fond aussi (25/10/2026 : sans semaine écrite avant, elle passait inaperçue).
    const premiereDeSaison = Boolean(infosFond && p?.demarre_le && String(p.demarre_le) <= lundi);
    if (o && avenir && ecrit && demarre && !aLaMain.has(o.plan_id) && o.course_date >= lundi && !laisseesAuCoach.has(o.plan_id)
        && !semaines.some((l) => (l.donnees as Semaine | null)?.lundi === lundi)
        && (premiereDeSaison || semaines.some((l) => String((l.donnees as Semaine | null)?.lundi ?? '') < lundi))) {
      aRegarder.push({ niveau: 'bloque', genre: 'semaine', cle: `semaine:${o.plan_id}:${lundi}`, athlete: a.nom, action: 'Réessayer ›', href: hrefPlan, planId: o.plan_id,
        texte: `sa semaine du ${jourMois(lundi)} n’est pas partie dans Nolio.` });
    }
    // La route (décision 5 du 10 km, 23/10/2026) : un chrono visé totalement incohérent avec sa VC, à en parler avec lui.
    const champsPlan = ((p?.parametres as { champs?: Record<string, unknown> } | null)?.champs) ?? {};
    const chronoRoute = o && avenir ? alerteChronoRoute(champsPlan.format, champsPlan.temps_cible, a.vc_ms) : null;
    if (chronoRoute) {
      aRegarder.push({ niveau: 'arrive', genre: 'chrono_route', cle: `chrono_route:${o!.plan_id}:${champsPlan.temps_cible}:${a.vc_ms}`, athlete: a.nom, action: 'Lui écrire ›', href: NOLIO, externe: true,
        texte: `${o!.course_nom} : ${chronoRoute}` });
    }
    // Les prérequis du marathon (décision 5 du marathon) : la préparation qu'il lui reste, du lundi qui vient à la course.
    const prerequis = o && avenir ? prerequisMarathon(champsPlan, Math.floor(joursEntre(jour, o.course_date) / 7)) : null;
    if (prerequis) {
      aRegarder.push({ niveau: 'arrive', genre: 'prerequis', cle: `prerequis:${o!.plan_id}:${o!.course_date}`, athlete: a.nom, action: 'Voir ›', href: hrefPlan,
        texte: `${o!.course_nom} : ${prerequis}` });
    }
    // Ce qui arrive : une course A posée dans Nolio sans objectif ici, à créer d'un clic.
    const dejaIci = new Set([...a.objectifs.map((x) => x.course_date), ...((((p?.parametres as { courses_secondaires?: { date?: string }[] } | null)
      ?.courses_secondaires) ?? []).map((c) => String(c.date)))]);
    for (const c of pasEncoreIci(coursesA.get(a.id) ?? [], dejaIci)) {
      aRegarder.push({ niveau: 'arrive', genre: 'course_nolio', cle: `course_nolio:${a.id}:${c.id}:${c.date}`, athlete: a.nom, action: 'Créer l’objectif ›',
        href: `/app/coach/nouveau?athlete=${a.id}&course=${c.id}`, texte: `${c.nom}, le ${dateLongue(c.date, true)}, est dans Nolio sans objectif ici.` });
    }
    // Ce qui arrive : une course de préparation dans les 14 jours, un objectif dans les 21 jours sans suite, un test raté.
    if (o && avenir && !infosFond) {
      for (const c of (((p?.parametres as { courses_secondaires?: { nom?: string; date?: string }[] } | null)?.courses_secondaires) ?? [])) {
        const dans = c.date ? joursEntre(jour, c.date) : -1;
        if (dans >= 0 && dans <= 14) aRegarder.push({ niveau: 'arrive', genre: 'preparation', cle: `preparation:${o.plan_id}:${c.date}`, athlete: a.nom, action: 'Voir ›', href: hrefPlan,
          texte: `${c.nom ?? 'sa course de préparation'} dans ${dans} jour${dans > 1 ? 's' : ''} (course de préparation).` });
      }
      // Le week-end choc, un mois avant (FT1-3, décision coach du 01/11/2026 : « dans mon app coach, une notification me
      // disant de prévenir mon athlète 1 mois avant ») : l'athlète d'un coaching ne reçoit ses semaines qu'une à une.
      // Le plan vendu n'en a pas besoin : il part en entier dans Nolio.
      const choc = trame && !aLaMain.has(o.plan_id) ? weekEndChoc(trame, jour) : null;
      const dansChoc = choc ? joursEntre(jour, choc.samedi) : -1;
      if (choc && dansChoc >= 0 && dansChoc <= WEEK_END_CHOC_PREVENIR_JOURS) {
        aRegarder.push({ niveau: 'arrive', genre: 'week_end_choc', cle: `week_end_choc:${o.plan_id}:${choc.samedi}`, athlete: a.nom,
          action: 'Lui écrire ›', href: NOLIO, externe: true,
          texte: `son week-end choc, le ${dateLongue(choc.samedi)} et le ${dateLongue(choc.dimanche)} : préviens-le, sur un terrain le plus proche possible de celui de sa course.` });
      }
      const dans = joursEntre(jour, o.course_date);
      if (dans <= 21 && !a.objectifs.some((x) => x.course_date > o.course_date)) {
        aRegarder.push({ niveau: 'arrive', genre: 'suite', cle: `suite:${o.plan_id}:${o.course_date}`, athlete: a.nom, action: 'Nouvel objectif ›', href: `/app/coach/nouveau?athlete=${a.id}`,
          texte: `${o.course_nom} dans ${dans} jour${dans > 1 ? 's' : ''}, rien après.` });
      }
      for (const t of (tests ?? []).filter((x) => x.plan_id === o.plan_id)) {
        const [sem, jourTest] = String(t.jour_id).split('-');
        aRegarder.push({ niveau: 'arrive', genre: 'test', cle: `test:${t.plan_id}:${t.jour_id}:${t.statut}`, athlete: a.nom, action: 'Voir ›', href: hrefPlan,
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
        semaine: jauge?.semaine ?? null, total: trame?.length ?? null, verdict: jauge?.verdict ?? null, ecrit,
        cours: enCours ? { numero: enCours.numero, type: enCours.type, bloc: enCours.bloc } : null,
        ...(infosFond ? { fond: { saison: infosFond.saison, theme: (enCours as { theme?: string } | null)?.theme ?? null,
          tests_dans: Math.max(0, Math.round(joursEntre(jour, (infosFond.tests_les ?? [infosFond.tests_le])
            .find((t) => t >= lundi) ?? infosFond.tests_le) / 7)) } } : {}) } : null,
      entree: entree.complete ? null : { faites: entree.faites, total: entree.total },
      coache: true, aLaMain: a.programmation === 'main',
      semaine: rPassee && rPassee.seances_prevues ? { faites: rPassee.seances_faites, prevues: rPassee.seances_prevues,
        tenue: rPassee.charge_prevue > 0 ? Math.round((rPassee.charge_tenue / rPassee.charge_prevue) * 100) : null } : null,
      hooper: hooperPasse !== null ? { valeur: hooperPasse, tendance: hooperAvant === null ? null
        : hooperPasse >= hooperAvant + 2 ? 'hausse' : hooperPasse <= hooperAvant - 2 ? 'baisse' : 'stable' } : null,
    };
  });
  // C5 (audit du 03/11/2026, décision coach du 04/11/2026) : une course qui tombe dans la récupération de la précédente
  // (deux jours par heure de course, jusqu'au lundi qui suit) n'a pas de préparation possible entre les deux : le coach
  // le voit dès la saisie, calculé ici sur les dates.
  const recents = fiches.map((a) => ({ a, objectifs: a.objectifs.filter((x) => x.course_date >= ajouterJours(jour, -42))
    .sort((x, y) => x.course_date.localeCompare(y.course_date)) })).filter((x) => x.objectifs.length > 1);
  const avantIds = [...new Set(recents.flatMap((x) => x.objectifs.slice(0, -1).map((o) => o.plan_id)))];
  const { data: precedents } = avantIds.length ? await service.from('plans').select('id, intake, parametres').in('id', avantIds) : { data: [] };
  const parPrecedent = new Map((precedents ?? []).map((p) => [p.id as string, p]));
  for (const { a, objectifs } of recents) {
    for (let i = 1; i < objectifs.length; i += 1) {
      const avant = objectifs[i - 1], apres = objectifs[i];
      const p = parPrecedent.get(avant.plan_id);
      const temps = lireTemps(String((p?.intake as Record<string, unknown> | null)?.temps_cible ?? ''));
      if (!p || temps === null || apres.course_date < jour) continue;
      const format = String((((p.parametres as { champs?: Record<string, unknown> } | null)?.champs) ?? {}).format ?? '');
      const reprise = debutApres({ course_date: avant.course_date, temps_h: temps, format });
      if (apres.course_date >= reprise) continue;
      aRegarder.push({ niveau: 'arrive', genre: 'courses_proches', cle: `courses_proches:${avant.plan_id}:${apres.plan_id}:${apres.course_date}`,
        athlete: a.nom, action: 'Voir ›', href: `/app/coach/plan/${apres.plan_id}`,
        texte: `${apres.course_nom}, le ${dateLongue(apres.course_date, true)}, tombe dans la récupération de ${avant.course_nom} (reprise le ${dateLongue(reprise, true)}) : pas de préparation possible entre les deux, à voir avec lui.` });
    }
  }
  // Les points que le coach a réglés (décision coach du 24/10/2026) : ce point-là ne revient jamais. Sans la migration,
  // rien n'est retenu.
  const { data: regles } = await service.from('a_regarder_regles').select('cle').eq('coach_id', coachId);
  const reglees = new Set((regles ?? []).map((r) => String(r.cle)));
  const visibles = aRegarder.filter((r) => !reglees.has(r.cle));
  const rang = (n: Niveau) => NIVEAUX.findIndex((x) => x.cle === n);
  visibles.sort((x, y) => rang(x.niveau) - rang(y.niveau));
  return { athletes, aRegarder: visibles };
}
