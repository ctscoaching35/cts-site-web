import { moteurEstV9 } from '@/lib/app/moteurEnLigne';
import Link from 'next/link';
import { formatRouteDe } from '@/lib/app/route';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import CarteSavoir from '@/components/app/CarteSavoir';
import CarteEntree from '@/components/app/CarteEntree';
import FormulaireValeurs from '@/components/app/FormulaireValeurs';
import InvitationApp from '@/components/app/InvitationApp';
import LancerSaPreparation from '@/components/app/LancerSaPreparation';
import ObjectifsAVerifier, { type LigneObjectif } from '@/components/app/ObjectifsAVerifier';
import { AjouterCourse } from '@/components/app/GestesEcriture';
import type { CourseDePreparation } from '@/components/app/CoursesDePreparation';
import VueDEnsemble from '@/components/app/VueDEnsemble';
import { detailsDeLaCourse, ligneDeTemps, rangerSesCourses, vueDuCoureur } from '@/lib/app/sesCourses';
import { alertesDuCoach, lirePrerequisDuMoteur, prochainLundi } from '@/lib/app/alerteCoach';
import { parametresDuPlanV9 } from '@/lib/app/passeUnPlanV9';
import { lireLesSemainesRecentes } from '@/lib/app/stockageV9';
import { ANCRE_DU_GESTE, TEXTES_TESTS, testsASaisir } from '@/lib/app/testsASaisir';
import PointsPourLui, { PointsAVenir } from '@/components/app/PointsPourLui';
import SonPointDuDimanche from '@/components/app/SonPointDuDimanche';
import { lireSonPoint } from '@/lib/app/lectureDuPoint';
import ProfilAthlete from '@/components/app/ProfilAthlete';
import SemainesQuiArrivent from '@/components/app/SemaineQuiArrive';
import { Geste, Regle } from '@/components/app/PointsCoach';
import { StyleCoureur, TableauZones } from '@/components/app/ZonesEtStyle';
import { lignesDuProfil } from '@/lib/app/profilEntrainement';
import TestVcCoach from '@/components/app/TestVcCoach';
import { Carte, PastilleDate, Surtitre } from '@/components/app/Ui';
import { associerNolio, changerProgrammation, renommerAthlete, retirerAcces, retirerAthlete } from '@/lib/app/actionsCoaching';
import { accordRecu, relireMaintenant, retirerAccord } from '@/lib/app/actionsSuivi';
import { adresseDuCompte } from '@/lib/app/espaceAthlete';
import { ficheAthlete } from '@/lib/app/coaching';
import { demandeDeLAthlete } from '@/lib/app/demandesCoaching';
import { initiales } from '@/lib/app/contexte';
import { entreeDe } from '@/lib/app/entree';
import {
  aFairePourLui, auPlusTot, departagerLesObjectifs, entreeDansLesReglages, estUneCourseSurRoute, etatDeLaCarte, etatDuLancement, pointsAVenir, profilEstRempli, TEXTES_PAGE_ATHLETE, verifierObjectif, type LigneAlerte, type LigneTest,
} from '@/lib/app/pageAthleteSimple';
import { reponsesReprises, valeursDeLaCarte } from '@/lib/app/carteSavoir';
import { lireGpx } from '@/lib/app/gpxV9';
import { coursesDansNolio, pasEncoreIci, type CourseNolio } from '@/lib/app/coursesNolio';
import { estUneCourseEnPreparation, TEXTES_CACHES, testsLusDisponibles } from '@/lib/app/cacherSousLaV1';
import { semainesSansSaisonPasPartie } from '@/lib/app/reessayerDeSaison';
import { espaceDuCoach } from '@/lib/app/mesAthletes';
import { montrerLInfra, pointsDeSaPage, semainesDansSesPoints, TEXTES_A_FAIRE } from '@/lib/app/espaceCoachSimple';
import { motsDuCoach } from '@/lib/app/motsDuCoach';
import { decimale, suiteDe, virgule, type Point } from '@/lib/app/espaceParAthlete';
import { semainesQuiArrivent, lundiMontre } from '@/lib/app/semaineQuiArrive';
import { semainePasseeVisible } from '@/lib/app/semainePasseeSimple';
import OuvrirLeReglage from '@/components/app/OuvrirLeReglage';
import { apresLePassage } from '@/lib/app/semainesDuDimanche';
import { athletesNolio, ErreurNolio, exigerCoach, nolioConfigure, type AthleteNolio } from '@/lib/app/nolio';
import { ajouterJours, dateAbregee, dateLongue, jMoins, type Zones } from '@/lib/app/plan';
import { allureDepuisVitesse } from '@/lib/app/allureCoach';
import { enHeures } from '@/lib/app/tableau';
import { PROFIL_VIDE, profilCoureur, type Profil } from '@/lib/app/zones';
import { reperesDeBase } from '@/lib/app/reperes';
import { demonstrationCoachOuverte } from '@/lib/app/demonstrationCoach';
import { recuperationAEcrire } from '@/lib/app/ecriture';
import { deQui } from '@/lib/app/elision';
import { attendLeCoach, TEXTES_UN_MOT } from '@/lib/app/unMot';
import { modeAppGratuite } from '@/lib/app/gratuitRegles';
import { clientService, espaceCoachOuvert } from '@/lib/app/supabase';
import type { CourseSecondaire } from '@/lib/app/tableauDuPlan';
import type { Niveau as Couleur } from '@/lib/app/prevision';

// Toujours calculée à la visite : la page lit la session du coach. « Voir ce que le moteur écrirait » calcule l'aperçu
// du dimanche dans la page (Nolio et le moteur, jusqu'à 60 s, comme l'aperçu complet).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SIGNAL_EN_CLAIR: Record<string, string> = {
  manquee: 'Séance manquée', plus_dur: 'Plus dur que prévu', sensations: 'Mauvaises sensations', hooper: 'Fatigue qui monte',
  commentaire: 'Commentaire à lire dans Nolio',
};
// La pastille de sa couleur (Q1), celle de « Dimanche ».
const PASTILLE_COULEUR: Record<Couleur, string> = {
  rouge: 'bg-[#F6E1DD] text-[#8A3326]', orange: 'bg-[#F6ECD8] text-[#6E4A0C]', vert: 'bg-[#E3EFE9] text-[#22604F]', rien: 'bg-[#ECEBF2] text-[#4A4866]',
};
const POINT_COULEUR: Record<Couleur, string> = { rouge: 'bg-[#B4513F]', orange: 'bg-[#C8952E]', vert: 'bg-[#0C6E5F]', rien: 'bg-[#A9A8BC]' };
// Les raisons de « À faire pour lui » (venues de « Cette semaine »).
const RAISON: Record<Point['niveau'], string> = { bloque: 'Ce qui bloque', sante: 'Santé', arrive: 'À venir' };
const PASTILLE_RAISON: Record<Point['niveau'], string> = {
  bloque: 'bg-[#F6E1DD] text-[#8A3326]', sante: 'bg-[#F6E3E8] text-[#8A2E4A]', arrive: 'bg-[#E3EFE9] text-[#22604F]',
};
const TENDANCE = { hausse: 'en hausse', baisse: 'en baisse', stable: 'stable' } as const;

// LA PAGE DE L'ATHLÈTE, SA VUE D'ENSEMBLE (décision « 1A » du coach, 08/11/2026 ; maquette validée le 08/11/2026, « tout
// A ») : « Athlète suivant » en haut, en bas et collé au bas de l'écran sur téléphone, dans l'ordre de « Mes athlètes »
// (Q2) ; son en-tête ; « À faire pour lui » (ses points, leur geste et « Réglé ») et sa revue du dimanche (cinq repères,
// Q3) ; « Sa semaine qui arrive » (l'aperçu du dimanche dans la page, Q4) ; sa semaine passée et ses 7 jours en une carte
// (Q5) ; ses objectifs ; ses repères, puis ses zones et son style de coureur tels qu'il les lit dans son app (Q9) ; son
// profil de coureur ; « Réglages » replié. Venue de la fiche d'un athlète coaché (CTS_NOLIO_CADRAGE.md, N8, N9, T6 ;
// maquette validée par le coach le 19/10/2026 ; décisions coach du 04/11/2026).
// SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : « un seul endroit pour ce qui est à faire », première simplification) : « Urgent » n'existe plus,
// ses points sont dans « À faire » de « Mes athlètes » ; sur cette page, ses points à lui ne sont dits qu'une fois (« À faire pour lui » ne redit ni ce que
// « Son entrée » porte déjà, ni le bouton « Réessayer » de « Sa semaine qui arrive »), et plus de message pour le développeur (la clé de l'API Nolio, la
// migration de Supabase) : il reste au journal du serveur. Sous la 8.x, rien ne change.
// DEUXIÈME SIMPLIFICATION, « une page athlète courte » (même décision 220, 24/11/2026 ; reports/Application coach — revue de simplicité, 24-11.md, proposition 2) : sous la 9.x,
// la page tient en quatre blocs, dans cet ordre : (a) « À faire pour lui » (ses alertes et ce qui manque, dont les étapes de « Son entrée » que le coach fait lui-même),
// (b) « Ce que j’ai besoin de savoir » (décision 241, moment 2, 25/11/2026 : le coureur et son objectif en un seul formulaire, ce qui manque surligné, puis « Lancer sa préparation »), (c) ses objectifs
// (la course, la date et de quoi vérifier que tout est rempli), (d) sa semaine qui arrive ; puis « Réglages », replié, où va tout le reste (sa revue du dimanche, sa semaine passée et ses 7 jours,
// ses courses dans Nolio, ses courses de préparation, ce qui arrive, son entrée complète…). Rien ne disparaît. L'ordre et ce qui manque se calculent dans
// lib/app/pageAthleteSimple.ts. Sous la 8.x, les treize blocs d'avant, dans leur ordre : le rendu est celui d'avant.
// TROISIÈME SIMPLIFICATION, « ce que la v1 ne fait pas encore est caché » (même décision 220, lib/app/cacherSousLaV1.ts) : sous la 9.x, ni l'aperçu du dimanche (« Voir ce que le moteur
// écrirait »), ni les courses de préparation (leur section de « Réglages », le lien « En préparation » d'une course de Nolio), ni la saison de fond (son lien, son nom sous le sien), ni
// les tests lus (la phrase du test de vitesse critique ne parle plus de leur lecture), ni les séances allégées en EF et « Garder la séance d'origine » (lib/app/mesAthletes.ts les ôte
// des données). Sous la 8.x, rien ne change.
// SIXIÈME ÉTAPE (même décision 220, 24/11/2026, suite) : sous la 9.x, « Sa semaine passée » ne se montre que s'il y a un réalisé à montrer (lib/app/semainePasseeSimple.ts : le moteur v1 n'en écrit pas,
// le coach voit la semaine passée dans Nolio) ; le point « Réessayer » d'une ancienne saison de fond de la 8.x ne s'affiche plus (il ne pourrait pas réussir, lib/app/reessayerDeSaison.ts) ; et
// un lien vers un réglage (une ancre dans « Réglages », replié) ouvre « Réglages » (components/app/OuvrirLeReglage.tsx, lib/app/ancresDuReglage.ts).
export default async function PageAthlete({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ apercu?: string }>;
}) {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  // Les mots du questionnaire de la semaine (lib/app/motsDuQuestionnaire.ts) : « Ta semaine prochaine » sous la 8.x, « Ton point du dimanche » sous le moteur 9.0.
  const v9 = await moteurEstV9().catch(() => false);
  // Les mots du coach (lib/app/motsDuCoach.ts, décision 220 du coach, 24/11/2026) : sous la 9.x, « fatigue déclarée », « du prévu tenu », « effort ressenti », « seuil aérobie »… à la place du jargon,
  // et une ligne d'explication sous les chiffres qui n'en disent pas assez. Sous la 8.x, les mots d'avant.
  const mots = motsDuCoach(v9);
  const { id } = await params;
  const { apercu } = await searchParams;
  const a = await ficheAthlete(coach.compteId, id);
  if (!a) notFound();
  const service = clientService();
  const relie = nolioConfigure();
  const adresse = await adresseDuCompte(a.compte_id).catch(() => null);
  // Lot A2 de l'app gratuite : la demande de coaching qui a donné cette fiche, s'il y en a une (rien en mode « coupe »).
  const demandeFiche = modeAppGratuite() === 'coupe' ? null : await demandeDeLAthlete(a.id);
  let liste: AthleteNolio[] = [];
  let erreur: string | null = null;
  try {
    liste = relie ? await athletesNolio() : [];
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Athlètes Nolio :', message);
    erreur = e instanceof ErreurNolio ? message : 'Nolio ne répond pas pour l’instant : réessaie dans un moment.';
  }
  // Sa place dans « Mes athlètes » (Q2), ses points, sa couleur et ses signaux du soir : les lectures de la liste.
  const espace = await espaceDuCoach(coach.compteId, relie && !erreur ? new Set(liste.map((x) => x.id)) : null);
  const etat = espace.lignes.find((e) => e.id === a.id) ?? null;
  const suite = suiteDe(espace.lignes, a.id);
  const { data: accord } = a.nolio_athlete_id
    ? await service.from('nolio_accords').select('accord_le').eq('coach_id', coach.compteId).eq('nolio_athlete_id', a.nolio_athlete_id).maybeSingle()
    : { data: null };
  // Ses 7 jours (EC1) : ses signaux gardés du soir (EC2) ; sans la migration du 04/11/2026, rien de gardé.
  const gardesManquent = !espace.signaux;
  const septJours = etat?.signaux ?? null;
  const { data: plans } = a.objectifs.length
    ? await service.from('plans').select('id, parametres, intake, demarre_le, depart_prevu, debut_plan, donnees->course->>distance_km, donnees->course->>dplus_m, zones:donnees->zones, lignes_zones:donnees->mode_emploi->effort->zones')
      .in('id', a.objectifs.map((o) => o.plan_id))
    : { data: [] };
  const parPlan = new Map((plans ?? []).map((p) => [p.id as string, p as Record<string, unknown>]));
  // Ses saisons de fond (décisions coach du 24/10/2026) : à part de ses objectifs ; la saison en cours, en une ligne.
  const saisons = new Set((plans ?? []).filter((p) => (p.parametres as { fond?: unknown } | null)?.fond).map((p) => p.id as string));
  const objectifs = a.objectifs.filter((o) => !saisons.has(o.plan_id));
  // PO1 : son profil, celui de sa fiche s'il a été modifié, sinon celui de son dernier objectif.
  const dernier = objectifs[objectifs.length - 1];
  const { data: intake } = dernier ? await service.from('plans').select('intake').eq('id', dernier.plan_id).maybeSingle() : { data: null };
  const deLIntake = (intake?.intake ?? {}) as Record<string, string | string[]>;
  const profil: Record<string, string | string[]> = a.profil ?? Object.fromEntries(
    ['niveau', 'terrain', 'jours_disponibles', 'jour_sl', 'freq_hebdo'].filter((k) => deLIntake[k] !== undefined).map((k) => [k, deLIntake[k]]));
  const lignesProfil = lignesDuProfil(profil, true);
  const profilVide = Object.keys(profil).length === 0;
  const source = (cle: 'fc_seuil1' | 'vc_ms' | 'fc_seuil2') => {
    const x = a.reperes_sources[cle];
    return !x ? null : x.source === 'test' ? `test lu dans Nolio le ${dateLongue(x.le, true)}`
      : x.source === 'test_coach' ? `test du ${dateLongue(x.le, true)}, saisi par toi`
      : x.source === 'athlete' ? `test saisi par l’athlète le ${dateLongue(x.le, true)}`
      : x.source === 'nolio' ? `repris de Nolio, valeur du ${dateLongue(x.le, true)}` : `saisi par toi le ${dateLongue(x.le, true)}`;
  };
  const reperes: [string, string | null, string | null][] = [
    [mots.reperes.fc1, a.fc_seuil1 ? `${a.fc_seuil1} bpm` : null, source('fc_seuil1')],
    [mots.reperes.vc, a.vc_ms ? `${allureDepuisVitesse(a.vc_ms)} /km` : null, source('vc_ms')],
    [mots.reperes.fc2, a.fc_seuil2 ? `${a.fc_seuil2} bpm` : null, source('fc_seuil2')],
  ];
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const prochain = objectifs.find((o) => o.course_date >= jour)?.plan_id ?? null;
  const saisonEnCours = a.objectifs.find((o) => saisons.has(o.plan_id) && o.course_date >= jour) ?? null;
  const nomNolio = liste.find((x) => x.id === a.nolio_athlete_id)?.name ?? null;
  // Ses courses dans Nolio pas encore dans CTS (décision coach du 22/10/2026, « proposer, tu valides ») : aucun objectif
  // ni course de préparation à leur date.
  const dejaIci = new Set([...a.objectifs.map((o) => o.course_date), ...(plans ?? []).flatMap((p) =>
    (((p.parametres as Record<string, unknown> | null)?.courses_secondaires ?? []) as CourseSecondaire[]).map((c) => c.date))]);
  const coursesPosees = a.nolio_athlete_id && relie
    ? pasEncoreIci(await coursesDansNolio(a.nolio_athlete_id).catch(() => []), dejaIci) : [];
  const courseA = coursesPosees.find((c) => c.type === 'a') ?? null;
  // Son entrée (décision coach du 22/10/2026), sur son prochain objectif.
  const pp = prochain ? parPlan.get(prochain) : undefined;
  // Une fiche passée en mode plan avant le 04/11/2026 (le mode n'est plus dans l'interface) : rien ne s'écrit pour lui,
  // elle se lit comme programmée à la main ; la bascule de programmation ne s'offre pas.
  const ancienPlan = a.mode === 'plan';
  const aLaMain = a.programmation === 'main' || ancienPlan;
  // Sa dernière réponse à son point du dimanche, en automatique comme à la main, lue dans Nolio sans être gardée de plus (lib/app/lectureDuPoint.ts).
  const sonPoint = v9 && a.nolio_athlete_id && relie && !ancienPlan && !a.ancien_le
    ? await lireSonPoint(a.nolio_athlete_id, Boolean(accord), a.questionnaires?.point?.nolio_id).catch(() => 'illisible' as const) : undefined;
  const entree = entreeDe({
    athleteId: a.id, nolio: Boolean(a.nolio_athlete_id), accord: Boolean(accord), programmation: aLaMain ? 'main' : 'auto',
    objectif: prochain ? { plan_id: prochain, ecrit: Boolean(pp?.parametres), demarre: Boolean(pp?.demarre_le),
      prevu: (pp?.depart_prevu as string | null) ?? null } : null,
    dimanchesJusqua: a.questionnaires?.jusqua ?? null, aujourdhui: jour, courseA,
  });
  // Une course B devient une préparation de son objectif en cours, à partir de lundi prochain et avant sa course.
  const lundiProchain = ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  const dateProchain = objectifs.find((o) => o.plan_id === prochain)?.course_date ?? '';
  // Sous la 9.x, la course de préparation se saisit ici (C5, 25/11/2026) : toutes ses courses de Nolio se voient, et « En préparation » ouvre le formulaire déjà rempli (le coach, 27/11/2026 : « je perds du temps si je dois tout rentrer à la main »).
  const enPreparation = (c: CourseNolio) => estUneCourseEnPreparation(c, { prochain, ecrit: Boolean(pp?.parametres), lundiProchain, dateProchain });
  const coursesNolio = coursesPosees;
  const pastilles: [string, boolean][] = [
    [a.nolio_athlete_id ? 'Nolio relié' : 'Nolio à associer', Boolean(a.nolio_athlete_id)],
    [accord ? 'Accord de lecture reçu' : 'Sans accord de lecture', Boolean(accord)],
    [a.compte_id ? 'App : ouverte' : 'App : à inviter', Boolean(a.compte_id)],
  ];
  // « Réglages » s'ouvre de lui-même quand il y a à y faire : son compte Nolio à associer, ou il a quitté l'équipe.
  const horsEquipe = Boolean(a.nolio_athlete_id && relie && !erreur && !nomNolio);
  const reglagesOuverts = !a.nolio_athlete_id || horsEquipe;
  const prenom = a.nom.split(' ')[0];
  // Ses points (« À faire pour lui », venus de « Cette semaine ») : ce qui bloque, la santé, ce qui arrive.
  const points = etat?.points ?? [];
  // Sous la 9.x, ses points une seule fois sur la page (lib/app/espaceCoachSimple.ts) : « Son entrée » dit déjà associer Nolio, « Accord reçu » et démarrer.
  const pointsIci = v9 ? pointsDeSaPage(points, entree) : points;
  const decisions = etat?.decisions ?? [];
  const allegees = decisions.flatMap((l) => l.ajustements.flatMap((x) => x.allegees.map((j) => ({ planId: x.planId, j }))));
  // Sa semaine qui arrive (Q4) : celles que le moteur écrit dimanche pour lui.
  const ecrites = espace.dimanche.ecrites.filter((e) => e.a.id === a.id);
  // Sous la 9.x, ni la semaine pas partie d'une ancienne saison de fond de la 8.x (son « Réessayer » ne pourrait pas réussir) ; sous la 8.x, toutes.
  const semaines = semainesSansSaisonPasPartie(await semainesQuiArrivent(ecrites, jour, apercu ?? null, v9), v9);
  // Une saison de fond compte vers son prochain objectif (retour coach du 01/11/2026).
  const objectifApres = objectifs.find((o) => o.course_date >= jour) ?? null;
  // Ses zones (Q9) : celles du plan qu'il lit dans son app (son prochain objectif, sa saison en cours, sinon le dernier) ;
  // sans plan, les repères du moteur, comme son app sans objectif.
  const candidats = [prochain, saisonEnCours?.plan_id, ...[...a.objectifs].reverse().map((o) => o.plan_id)].filter(Boolean) as string[];
  const avecZones = candidats.map((x) => parPlan.get(x)).find((p) => p?.zones && Array.isArray(p?.lignes_zones));
  const base = !avecZones && !demonstrationCoachOuverte() ? await reperesDeBase().catch(() => null) : null;
  const zones = (avecZones?.zones ?? base?.zones ?? null) as Zones | null;
  const lignesZones = ((avecZones?.lignes_zones ?? base?.effort.zones ?? []) as string[][]).slice(1);
  const profilZones: Profil = { ...PROFIL_VIDE, fc_seuil1: a.fc_seuil1, vc_ms: a.vc_ms, fc_seuil2: a.fc_seuil2, v_seuil1_ms: a.v_seuil1_ms, d_prime_m: a.d_prime_m };
  // Sa semaine passée (Q5), la même que dans « Mes athlètes ».
  const passee = espace.vue.semainePassee;
  const finPassee = ajouterJours(passee, 6);
  const memeMois = passee.slice(0, 7) === finPassee.slice(0, 7);
  const lundiCourt = new Date(`${passee}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).replace(/ 1$/, ' 1er');
  const periode = `du ${memeMois ? lundiCourt : dateAbregee(passee)} au ${dateAbregee(finPassee)}`;
  const s = etat?.a.semaine ?? null;
  const hooper = etat?.a.hooper ?? null;
  const r = etat?.a.realise ?? null;
  // Sous la 9.x, « Sa semaine passée » n'existe que s'il y a un réalisé à montrer (lib/app/semainePasseeSimple.ts) ; sous la 8.x, toujours (avec ses « — »).
  const aUneSemaine = semainePasseeVisible(v9, { semaine: s, hooper });
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const sousLaSemaine = r ? [
    r.cles_prevues ? `${pluriel(r.cles_reussies, 'séance')} clé${r.cles_reussies > 1 ? 's' : ''} réussie${r.cles_reussies > 1 ? 's' : ''} au bon effort sur ${r.cles_prevues}` : null,
    r.sl_prevue_min ? `sortie longue ${r.sl_faite_min ? `de ${enHeures(r.sl_faite_min)}` : 'pas faite'} pour ${enHeures(r.sl_prevue_min)} prévue` : null,
  ].filter(Boolean).join(' · ') : '';
  // SA REVUE DU DIMANCHE (Q3 « A ») : ses cinq questions, calculées sans rien saisir ; un ✓, ou un ! qui renvoie à la
  // section.
  const fenetre = lundiMontre(jour, apresLePassage(undefined, v9)) !== null;
  // « partie, retouchée par toi » (décision 11 du coach du 09/11/2026) : la semaine lue dans Nolio, une retouche marquée
  // (BROUILLON) ; plus de « partie, ajustée » (« Ce que le moteur change » n'est plus sur sa page).
  const retouchee = semaines.some((x) => x.etat === 'ecrite' && x.nolio !== null && 'comparee' in x.nolio && x.nolio.comparee.retouchee);
  const enRoute = semaines.length > 0;
  const partie = semaines.length > 0 && semaines.every((x) => x.etat === 'ecrite' || (x.etat === 'pas_partie' && x.laissee));
  const messages = points.filter((p) => p.genre === 'commentaire' || p.genre === 'mot').length;
  const profilRempli = ['niveau', 'terrain', 'jour_sl', 'freq_hebdo', 'jours_disponibles'].every((k) => profil[k] !== undefined && String(profil[k]).length > 0);
  const revue: { ok: boolean; texte: string; ancre: string }[] = [
    { ok: !fenetre || !enRoute || partie, ancre: '#semaine-qui-arrive', texte: `Sa semaine qui arrive : ${aLaMain ? 'à la main' : !enRoute ? 'rien à écrire'
      : !fenetre ? 's’écrit dimanche soir' : partie ? `partie${retouchee ? ', retouchée par toi' : ''}` : 'pas partie'}` },
    { ok: profilRempli, ancre: '#son-profil', texte: `Son profil : ${profilRempli ? 'complet' : 'à remplir'}` },
    { ok: messages === 0, ancre: '#a-faire', texte: `Ses messages : ${messages === 0 ? 'rien à lire' : `${messages} à lire`}` },
    { ok: !s || (!s.sansRpe && (s.tenue === null || s.tenue >= 80)), ancre: '#sa-semaine-passee',
      texte: `Sa semaine passée : ${!s ? 'rien de lu' : s.sansRpe ? mots.revue.sansEffort : s.tenue === null ? `${s.faites} séance${s.faites > 1 ? 's' : ''} sur ${s.prevues}` : mots.revue.tenue(s.tenue)}` },
    // Sous la 9.x, sans compte Nolio associé il n'y a pas de section « Ses courses dans Nolio » : le lien va à « Son compte Nolio » (une ancre qui existe) ; sous la 8.x, l'ancre d'avant.
    { ok: Boolean(a.nolio_athlete_id) && coursesNolio.length === 0, ancre: v9 && !a.nolio_athlete_id ? '#son-nolio' : '#courses-nolio',
      texte: `Ses courses Nolio : ${!a.nolio_athlete_id ? 'Nolio à associer' : coursesNolio.length === 0 ? 'toutes ici' : `${coursesNolio.length} pas encore ici`}` },
    // Sans « Sa semaine passée » (9.x, aucun réalisé), pas de ligne « Sa semaine passée : rien de lu » dans la revue, ni de lien vers une section qui n'existe pas.
  ].filter((x) => aUneSemaine || x.ancre !== '#sa-semaine-passee');
  // Son prochain objectif, sous son nom ; sinon sa saison en cours.
  const sousLeNom = objectifApres ? `${objectifApres.course_nom} · ${dateLongue(objectifApres.course_date, true)} · ${jMoins(jour, objectifApres.course_date)}`
    // Sous la 9.x, la saison de fond de la v1 est sans fin : ses mots seuls.
    : saisonEnCours ? v9 ? TEXTES_UN_MOT.saison : `${saisonEnCours.course_nom} · jusqu’au ${dateLongue(saisonEnCours.course_date, true)}` : null;
  const couleur = etat?.prevision.niveau ?? 'rien';
  // Sous la 9.x, « la migration du 04/11/2026 est à passer » n'est plus dite au coach : pas de « Ses 7 jours » vide, une ligne au journal.
  const septJoursVisibles = !(gardesManquent && !montrerLInfra(v9, 'Ses signaux ne sont pas encore gardés : la migration du 04/11/2026 est à passer dans Supabase.'));
  // Sous la 9.x, la section « Sa semaine passée » de « Réglages » a deux colonnes, la semaine passée (quand il y a un réalisé) et ses 7 jours (déjà géré) : sans l'une ni l'autre, pas de section.
  const septJoursAffiches = Boolean(accord && a.nolio_athlete_id && septJoursVisibles);
  const prenomDe = (nom: string) => nom.split(' ')[0];
  // SOUS LA 9.x (décision 220 du coach, 24/11/2026 : une page athlète courte ; lib/app/pageAthleteSimple.ts) : ce qui est à faire pour lui (ses points, puis les étapes de son entrée que le
  // coach fait lui-même), ce que la carte « Ce que j'ai besoin de savoir » montre, ce que chaque objectif à venir a de rempli, ce qui arrive. Rien n'est lu de plus : les mêmes données que la 8.x. Sous la 8.x, rien.
  const donnerLAccord = a.nolio_athlete_id && !accord ? accordRecu.bind(null, a.nolio_athlete_id, a.nom) : undefined;
  const { aVenir: objectifsAVenir, passes: objectifsPasses } = v9 ? departagerLesObjectifs(objectifs, jour) : { aVenir: [], passes: [] };
  // L'alerte du moteur (entrée 234, lib/app/alerteCoach.ts) : pour un objectif qui n'a pas démarré, le moteur dit si sa sortie longue de départ ou ses séances par semaine ne tiennent pas. Les paramètres sont
  // ceux que le moteur lira (parametresDuPlanV9), entrée au prochain lundi sans départ prévu ; une route qui ne répond pas ne donne pas d'alerte et ne fait rien échouer.
  const alertes: LigneAlerte[] = v9 ? (await alertesDuCoach(objectifsAVenir.flatMap((o) => {
    const p = parPlan.get(o.plan_id);
    if (!p?.parametres || p.demarre_le) return [];
    return [{ planId: o.plan_id, nom: o.course_nom, parametres: parametresDuPlanV9({
      parametres: p.parametres as Record<string, unknown>, profil: { vc_ms: a.vc_ms, fc_seuil1: a.fc_seuil1, fc_seuil2: a.fc_seuil2 }, coache: true, accordLecture: Boolean(accord),
      premierLundi: (p.depart_prevu as string | null) ?? prochainLundi(jour), reperesSources: a.reperes_sources, dPrime: a.d_prime_m,
    }, a.profil) }];
  }), lirePrerequisDuMoteur)).map((x) => ({ ...x, href: `/app/coach/nouveau?athlete=${a.id}&modifier=${x.planId}` })) : [];
  // Les tests que la v1 a écrits dans ses semaines et dont le résultat n'est pas saisi (lib/app/testsASaisir.ts) : « Saisir le résultat de son test de … », avec le geste qui mène à sa partie de la carte. La v1 ne les relit
  // pas dans Nolio ; le point tombe dès que le repère est saisi, par toi ou par lui. Sans la migration du 24/11/2026 (état du moteur v1), rien n'est lu et rien n'est dit.
  const semainesDeLaV1 = v9 ? await lireLesSemainesRecentes(service, a.objectifs.map((o) => o.plan_id), new Date(Date.now() - 70 * 86_400_000).toISOString()).catch(() => []) : [];
  const testsAFaire: LigneTest[] = v9 ? testsASaisir({ semaines: semainesDeLaV1, sources: a.reperes_sources, aujourdhui: jour }).map((t) => ({
    cle: `${t.mot}:${t.jour}`, texte: TEXTES_TESTS.saisir(t.mot), geste: t.geste, href: ANCRE_DU_GESTE[t.geste] })) : [];
  const lignesAFaire = v9 ? aFairePourLui(points, entree, !profilEstRempli(profil), alertes, testsAFaire) : [];
  // Les réponses de l'objectif (parametres.champs), lues avec celles de la fiche comme le moteur v1 les lit ; un objectif envoyé en entier n'a pas de réponses à vérifier.
  // « Ses courses » (décision 241) : chaque objectif à venir tel qu'il se lit (distance, D+, chrono visé, trace, ses courses de préparation), les majeurs dans l'ordre des dates, les courses d'une récupération sous leur majeur.
  const objectifsLus = objectifsAVenir.map((o) => {
    const p = parPlan.get(o.plan_id);
    const parametres = (p?.parametres ?? null) as { champs?: Record<string, unknown>; courses_secondaires?: CourseDePreparation[] } | null;
    const reponses = reponsesReprises((p?.intake ?? null) as Record<string, unknown> | null, parametres?.champs ?? null);
    const texte = (v: unknown) => (typeof v === 'string' ? v : '');
    return { planId: o.plan_id, nom: o.course_nom, date: o.course_date, temps_cible: texte(reponses.temps_cible), format: texte(reponses.format),
      distance_km: texte(reponses.distance_km) || String(p?.distance_km ?? ''), dplus_m: texte(reponses.dplus_m) || String(p?.dplus_m ?? ''),
      route: estUneCourseSurRoute(reponses), trace: Boolean(lireGpx(parametres?.champs?.gpx)), preparations: parametres?.courses_secondaires ?? [], parametres };
  });
  const lignesObjectifs: LigneObjectif[] = rangerSesCourses(objectifsLus).map(({ majeur: o, mineures }) => (
    { planId: o.planId, nom: o.nom, date: o.date, principal: o.planId === prochain,
      verif: o.parametres ? verifierObjectif(o.parametres.champs ?? {}, a.profil) : null, details: detailsDeLaCourse(o),
      // Ses courses de préparation (C5) : celles que l'objectif garde, quand il s'écrit semaine par semaine (il a des paramètres).
      courses: o.parametres ? (o.parametres.courses_secondaires ?? []) : null,
      mineures: mineures.map((m) => ({ planId: m.planId, nom: m.nom, date: m.date })) }));
  // Ses zones et son style, repliés dans sa carte : seulement ce qu'il y a à lire.
  const zonesEtStyle = v9 && ((zones && lignesZones.length > 0) || profilCoureur(profilZones)) ? (
    <>
      {zones && lignesZones.length > 0 && <TableauZones zones={zones} lignes={lignesZones} profil={profilZones} titre="Ses zones" plat />}
      <StyleCoureur profil={profilZones} titre="Son style de coureur" v1={aLaMain ? 'sans' : 'ecrite'} plat />
    </>
  ) : null;
  // « CE QUE J'AI BESOIN DE SAVOIR » (décision 241 du coach, 25/11/2026, moment 2) : le coureur et son objectif en cours (le prochain à venir), puis « Lancer sa préparation » s'il n'a pas démarré. Les mêmes
  // données que le reste de la page : sa fiche, et de cet objectif ses réponses (`parametres.champs`, ce que la v1 lit) par-dessus celles de son achat.
  // Un objectif à lancer qui suit une course dont la récupération n'est pas finie (v1) : il partira le lundi d'après cette course, et non au début de son plan d'achat.
  const aLancer = v9 ? objectifsAVenir[0] : undefined;
  const planALancer = aLancer ? parPlan.get(aLancer.plan_id) : undefined;
  const surRecuperation = aLancer && planALancer?.parametres && !planALancer.demarre_le ? await recuperationAEcrire(aLancer.plan_id).catch(() => null) : null;
  const carte = ((): { savoir: Omit<React.ComponentProps<typeof CarteSavoir>, 'zonesEtStyle'>; lancer: React.ComponentProps<typeof LancerSaPreparation> } | null => {
    if (!v9) return null;
    const o = objectifsAVenir[0] ?? null;
    const p = o ? parPlan.get(o.plan_id) : undefined;
    const parametres = (p?.parametres ?? null) as { champs?: Record<string, unknown> } | null;
    const champs = parametres ? parametres.champs ?? {} : null;
    const intakeDuPlan = (p?.intake ?? null) as Record<string, unknown> | null;
    const base = reponsesReprises(intakeDuPlan, champs);
    const etatCarte = etatDeLaCarte(o ? { champs } : null, a.profil);
    const lundiDeSaCourse = o ? ajouterJours(o.course_date, -((new Date(`${o.course_date}T12:00:00Z`).getUTCDay() + 6) % 7)) : lundiProchain;
    return {
      savoir: {
        athleteId: a.id, nom: a.nom, email: coach.email, aujourdhui: jour, ...etatCarte,
        valeurs: valeursDeLaCarte({ fiche: a.profil, intake: intakeDuPlan, champs, courseDate: o?.course_date ?? '', fc1: a.fc_seuil1, fc2: a.fc_seuil2, vcAllure: a.vc_ms ? allureDepuisVitesse(a.vc_ms) : null }),
        niveau: String(profil.niveau ?? ''),
        objectif: o ? {
          planId: o.plan_id, nom: o.course_nom, route: estUneCourseSurRoute(base), enRoute: Boolean(p?.demarre_le), programme: Boolean(p?.depart_prevu && !p?.demarre_le),
          envoyeEnEntier: !parametres, traceDonnee: Boolean(lireGpx(champs?.gpx)), base,
        } : null,
        reperes, allures: { vs1: a.v_seuil1_ms ? allureDepuisVitesse(a.v_seuil1_ms) : null, vc: a.vc_ms ? allureDepuisVitesse(a.vc_ms) : null },
        aideDuTest: TEXTES_CACHES.testSaisi, aideDesReperes: mots.reperesAide, titreDesZones: TEXTES_PAGE_ATHLETE.ceQuIlLit,
      },
      lancer: {
        planId: o?.plan_id ?? '',
        etat: etatDuLancement({
          objectif: o ? { ecrit: Boolean(parametres), demarre: Boolean(p?.demarre_le), prevu: (p?.depart_prevu as string | null) ?? null } : null,
          complet: etatCarte.complet, nolio: Boolean(a.nolio_athlete_id), accord: Boolean(accord), aLaMain,
        }),
        alertes: alertes.filter((x) => x.planId === o?.plan_id).flatMap((x) => x.phrases),
        premier: lundiProchain, dernier: lundiDeSaCourse, plusTot: surRecuperation ? (surRecuperation.lundi > jour ? surRecuperation.lundi : null) : auPlusTot(p?.debut_plan as string | null | undefined, jour),
      },
    };
  })();
  const lesPastilles = pastilles.map(([texte, bien]) => (
    <span key={texte} className={clsx('text-[0.72rem] font-bold px-2.5 py-1 rounded-xl',
      bien ? 'bg-[#E3EFE9] text-teal' : 'bg-[#F6ECD8] text-[#7A520D]')}>{texte}</span>
  ));
  const contenuRevue = (
    <>
      <p className="text-xs font-bold text-[#5E5C78]">Sa revue du dimanche</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {revue.map((x) => {
          const contenu = (
            <>
              <span aria-hidden className={clsx('inline-flex w-[18px] h-[18px] rounded-full items-center justify-center text-[0.6875rem] font-extrabold text-white',
                x.ok ? 'bg-teal' : 'bg-[#C8952E]')}>{x.ok ? '✓' : '!'}</span>
              {x.texte}
            </>
          );
          const classe = 'inline-flex items-center gap-1.5 min-h-8 px-2.5 rounded-[10px] bg-sand text-[0.78rem] font-semibold text-[#3B3957]';
          return <li key={x.ancre}>{x.ok ? <span className={classe}>{contenu}</span> : <a href={x.ancre} className={clsx(classe, 'hover:underline')}>{contenu}</a>}</li>;
        })}
      </ul>
    </>
  );
  const semaine = (
    <SemainesQuiArrivent semaines={semaines} prevision={etat?.prevision ?? { niveau: 'rien', pourquoi: '', prevoit: '' }} aLaMain={aLaMain}
      vers={objectifApres ? { date: objectifApres.course_date, nom: objectifApres.course_nom } : null}
      v9={v9} dansSesPoints={v9 ? semainesDansSesPoints(pointsIci) : []} />
  );
  const contenuSemainePassee = (
    <div className="flex flex-wrap gap-x-8 gap-y-5">
      {/* Sous la 9.x, sans réalisé, ni ce bloc ni son titre : « Ses 7 jours » (déjà géré) reste seul, ou rien (lib/app/semainePasseeSimple.ts). */}
      {aUneSemaine && (
        <div className="flex-[1_1_300px] min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Surtitre>Sa semaine passée</Surtitre>
            <span className="text-xs text-[#5E5C78]">{periode}</span>
          </div>
          {/* Sous la 9.x, un chiffre par ligne, avec sa ligne d'explication dessous : trois cases côte à côte n'ont pas la place d'une phrase. */}
          <div className={v9 ? 'grid gap-2' : 'grid grid-cols-3 gap-2'}>
            <div className="rounded-[12px] bg-sand p-3">
              <div className="text-xl font-extrabold">{s ? `${s.faites} / ${s.prevues}` : '—'}</div>
              <div className="text-[0.72rem] text-[#5E5C78]">séances</div>
            </div>
            <div className="rounded-[12px] bg-sand p-3">
              <div className="text-xl font-extrabold">{s?.sansRpe ? mots.tuiles.sansEffort : s && s.tenue !== null ? `${s.tenue} %` : '—'}</div>
              <div className="text-[0.72rem] text-[#5E5C78]">{mots.tuiles.tenue}</div>
              {s && !s.sansRpe && s.tenue !== null && (
                <span aria-hidden className="mt-1.5 block w-full h-1.5 rounded-full bg-indigo/10 overflow-hidden">
                  <span className={clsx('block h-full rounded-full', s.tenue >= 85 ? 'bg-teal' : s.tenue >= 65 ? 'bg-[#C8952E]' : 'bg-[#B4513F]')}
                    style={{ width: `${Math.min(100, s.tenue)}%` }} />
                </span>
              )}
              {mots.tuiles.explicationTenue && <p className="mt-1.5 text-[0.72rem] leading-snug text-[#5E5C78]">{mots.tuiles.explicationTenue}</p>}
            </div>
            <div className="rounded-[12px] bg-sand p-3">
              <div className="text-xl font-extrabold">{hooper ? hooper.valeur : '—'}</div>
              <div className="text-[0.72rem] text-[#5E5C78]">{mots.tuiles.fatigue(hooper?.tendance ? TENDANCE[hooper.tendance] : null)}</div>
              {mots.tuiles.explicationFatigue && <p className="mt-1.5 text-[0.72rem] leading-snug text-[#5E5C78]">{mots.tuiles.explicationFatigue}</p>}
            </div>
          </div>
          {sousLaSemaine && <p className="text-sm text-[#3B3957]">{sousLaSemaine.charAt(0).toUpperCase()}{sousLaSemaine.slice(1)}.</p>}
        </div>
      )}

      {accord && a.nolio_athlete_id && septJoursVisibles && (
        <div className="flex-[1_1_300px] min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Surtitre>Ses 7 jours</Surtitre>
            {septJours && (
              <span className="text-xs text-[#5E5C78]">
                Lus le {new Date(septJours.calcule_le).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {gardesManquent ? (
            <p className="text-sm text-[#4A4866]">Ses signaux ne sont pas encore gardés : la migration du 04/11/2026 est à passer.</p>
          ) : !septJours ? (
            // « Ses 7 jours » vide : validé par le coach le 08/11/2026 (la continuité entre deux objectifs, 1e).
            <p className="text-sm text-[#4A4866]">{v9 ? TEXTES_CACHES.septJoursVide : 'Rien de lu pour l’instant. Ses séances et son Hooper des 7 derniers jours se lisent dans Nolio chaque soir, dès qu’un objectif ou une saison a démarré. « Relire maintenant » les lit tout de suite.'}</p>
          ) : (
            <>
              <p className="text-sm text-[#3B3957]">
                {septJours.faites} séance{septJours.faites > 1 ? 's' : ''} faite{septJours.faites > 1 ? 's' : ''} sur {septJours.prevues}
                {/* La moyenne à la française, « 8,8 » (défaut relevé sur la maquette du 08/11/2026). */}
                {septJours.hooper ? mots.septJours.fatigue(septJours.hooper.valeur, septJours.hooper.moyenne !== null ? decimale(septJours.hooper.moyenne) : null) : ''}
                {septJours.derniere_activite ? ` · dernière activité le ${dateLongue(septJours.derniere_activite, true)}` : ''}
              </p>
              {septJours.hooper && mots.septJours.explication && <p className="text-xs text-[#5E5C78]">{mots.septJours.explication}</p>}
              {septJours.signaux.length === 0 ? <p className="text-sm text-teal font-semibold">Aucun signal.</p> : (
                <ul className="space-y-1.5 text-sm">
                  {septJours.signaux.map((x, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2">
                      <span className="font-semibold">{SIGNAL_EN_CLAIR[x.genre] ?? x.genre}</span>
                      <span className="text-[#4A4866]">{dateLongue(x.jour.slice(0, 10), true)} · {mots.enMots(virgule(x.detail))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {/* Une séance allégée en cours de semaine (Q6, venue de « Le moteur s'en est chargé »). */}
          {allegees.map(({ planId, j }) => (
            <p key={`${planId}-${j.id}`} className="text-sm text-[#4A4866]">
              {j.nom} allégée en EF (fatigue franche) ·{' '}
              <Link href={`/app/garder?plan=${planId}&seance=${encodeURIComponent(j.id)}`} className="font-semibold text-teal">Garder la séance d’origine</Link>
            </p>
          ))}
          {!gardesManquent && (
            <form action={relireMaintenant.bind(null, a.nolio_athlete_id)}>
              <button type="submit" className="min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">Relire maintenant</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
  const BOUTON_COURSE = 'inline-flex items-center min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold whitespace-nowrap';
  const contenuCoursesNolio = (
    <>
      <Surtitre>Ses courses dans Nolio</Surtitre>
      <p className="text-[0.8125rem] leading-relaxed text-[#4A4866]">Celles posées dans Nolio, par toi ou par l’athlète, et pas encore ici.</p>
      {coursesNolio.map((c) => {
        const preparation = enPreparation(c);
        const lienObjectif = `/app/coach/nouveau?athlete=${a.id}&course=${c.id}${formatRouteDe(c.distance_km, c.dplus_m) ? '&discipline=route' : ''}`;
        // La course secondaire va à l'objectif qui la suit, s'il s'écrit semaine par semaine, et à partir de lundi prochain (les règles d'enregistrerCourse).
        const suivant = [...objectifs].filter((o) => o.course_date > c.date).sort((x, y) => x.course_date.localeCompare(y.course_date))[0];
        const pourSecondaire = suivant && c.date >= lundiProchain && parPlan.get(suivant.plan_id)?.parametres ? suivant : null;
        return (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-indigo/[0.12]">
            <PastilleDate iso={c.date} />
            <span className="flex-[1_1_180px] min-w-0">
              <span className="block text-sm font-bold">{c.nom}</span>
              <span className="block text-xs text-[#5E5C78]">
                {[c.type === 'a' ? 'objectif A' : c.type === 'b' ? 'course B' : null,
                  c.distance_km ? `${c.distance_km} km` : 'distance à saisir', c.dplus_m ? mots.dplus(String(c.dplus_m)) : null].filter(Boolean).join(' · ')}
              </span>
            </span>
            {!v9 && (
              <Link href={preparation ? `/app/coach/plan/${prochain}?course=${c.id}#ajouter-course` : lienObjectif}
                className={BOUTON_COURSE}>
                {preparation ? 'En préparation ›' : 'Créer l’objectif ›'}
              </Link>
            )}
            {/* Sous la 9.x, pour chaque course, le coach choisit (27/11/2026 : « tu dois me laisser le choix entre objectif principal ou secondaire »). */}
            {v9 && (
              <div className="basis-full flex flex-wrap items-start gap-2">
                <Link href={lienObjectif} className={BOUTON_COURSE}>Objectif principal ›</Link>
                <details className="open:basis-full">
                  <summary className={clsx(BOUTON_COURSE, 'cursor-pointer list-none')}>Course secondaire ›</summary>
                  {pourSecondaire ? (
                    <>
                      <p className="mt-3 text-[0.8125rem] text-[#4A4866]">Elle s’ajoute avant « {pourSecondaire.course_nom} ». Reprise de Nolio : relis la distance, le D+ et le chrono visé.</p>
                      <div className="mt-3"><AjouterCourse planId={pourSecondaire.plan_id} initial={{ nom: c.nom, date: c.date, distance_km: c.distance_km, dplus_m: c.dplus_m, chrono: c.chrono }} sansMode /></div>
                    </>
                  ) : (
                    <p className="mt-3 text-[0.8125rem] text-[#4A4866]">{c.date < lundiProchain ? 'Elle tombe cette semaine, déjà préparée.' : 'Une course secondaire se place avant un objectif principal : crée d’abord l’objectif qui la suit.'}</p>
                  )}
                </details>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
  const contenuTest = (
    <>
      <p className="mb-3 text-[0.8125rem] leading-relaxed text-[#4A4866]">
        {testsLusDisponibles(v9) ? (
          <>
            S’il ne l’a pas fait dans l’app, ou si sa lecture dans Nolio n’a pas abouti : ses deux efforts donnent sa vitesse
            critique et son profil de coureur. Un test écrit dans ses semaines et pas encore lu est alors marqué lu.
          </>
        ) : TEXTES_CACHES.testSaisi}
      </p>
      <TestVcCoach athleteId={a.id} aujourdhui={jour} />
    </>
  );
  const contenuReperes = (
    <>
      <p className="mb-3 text-[0.8125rem] leading-relaxed text-[#4A4866]">
        {v9 ? mots.reperesAide : 'Avec eux, les séances partent avec une allure sur le plat ou une FC, puis le RPE ; sans eux, au RPE, et le test s’écrit à la place d’une séance. Gardés seulement avec son accord de lecture.'}
      </p>
      <FormulaireValeurs athleteId={a.id} fc1={a.fc_seuil1} vs1Allure={a.v_seuil1_ms ? allureDepuisVitesse(a.v_seuil1_ms) : null}
        vcAllure={a.vc_ms ? allureDepuisVitesse(a.vc_ms) : null} fc2={a.fc_seuil2} titres={mots.reperes} />
    </>
  );
  const contenuProfil = <div className="pt-2"><ProfilAthlete athleteId={a.id} profil={profil} pointDuDimanche={v9} /></div>;
  // Ce que « Réglages » montre de plus sous la 9.x (ORDRE_DES_REGLAGES_9X) : où il en est, puis, avant « Retirer cet athlète », ce qui a quitté le haut de la page.
  const sectionEtat = (
    <section className="py-4 space-y-3">
      <h3 className="text-sm font-bold">{TEXTES_PAGE_ATHLETE.ouEnEstIl}</h3>
      <div className="flex flex-wrap gap-2">{lesPastilles}</div>
    </section>
  );
  const sectionsEnPlus = (
    <>
      <PointsAVenir points={pointsAVenir(points)} />
      <section id="revue" className="py-4">{contenuRevue}</section>
      {(aUneSemaine || septJoursAffiches) && <section id="sa-semaine-passee" className="py-4 scroll-mt-6">{contenuSemainePassee}</section>}
      {objectifsPasses.length > 0 && (
        <section className="py-4 space-y-2">
          <h3 className="text-sm font-bold">{TEXTES_PAGE_ATHLETE.anciensObjectifs}</h3>
          {objectifsPasses.map((o) => (
            <Link key={o.plan_id} href={`/app/coach/plan/${o.plan_id}`} className="flex items-center gap-3.5 p-3 rounded-xl border border-indigo/[0.12] text-indigo">
              <PastilleDate iso={o.course_date} />
              <span className="flex-1 min-w-0 text-[0.9375rem] font-bold">{o.course_nom}</span>
              <span aria-hidden>›</span>
            </Link>
          ))}
        </section>
      )}
      {demandeFiche && (
        <section className="py-4">
          <Link href={`/app/coach/demandes/${demandeFiche.id}`} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">
            Sa demande de coaching, du {dateLongue(demandeFiche.envoyee_le.slice(0, 10), true)} ›
          </Link>
        </section>
      )}
      {entreeDansLesReglages(entree) && <CarteEntree entree={entree} plat />}
    </>
  );
  return (
    <CadreCoach actif="athletes" urgents={espace.urgents}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/coach" className="inline-flex items-center min-h-9 text-[0.8125rem] font-bold text-teal">‹ Mes athlètes</Link>
        {suite && (
          <div className="flex items-center gap-3">
            <span className="text-[0.78rem] font-semibold text-[#5E5C78]">{suite.rang} sur {suite.total}</span>
            {suite.suivant && (
              <Link href={`/app/coach/athlete/${suite.suivant.id}`} className="inline-flex items-center min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold whitespace-nowrap">
                <span className="hidden sm:inline">Athlète suivant : {suite.suivant.nom} ›</span><span className="sm:hidden">Suivant ›</span>
              </Link>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 !mt-2">
        <span className="w-14 h-14 rounded-full bg-[#E1EFEA] text-teal-dark flex items-center justify-center text-lg font-extrabold">{initiales(a.nom)}</span>
        <div className="flex-[1_1_240px]">
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">{a.nom}</h1>
          <details className="mt-0.5">
            <summary className="inline-flex items-center min-h-8 cursor-pointer text-[0.78rem] font-bold text-teal list-none">Corriger son nom</summary>
            <form action={renommerAthlete.bind(null, a.id)} className="mt-1 flex flex-wrap items-center gap-2">
              <input name="nom" key={a.nom} defaultValue={a.nom} maxLength={80} required aria-label="Son prénom puis son nom"
                className="min-h-10 flex-[1_1_200px] rounded-[10px] border border-indigo/20 bg-white px-3 text-sm text-indigo" />
              <button type="submit" className="min-h-10 rounded-[10px] bg-teal px-4 text-[0.8125rem] font-bold text-white">Enregistrer</button>
              <p className="basis-full text-[0.75rem] text-[#5E5C78]">Écris le prénom d’abord : la liste se classe par prénom. Rien ne change dans Nolio.</p>
            </form>
          </details>
          {sousLeNom && <p className="mt-0.5 text-sm text-[#4A4866]">{sousLeNom}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {etat && (
              <span className={clsx('inline-flex items-center gap-1.5 text-[0.72rem] font-bold px-2.5 py-1 rounded-xl', PASTILLE_COULEUR[couleur])}>
                <span aria-hidden className={clsx('w-2 h-2 rounded-full', POINT_COULEUR[couleur])} />{etat.raison}
              </span>
            )}
            {!v9 && lesPastilles}
          </div>
        </div>
      </div>

      {v9 ? (
        <>
          {/* (a) Ses alertes et ce qui est à faire pour lui ; (b) « Ce que j'ai besoin de savoir » et « Lancer sa préparation » ; (c) ses objectifs, de quoi vérifier que tout est rempli ; (d) sa
              semaine qui arrive. Le reste est dans « Réglages » (lib/app/pageAthleteSimple.ts : ORDRE_9X). */}
          {/* La vue d'ensemble, en lecture (241) : son profil et ses courses sur une ligne de temps. */}
          {carte && <VueDEnsemble coureur={vueDuCoureur(carte.savoir.valeurs, reperes, profilCoureur(profilZones))} courses={ligneDeTemps(objectifsLus, jour)} />}
          <PointsPourLui lignes={lignesAFaire} accordRecu={donnerLAccord} attend={espace.mots.some((m) => m.id === a.id && attendLeCoach(m.un))} />
          {sonPoint !== undefined && <SonPointDuDimanche point={sonPoint} usr={String(a.nolio_athlete_id)} />}
          {carte && <CarteSavoir key={`${a.id}:${carte.lancer.planId}`} {...carte.savoir} zonesEtStyle={zonesEtStyle}
            courses={<ObjectifsAVerifier athleteId={a.id} lignes={lignesObjectifs} jour={jour} plat />} />}
          {/* Ses courses dans Nolio, sous ses objectifs, bien en vue (le coach, 27/11/2026). */}
          {coursesNolio.length > 0 && <Carte id="courses-nolio" className="!p-5 space-y-3 scroll-mt-6">{contenuCoursesNolio}</Carte>}
          {carte && <LancerSaPreparation {...carte.lancer} />}
          {semaine}
        </>
      ) : (
        <>
          {/* Lot A2 de l'app gratuite : la demande de coaching qui a ouvert cette fiche reste lisible ici. */}
          {demandeFiche && (
            <Link href={`/app/coach/demandes/${demandeFiche.id}`} className="flex items-center justify-between gap-3 min-h-12 px-5 py-3 rounded-2xl bg-white border border-indigo/[0.08] text-sm font-bold text-teal">
              <span>Sa demande de coaching, du {dateLongue(demandeFiche.envoyee_le.slice(0, 10), true)}</span><span aria-hidden>›</span>
            </Link>
          )}

          {!entree.complete && (
            <CarteEntree entree={entree} accordRecu={donnerLAccord} />
          )}

          {/* « À faire pour lui » (venu de « Cette semaine ») et sa revue du dimanche (Q3). */}
          <Carte id="a-faire" className="!p-5 space-y-3 scroll-mt-6">
            <Surtitre>À faire pour lui</Surtitre>
            {pointsIci.length === 0 ? <p className="text-sm text-teal font-semibold">Rien à faire pour lui pour l’instant.</p> : (
              <ul>
                {pointsIci.map((p) => (
                  <li key={p.cle} className="flex flex-wrap items-center justify-between gap-3 py-3 border-t first:border-t-0 border-indigo/[0.07]">
                    <div className="min-w-0 flex-[1_1_280px] flex flex-wrap items-start gap-x-2 gap-y-1 text-sm text-[#4A4866] leading-snug">
                      <span className={clsx('text-[0.6875rem] font-bold px-2 py-0.5 rounded-full mt-0.5', PASTILLE_RAISON[p.niveau])}>{RAISON[p.niveau]}</span>
                      <span className="min-w-0 flex-[1_1_200px]">
                        {p.texte.charAt(0).toUpperCase()}{p.texte.slice(1)}
                        {p.sous && <span className="block mt-0.5 text-xs text-[#5E5C78]">{p.sous}</span>}
                      </span>
                    </div>
                    {!p.sansGeste && (
                      <div className="flex items-center gap-2">
                        <Geste r={p} />
                        <Regle cles={[p.cle]} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="pt-3 border-t border-indigo/[0.07]">
              {contenuRevue}
            </div>
          </Carte>

          {semaine}

          {/* Sa semaine passée et ses 7 jours, en une carte (Q5 « A ») : la semaine finie, puis les signaux des 7 derniers jours. */}
          <Carte id="sa-semaine-passee" className="!p-5 scroll-mt-6">
            {contenuSemainePassee}
          </Carte>

          {/* Deux colonnes sur ordinateur (ses objectifs, ses repères, son profil | ses zones, son style) ; une seule sur
              téléphone, dans l'ordre de la maquette : objectifs, repères, zones et style, profil. */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="contents lg:flex lg:flex-col lg:gap-5 lg:flex-[1_1_380px] lg:min-w-0">
              <Carte className="!p-5 space-y-3 order-1">
                <div className="flex justify-between items-center gap-3">
                  <Surtitre>Ses objectifs</Surtitre>
                  {/* Deux entrées (décision coach du 23/10/2026) : le trail ou la route (10 km, semi, marathon). */}
                  <Link href={`/app/coach/nouveau?athlete=${a.id}&discipline=route`} className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">
                    + Objectif route
                  </Link>
                  <Link href={`/app/coach/nouveau?athlete=${a.id}`} className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] bg-teal text-white text-[0.8125rem] font-bold">
                    + Objectif trail
                  </Link>
                </div>
                {saisonEnCours && (
                  <Link href={`/app/coach/plan/${saisonEnCours.plan_id}`} className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#E1EFEA] text-[#0B4A40]">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[0.9375rem] font-bold">{saisonEnCours.course_nom} · en cours</span>
                      <span className="block text-[0.78rem]">Jusqu’au {dateLongue(saisonEnCours.course_date, true)} · le moteur écrit ses semaines ; un objectif qui arrive prend la suite.</span>
                    </span>
                    <span aria-hidden>›</span>
                  </Link>
                )}
                {objectifs.length === 0 && <p className="text-sm text-[#4A4866]">Aucun pour l’instant.</p>}
                {objectifs.map((o) => {
                  const p = parPlan.get(o.plan_id);
                  const principal = o.plan_id === prochain;
                  const preps = (((p?.parametres as Record<string, unknown> | null)?.courses_secondaires ?? []) as CourseSecondaire[])
                    .slice().sort((x, y) => x.date.localeCompare(y.date));
                  const statut = o.course_date < jour ? 'couru'
                    : !p?.parametres ? 'envoyé en entier'
                      : aLaMain ? 'programmé à la main'
                      : p.demarre_le ? `en route dans Nolio depuis le ${dateLongue(String(p.demarre_le).slice(0, 10), true)}`
                        : p.depart_prevu ? `démarre le ${dateLongue(String(p.depart_prevu), true)}` : 'pas encore démarré';
                  const distance = p?.distance_km ? `${Math.round(Number(p.distance_km))} km` : null;
                  const dplus = p?.dplus_m ? `${Number(p.dplus_m).toLocaleString('fr-FR')} m D+` : null;
                  return (
                    <div key={o.plan_id} className="space-y-2">
                      <Link href={`/app/coach/plan/${o.plan_id}`}
                        className={clsx('flex items-center gap-3.5 p-3.5 rounded-xl', principal ? 'bg-indigo text-white' : 'border border-indigo/[0.12] text-indigo')}>
                        <PastilleDate iso={o.course_date} sombre={principal} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[0.9375rem] font-bold">{o.course_nom}{principal ? ' · objectif principal' : ''}</span>
                          <span className={clsx('block text-[0.78rem]', principal ? 'text-[#D6D5E6]' : 'text-[#5E5C78]')}>
                            {[distance, dplus, statut].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span aria-hidden>›</span>
                      </Link>
                      {preps.filter((c) => c.date >= jour).map((c) => (
                        <div key={`${c.date}-${c.nom}`} className="ml-4 flex items-center gap-3 p-3 rounded-xl border border-indigo/[0.12]">
                          <PastilleDate iso={c.date} />
                          <span className="text-[0.84rem]"><strong>{c.nom}</strong> · préparation · {c.distance_km} km{c.dplus_m ? ` · ${c.dplus_m} m D+` : ''}</span>
                        </div>
                      ))}
                      {principal && !aLaMain && Boolean(p?.parametres) && !p?.demarre_le && !p?.depart_prevu && (
                        <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-[#E1EFEA]">
                          <span className="flex-[1_1_240px] text-[0.8125rem] leading-relaxed text-[#0B4A40]">Pas encore démarré dans Nolio : la trame, ses questionnaires et sa semaine partent au départ.</span>
                          <Link href={`/app/coach/plan/${o.plan_id}`} className="inline-flex items-center min-h-11 px-4 rounded-[10px] bg-teal text-white text-[0.8125rem] font-bold">Démarrer dans Nolio</Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Carte>

              {coursesNolio.length > 0 && (
                <Carte id="courses-nolio" className="!p-5 space-y-3 order-2 scroll-mt-6">
                  {contenuCoursesNolio}
                </Carte>
              )}

              <Carte className="!p-5 space-y-1 order-3">
                <Surtitre>Ses repères</Surtitre>
                <ul className="pt-1.5">
                  {reperes.map(([titre, valeur, d]) => (
                    <li key={titre} className="flex justify-between items-center gap-3 min-h-12 border-b last:border-b-0 border-indigo/[0.06]">
                      <span><span className="block text-sm font-bold">{titre}</span>
                        <span className="block text-[0.72rem] text-[#5E5C78]">{valeur ? d ?? 'sur sa fiche' : 'le test s’écrira à la place d’une séance'}</span></span>
                      <span className={clsx('font-extrabold', valeur ? 'text-[0.9375rem]' : 'text-[0.8125rem] text-[#8A5E10]')}>{valeur ?? 'à tester'}</span>
                    </li>
                  ))}
                </ul>
                <details className="pt-2">
                  <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">Saisir son test de vitesse critique</summary>
                  {contenuTest}
                </details>
                <details className="pt-1">
                  <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">Modifier ses repères</summary>
                  {contenuReperes}
                </details>
              </Carte>

              {/* Son profil de coureur, rempli d'abord, avant son premier objectif (décision coach du 23/10/2026). */}
              <Carte id="son-profil" className="!p-5 space-y-1 scroll-mt-6 order-6">
                <Surtitre>Son profil de coureur</Surtitre>
                {profilVide ? (
                  <p className="pt-1 text-[0.8125rem] leading-relaxed text-[#4A4866]">
                    À remplir avant son premier objectif : son niveau et sa semaine habituelle. Ses objectifs ne demanderont
                    ensuite que sa course et sa charge du moment. Invité dans l’app, il peut aussi le remplir lui-même.
                  </p>
                ) : (
                  <>
                    <dl className="pt-1.5">
                      {lignesProfil.map(([cle, valeur]) => (
                        <div key={cle} className="grid grid-cols-[112px_1fr] gap-x-3 py-2.5 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem]">
                          <dt className="font-semibold text-[#5E5C78]">{cle}</dt><dd>{valeur}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="pt-1 text-[0.72rem] leading-relaxed text-[#5E5C78]">Rempli une fois. Les disponibilités de chaque semaine viennent ensuite de son questionnaire du samedi.</p>
                  </>
                )}
                <details className="pt-2" open={profilVide}>
                  <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">{profilVide ? 'Remplir son profil' : 'Modifier son profil'}</summary>
                  {contenuProfil}
                </details>
              </Carte>
            </div>

            {/* Ses zones et son style de coureur, tels qu'il les lit dans son app (Q9 « A », décision coach du 08/11/2026 :
                « réutilisé tel quel », textes au « tu »). */}
            <div className="contents lg:flex lg:flex-col lg:gap-5 lg:flex-[1_1_320px] lg:min-w-0">
              <p className="order-4 -mb-2 lg:mb-0 text-xs font-bold text-[#5E5C78]">Ce qu’il lit dans son app</p>
              {zones && lignesZones.length > 0 && (
                <div className="order-4"><TableauZones zones={zones} lignes={lignesZones} profil={profilZones} titre="Ses zones" /></div>
              )}
              <div className="order-5 space-y-5"><StyleCoureur profil={profilZones} titre="Son style de coureur" /></div>
            </div>
          </div>
        </>
      )}

      {/* « Réglages », replié (décision coach du 04/11/2026) : ce qui se règle une fois. */}
      {/* Sous la 9.x, un lien qui mène à un réglage (« Son compte Nolio », « Retirer cet athlète », sa semaine passée, ses courses…) ouvre « Réglages » : sixième étape, décision 220 du coach, 24/11/2026, suite. */}
      {v9 && <OuvrirLeReglage />}
      <details id="reglages" open={reglagesOuverts} className="group bg-white rounded-2xl border border-indigo/[0.08] scroll-mt-6">
        <summary className="cursor-pointer list-none min-h-14 px-5 flex items-center justify-between gap-3">
          <span className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Réglages</span>
          <span className="text-xs text-[#5E5C78]">{v9 ? `${TEXTES_PAGE_ATHLETE.reglagesSous} ` : 'sa programmation, l’app, son compte Nolio, son accord '}<span aria-hidden className="inline-block group-open:rotate-90">›</span></span>
        </summary>
        <div className="px-5 pb-5 divide-y divide-indigo/[0.07]">
          {v9 && sectionEtat}
          <section className="py-4 space-y-3">
            <h3 className="text-sm font-bold">Sa programmation</h3>
            <p className="text-sm leading-relaxed text-[#4A4866]">
              {ancienPlan
                ? 'Rien ne s’écrit pour lui ici : sa fiche reste pour l’historique.'
                : a.programmation === 'main'
                  ? 'À la main : tu écris ses séances dans Nolio, le moteur n’écrit rien pour lui. L’app reste son tableau de bord : sa semaine lue dans Nolio, ses données résumées chaque nuit, son profil, ses tests et ses badges ; avec un objectif, son J-, sa fiche de course et son jour J.'
                  : 'Automatique : le moteur écrit ses semaines chaque dimanche, d’après sa semaine écoulée ; tu retouches dans Nolio au besoin.'}
            </p>
            {!ancienPlan && (
              <>
                <form action={changerProgrammation.bind(null, a.id, a.programmation === 'main' ? 'auto' : 'main')}>
                  <button type="submit" className="min-h-11 px-4 rounded-[10px] border border-teal text-teal text-sm font-bold">
                    {a.programmation === 'main' ? 'Repasser en automatique' : 'Le programmer à la main'}
                  </button>
                </form>
                <p className="text-[0.72rem] leading-relaxed text-[#5E5C78]">
                  {a.programmation === 'main'
                    ? 'En automatique, l’écriture reprend au dimanche suivant ; un objectif pas encore démarré se démarre dans Nolio.'
                    : 'À la main, ce qui est déjà dans Nolio y reste ; plus rien ne s’y écrit à partir de maintenant.'}
                </p>
              </>
            )}
          </section>

          <section className="py-4 space-y-3">
            <h3 className="text-sm font-bold">Dans l’app</h3>
            <p className="text-sm leading-relaxed text-[#4A4866]">
              {adresse
                ? `Son espace est ouvert (${adresse}) : son tableau de bord, ses données, son profil, la bibliothèque. Ses séances restent dans Nolio.`
                : `${prenom} n’a pas encore accès à l’app. Invité, il reçoit un code à cette adresse pour s’y connecter, et voit son tableau de bord, ses données, son profil et la bibliothèque. Ses séances restent dans Nolio.`}
            </p>
            <InvitationApp athleteId={a.id} adresse={adresse} gardee={a.email_app} />
            {a.compte_id && (
              <form action={retirerAcces.bind(null, a.id)}>
                <button type="submit" className="text-xs text-[#5E5C78] underline underline-offset-2">Retirer son accès</button>
              </form>
            )}
          </section>

          <section id="son-nolio" className="py-4 space-y-3 scroll-mt-6">
            <h3 className="text-sm font-bold">Son compte Nolio</h3>
            {!relie ? (
              montrerLInfra(v9, 'La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).')
                ? <p className="text-sm text-[#4A4866]">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>
                : <p className="text-sm text-[#4A4866]">{TEXTES_A_FAIRE.nolioMuet}</p>
            ) : erreur ? (
              <p className="text-sm text-[#4A4866]">{v9 ? TEXTES_A_FAIRE.nolioMuet : erreur}</p>
            ) : (
              <>
                {a.nolio_athlete_id && (
                  <p className="text-[0.8125rem] text-[#4A4866]">
                    {nomNolio ? `Associé à ${nomNolio}.` : 'Associé à un athlète que Nolio ne retrouve pas dans ton équipe : choisis à nouveau son nom, ou retire-le.'}
                  </p>
                )}
                {/* La liste de l'équipe ne s'affiche qu'après « Changer » (décision coach du 04/11/2026). */}
                {a.nolio_athlete_id && nomNolio ? (
                  <details>
                    <summary className="cursor-pointer inline-flex items-center min-h-10 text-[0.8125rem] font-bold text-teal">Changer</summary>
                    <ChoixNolio athleteId={a.id} liste={liste} actuel={a.nolio_athlete_id} bouton="Changer" />
                  </details>
                ) : (
                  <ChoixNolio athleteId={a.id} liste={liste} actuel={a.nolio_athlete_id} bouton={a.nolio_athlete_id ? 'Changer' : 'Associer'} />
                )}
              </>
            )}
          </section>

          {accord && a.nolio_athlete_id && (
            <section id="accord" className="py-4 space-y-2 scroll-mt-6">
              <h3 className="text-sm font-bold">Son accord de lecture</h3>
              <p className="text-sm text-[#4A4866]">
                Reçu{accord.accord_le ? ` le ${new Date(String(accord.accord_le)).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}` : ''} : {mots.accordLu}
              </p>
              {/* B-EC-3 (audit du 03/11/2026) : une confirmation d'abord, qui dit ce qui s'efface. */}
              <details className="text-[0.8125rem]">
                <summary className="cursor-pointer inline-flex items-center min-h-10 text-[#5E5C78] underline underline-offset-2">Retirer l’accord</summary>
                <form action={retirerAccord.bind(null, a.nolio_athlete_id)} className="mt-1.5 space-y-2 max-w-md">
                  <p className="text-[#4A4866] leading-relaxed">
                    L’app ne lira plus ses séances, et ce qu’elle en a gardé s’efface : ses repères (FC, allures), les résumés de ses
                    semaines, ses signaux et ses badges. Rien ne se récupère.
                  </p>
                  <button type="submit" className="min-h-10 px-3 rounded-[10px] border border-[#8A3326]/40 bg-white text-[#8A3326] font-bold">
                    Retirer l’accord {v9 ? deQui(a.nom) : `de ${a.nom}`}
                  </button>
                </form>
              </details>
            </section>
          )}

          {v9 && sectionsEnPlus}
          <section id="retirer" className="py-4 scroll-mt-6">
            <details open={horsEquipe} className="text-[0.8125rem] text-[#5E5C78]">
              <summary className="cursor-pointer inline-flex items-center min-h-10 font-bold text-indigo">Retirer cet athlète</summary>
              <p className="mt-1">Sa fiche et ses objectifs quittent ton espace coach. Les séances déjà envoyées restent dans Nolio.</p>
              <form action={retirerAthlete.bind(null, a.id)} className="mt-2">
                <button type="submit" className="min-h-10 px-3 rounded-[10px] border border-indigo/25 bg-white text-indigo font-bold">Retirer {a.nom}</button>
              </form>
            </details>
          </section>
        </div>
      </details>

      {/* « Athlète suivant », dans l'ordre de « Mes athlètes » (Q2) : en bas de la page sur ordinateur, collé au bas de
          l'écran sur téléphone (maquette du 08/11/2026). */}
      {suite && (
        <nav aria-label="Athlète suivant" className="sticky bottom-0 z-20 -mx-4 sm:-mx-8 lg:mx-0 px-4 sm:px-8 lg:px-0 py-2.5 lg:py-0 bg-white lg:bg-transparent border-t lg:border-t-0 border-indigo/[0.12] shadow-[0_-6px_18px_rgba(31,29,56,0.08)] lg:shadow-none lg:static flex items-center justify-between gap-2">
          {suite.precedent ? (
            <Link href={`/app/coach/athlete/${suite.precedent.id}`} className="inline-flex items-center justify-center min-h-11 lg:min-h-12 px-3.5 lg:px-5 rounded-xl border border-indigo/25 bg-white text-indigo text-[0.8125rem] lg:text-sm font-bold whitespace-nowrap">
              <span className="lg:hidden">‹ {prenomDe(suite.precedent.nom)}</span><span className="hidden lg:inline">‹ {suite.precedent.nom}</span>
            </Link>
          ) : <span />}
          <span className="text-[0.78rem] font-semibold text-[#5E5C78] whitespace-nowrap">{suite.rang} sur {suite.total}</span>
          {suite.suivant ? (
            <Link href={`/app/coach/athlete/${suite.suivant.id}`} className="inline-flex items-center justify-center min-h-11 lg:min-h-12 px-3.5 lg:px-5 rounded-xl bg-teal text-white text-[0.8125rem] lg:text-sm font-bold text-center">
              <span className="lg:hidden">{suite.suivant.nom} ›</span><span className="hidden lg:inline">Athlète suivant : {suite.suivant.nom} ›</span>
            </Link>
          ) : (
            <Link href="/app/coach" className="inline-flex items-center justify-center min-h-11 lg:min-h-12 px-3.5 lg:px-5 rounded-xl bg-teal text-white text-[0.8125rem] lg:text-sm font-bold whitespace-nowrap">Mes athlètes ›</Link>
          )}
        </nav>
      )}
    </CadreCoach>
  );
}

// Son nom dans Nolio, choisi dans ton équipe.
function ChoixNolio({ athleteId, liste, actuel, bouton }: { athleteId: string; liste: AthleteNolio[]; actuel: string | null; bouton: string }) {
  return (
    <form action={associerNolio.bind(null, athleteId)} className="flex flex-wrap items-center gap-2 pt-1">
      <select name="nolio_id" defaultValue={actuel ?? ''} aria-label="Son nom dans Nolio"
        className="flex-1 min-w-[12rem] min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm text-indigo bg-white">
        <option value="" disabled>Choisis son nom</option>
        {liste.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <button type="submit" className="min-h-11 px-4 rounded-[10px] border border-teal text-teal text-sm font-bold">{bouton}</button>
    </form>
  );
}
