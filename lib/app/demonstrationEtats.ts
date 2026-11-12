/**
 * Ce que la démonstration de l'app montre (lib/app/demonstration.ts, qui la charge), état par état : le plan et son état
 * simulé par l'adresse, le tableau de bord, la semaine écrite, la semaine lue dans Nolio, les objectifs, la fiche d'une
 * course de préparation, et les états du bandeau. Développement seulement : jamais importé en production, ni lui ni ses
 * données (lib/app/demonstrationDonnees.ts).
 */
import { ETATS_DEMONSTRATION } from './demonstrationPorte';
import { donneesApp, type PlanDeDemonstration, type SemaineMontree } from './demonstrationDonnees';
import type { Contexte } from './contexte';
import type { Realise } from './ecriture';
import type { Demande } from './demandes';
import type { FichePrep } from '@/components/app/FichePreparation';
import { FAMILLES } from './charte';
import { jourDInvitation } from './invitation';
import { ajouterJours, type Plan, type Semaine } from './plan';
import { ajustementDuJournal, minutesDe } from './tableau';
import type { CourseSecondaire, DonneesTableau, EtatNolio, LectureNolio, SeanceNolio } from './tableauDuPlan';

export async function plansDeDemonstration(): Promise<Record<string, PlanDeDemonstration>> {
  return donneesApp().plans;
}
async function entree(cle: string): Promise<PlanDeDemonstration | null> {
  return (await plansDeDemonstration())[cle] ?? null;
}

// ─── L'état simulé ────────────────────────────────────────────────────────────────────────────────────────────────

export type SemaineDemo = 'lue' | 'retouchee' | 'vide' | 'muet' | 'pas_partie' | 'fatigue' | 'manquee' | 'test';
export type EtatDemo = {
  nolio: EtatNolio; accord: boolean; achat: string; confirmation: boolean; semaine: SemaineDemo; prepa: boolean;
  demarrage: boolean; profilVide: boolean; objectifDemande: boolean;
  // ?testvc=non_repropose : le test de vitesse critique plus proposé (D5, moteur 8.452 ; le journal porte la ligne TN).
  vcNonRepropose: boolean;
  // ?enchaine=1 (un coaché) : son objectif part après la récupération d'une course précédente fictive (lot 2, 12/11/2026).
  enchaine: boolean;
  // Le dimanche de la sortie qui débloque un badge (la semaine qui suit, « Nouveau badge »).
  badge: string | null;
  // Les paramètres d'état de l'adresse, que les liens gardent.
  garde: Record<string, string>;
};
const NOLIO: EtatNolio[] = ['a_inviter', 'en_cours', 'invite', 'actif', 'refuse', 'sorti', 'arrete', 'coaching'];
const SEMAINES: SemaineDemo[] = ['lue', 'retouchee', 'vide', 'muet', 'pas_partie', 'fatigue', 'manquee', 'test'];
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
type Recherche = Record<string, string | string[] | undefined>;
const texte = (r: Recherche, k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');

export type PlanDemo = { cle: string; titre: string; plan: Plan; jourNormal: string; etat: (r: Recherche, jour: string, coache: boolean) => EtatDemo };

// Le plan de la démonstration (?plan=, L4 par défaut) et de quoi lire son état.
export async function planDemo(voulu: string): Promise<PlanDemo> {
  const plans = await plansDeDemonstration();
  const cle = voulu in plans ? voulu : 'L4';
  const e = plans[cle];
  const normal = jourNormal(e);
  return {
    cle, titre: e.titre, plan: e.plan, jourNormal: normal,
    etat: (r, jour, coache) => {
      const achat = JOUR.test(texte(r, 'achat')) ? texte(r, 'achat') : e.achat;
      const voulue = texte(r, 'nolio') as EtatNolio;
      // Avant le jour de son invitation, l'acheteur n'est pas encore dans l'équipe (A, audit du 05/11/2026 : la
      // démonstration le disait toujours « dans l'équipe ») ; ensuite, il y est.
      const nolio: EtatNolio = coache ? 'coache' : NOLIO.includes(voulue) ? voulue
        : jour < jourDInvitation(e.plan.course.date_debut_plan, achat) ? 'a_inviter' : 'actif';
      const semaine = SEMAINES.includes(texte(r, 'semaine') as SemaineDemo) ? (texte(r, 'semaine') as SemaineDemo) : 'lue';
      const garde = Object.fromEntries(ETATS_DEMONSTRATION.map((k) => [k, texte(r, k)]).filter(([, v]) => v));
      return {
        nolio, accord: texte(r, 'accord') !== '0', achat, confirmation: texte(r, 'confirmation') === 'oui', semaine,
        prepa: texte(r, 'prepa') === '1' && Boolean(e.preparation), demarrage: texte(r, 'demarrage') !== 'masque',
        profilVide: texte(r, 'profil') === 'vide', objectifDemande: texte(r, 'objectif') === 'demande',
        vcNonRepropose: texte(r, 'testvc') === 'non_repropose',
        enchaine: coache && texte(r, 'enchaine') === '1',
        badge: ajouterJours(normal, -2), garde,
      };
    },
  };
}

// Le mardi d'une semaine de la trame.
const mardi = (e: PlanDeDemonstration, numero: string | undefined) => {
  const l = e.trame.semaines.find((s) => s.numero === numero);
  return l?.lundi ? ajouterJours(l.lundi, 1) : null;
};
// La semaine « normale » : celle que la fatigue et la séance manquée ajustent, pour comparer ; une saison de fond, sa
// sixième semaine.
function jourNormal(e: PlanDeDemonstration): string {
  const lignes = e.trame.semaines.filter((s) => s.lundi);
  return mardi(e, e.semaines.fatigue?.numero) ?? ajouterJours(lignes[Math.min(5, lignes.length - 1)]?.lundi ?? e.plan.course.date_debut_plan, 1);
}

// ─── Ce que lisent les écrans ─────────────────────────────────────────────────────────────────────────────────────

// La semaine que le moteur a écrite pour cet état (semaines_ecrites.donnees), sinon celle du plan.
async function semaineMontree(ctx: Contexte, numero: string): Promise<SemaineMontree | null> {
  const e = await entree(ctx.cle);
  if (!e || !ctx.demo) return null;
  if (ctx.demo.prepa && e.preparation?.semaine.numero === numero) return e.preparation.semaine;
  const s = ctx.demo.semaine;
  const montree = s === 'fatigue' || s === 'manquee' || s === 'test' ? e.semaines[s] : undefined;
  return montree?.numero === numero && montree.semaine ? montree : null;
}
export async function semaineDeDemonstration(ctx: Contexte, numero: string): Promise<Semaine | null> {
  return (await semaineMontree(ctx, numero))?.semaine ?? ctx.plan.semaines.find((s) => s.numero === numero) ?? null;
}

// Ce que le moteur a écrit dans la semaine affichée (ses notes Nolio), et la retouche du coach, pour le bandeau ; null
// hors d'un état ajusté.
export async function notesDeLaSemaine(ctx: Contexte): Promise<{ numero: string; notes: string[] } | null> {
  if (!ctx.demo || ctx.sansObjectif) return null;
  const e = await entree(ctx.cle);
  const ligne = e?.trame.semaines.find((l) => l.lundi && l.lundi <= ctx.jour && ajouterJours(l.lundi, 6) >= ctx.jour);
  const m = ligne ? await semaineMontree(ctx, ligne.numero) : null;
  const notes = [...(m?.notes ?? []).map((n) => n.texte), ...(ctx.demo.semaine === 'retouchee' ? [RETOUCHE] : [])];
  return ligne && notes.length ? { numero: ligne.numero, notes } : null;
}

// La semaine ajustée (Q7) : ?semaine=fatigue ou manquee, le journal que le moteur a gardé avec elle (R3, R8).
// ?semaine=retouchee (la semaine que son coach a retouchée dans Nolio) n'a plus rien à dire (décision 11 du coach du
// 09/11/2026) : l'app montre la semaine telle qu'elle est dans Nolio, sans marque.
export async function ajustementDeDemonstration(ctx: Contexte, numero: string): Promise<'moteur' | null> {
  if (!ctx.demo || ctx.demo.semaine === 'retouchee') return null;
  const m = await semaineMontree(ctx, numero);
  return m ? ajustementDuJournal(m.journal) : null;
}

// L'OBJECTIF ENCHAÎNÉ DE LA DÉMONSTRATION (?enchaine=1, un coaché ; lot 2, 12/11/2026) : il part au lundi de sa
// quatrième semaine, après la récupération d'une course fictive courue neuf jours plus tôt (2 h : 4 jours de
// récupération, jusqu'au lundi qui suit, lib/app/jonction.ts, debutApres). null hors de cet état.
export type EnchaineDemo = { course: string; date: string; debut: string };
async function enchaine(ctx: Contexte): Promise<EnchaineDemo | null> {
  if (!ctx.demo?.enchaine || !ctx.coache) return null;
  const e = await entree(ctx.cle);
  const debut = e?.trame.semaines.filter((l) => l.lundi)[3]?.lundi;
  return debut ? { course: 'Trail des Crêtes (fictif)', date: ajouterJours(debut, -9), debut } : null;
}
// Le niveau habituel lu dans Nolio, pour la carte de coureur : avec des semaines écoulées simulées (?retours=exemple), 5 h 30
// par semaine et une sortie de 2 h 30 ; null sinon.
export async function niveauHabituelDeDemonstration(ctx: Contexte): Promise<{ volume_min: number; sl_min: number | null } | null> {
  return ctx.exemple && !ctx.sansObjectif ? { volume_min: 330, sl_min: 150 } : null;
}

// La récupération d'avant l'objectif enchaîné, pour « Ta préparation, bloc par bloc » : du lendemain de la course à la
// veille de son début.
export async function recuperationDeDemonstration(ctx: Contexte): Promise<{ date: string; jusqua: string } | null> {
  const x = await enchaine(ctx);
  return x ? { date: x.date, jusqua: ajouterJours(x.debut, -1) } : null;
}

// Le tableau de bord : la trame et les fiches du moteur, l'état Nolio et l'accord choisis, la course de préparation ;
// avec ?retours=exemple, des semaines écoulées simulées pour voir la jauge et les graphiques. Un objectif enchaîné : ses
// semaines lues depuis son début seulement, qui est son début.
export async function tableauDeDemonstration(ctx: Contexte): Promise<DonneesTableau> {
  const e = await entree(ctx.cle);
  const demo = ctx.demo;
  const trame = (demo?.prepa && e?.preparation ? e.preparation.trame : e?.trame.semaines ?? []);
  const suite = await enchaine(ctx);
  const realises: Realise[] = !ctx.exemple ? [] : trame.filter((l) => l.lundi && ajouterJours(l.lundi, 6) < ctx.jour && (!suite || l.lundi >= suite.debut))
    .map((l, i) => {
      const prevues = l.seances_cles.length + 2;
      const manquee = i % 5 === 4 ? 1 : 0;
      const prevue = l.charge ?? Math.round(l.volume_h * 60 * 4);
      return {
        numero: l.numero, lundi: l.lundi, type: l.type, charge_prevue: prevue, charge_faite: Math.round(prevue * (manquee ? 0.8 : 1.08)),
        charge_tenue: Math.round(prevue * (manquee ? 0.8 : 0.97)), rpe_lu: true, seances_prevues: prevues, seances_faites: prevues - manquee,
        duree_prevue_min: Math.round(l.volume_h * 60), duree_faite_min: Math.round(l.volume_h * 60 * (manquee ? 0.8 : 1)),
        sl_prevue_min: l.sl_min, sl_faite_min: l.sl_min, cles_prevues: l.seances_cles.length, cles_reussies: l.seances_cles.length - (i % 4 === 3 ? 1 : 0),
        dplus_m: null, hooper: 8 + (i % 3) + (i % 7 === 6 ? 3 : 0),
      };
    });
  return {
    trame, realises, fiches: e?.trame.fiches ?? [], nolio: demo?.nolio ?? (ctx.coache ? 'coache' : 'actif'), accord: demo?.accord ?? true,
    ecrit: true, courses: demo?.prepa && e?.preparation ? [e.preparation.course] : [],
    debut: ctx.coache ? suite?.debut ?? ctx.plan.course.rejoint?.lundi ?? null : null,
  };
}

// Une semaine telle que Nolio la rend : ses séances prévues (le jour de course n'y est pas une séance).
const enSeancesNolio = (s: Semaine): SeanceNolio[] => s.jours
  .filter((j) => j.famille !== 'repos' && j.famille !== 'course' && j.seance && minutesDe(j.duree ?? '') > 0)
  .map((j) => ({ id: `demo-${j.id}`, date: j.date_iso ?? '', nom: j.seance, minutes: minutesDe(j.duree ?? ''),
    couleur: j.couleur ?? FAMILLES[j.famille as keyof typeof FAMILLES]?.filet ?? null, course: true }));
// Retouchée par le coach dans Nolio : sa première séance de qualité remplacée par un footing souple de 45 min, sa sortie
// longue raccourcie de 20 min (le bandeau le dit).
export const RETOUCHE = 'Le coach a remplacé dans Nolio la première séance de qualité par un footing souple de 45 min et raccourci la sortie longue de 20 min ; l’app montre la semaine telle qu’elle est dans Nolio.';
function retouchee(seances: SeanceNolio[], s: Semaine): SeanceNolio[] {
  const qualite = s.jours.find((j) => j.famille === 'qualite');
  const sl = s.jours.find((j) => j.famille === 'sl');
  return seances.map((x) => (qualite && x.id === `demo-${qualite.id}` ? { ...x, nom: 'Footing souple', minutes: 45, couleur: FAMILLES.ef.filet }
    : sl && x.id === `demo-${sl.id}` && x.minutes ? { ...x, minutes: Math.max(30, x.minutes - 20) } : x));
}
// La semaine que le coach pose lui-même dans Nolio (programmé à la main, sans objectif, entre deux objectifs).
const semaineDuCoach = (lundi: string): SeanceNolio[] => ([
  [1, 'Footing et 6 lignes droites', 50, '#B9C7C3'], [3, 'Côtes 8 × 1 min', 60, '#2F2D4E'],
  [5, 'Footing souple', 40, '#B9C7C3'], [6, 'Sortie longue nature', 105, '#0C6E5F'],
] as const).map(([j, nom, minutes, couleur]) => ({ id: `demo-coach-${j}`, date: ajouterJours(lundi, j), nom, minutes, couleur, course: true }));

// « Ta semaine » lue dans Nolio, dans l'ordre de lib/app/tableauDuPlan.ts (lireSemaineNolio) : pas encore partie, sans
// accord, Nolio muet, puis lue (telle que le moteur l'a écrite, retouchée par le coach, vide).
// La récupération d'un acheteur après sa course, écrite dans Nolio (PL5, 04/11/2026) : des EF courtes, la semaine qui
// suit la course (C32, audits du 05/11/2026 : « Ta semaine » reste affichée pendant la récupération).
const semaineDeRecuperation = (lundi: string): SeanceNolio[] => ([
  [1, 'EF plate', 30], [3, 'EF plate', 40], [5, 'EF vallonnée', 45],
] as const).map(([j, nom, minutes]) => ({ id: `demo-recup-${j}`, date: ajouterJours(lundi, j), nom, minutes, couleur: FAMILLES.ef.filet, course: true }));

export async function lectureDeDemonstration(ctx: Contexte, lundi: string, numero?: string): Promise<LectureNolio> {
  const demo = ctx.demo;
  if (!demo) return { seances: null, raison: 'demo' };
  const avantLeDepart = !ctx.sansObjectif && lundi < (ctx.plan.course.date_debut_plan ?? '');
  if (!ctx.coache && !numero && demo.nolio === 'actif' && lundi > ctx.plan.course.date) {
    return demo.accord ? { seances: semaineDeRecuperation(lundi), raison: 'lue' } : { seances: null, raison: 'sans_accord' };
  }
  if (!ctx.coache && (!numero || demo.nolio !== 'actif')) return { seances: null, raison: 'pas_partie' };
  // Une semaine à venir part dans Nolio le dimanche soir qui la précède (« Ta préparation », décision coach du
  // 07/11/2026) : la démonstration la montre écrite à partir de ce dimanche (?jour=).
  if (numero && (demo.semaine === 'pas_partie' || ajouterJours(lundi, -1) > ctx.jour)) return { seances: null, raison: 'pas_partie' };
  if (!demo.accord) return { seances: null, raison: 'sans_accord' };
  if (demo.semaine === 'muet') return { seances: null, raison: 'muet' };
  if (demo.semaine === 'vide') return { seances: [], raison: 'lue' };
  if (!numero) return { seances: avantLeDepart ? [] : semaineDuCoach(lundi), raison: 'lue' };
  const s = await semaineDeDemonstration(ctx, numero);
  if (!s) return { seances: [], raison: 'lue' };
  const seances = enSeancesNolio(s);
  return { seances: demo.semaine === 'retouchee' ? retouchee(seances, s) : seances, raison: 'lue' };
}

// La fiche d'une course de préparation (?course=AAAA-MM-JJ, avec ?prepa=1).
export async function ficheDeDemonstration(ctx: Contexte, date: string): Promise<FichePrep | null> {
  const e = await entree(ctx.cle);
  return ctx.demo?.prepa && e?.preparation?.course.date === date ? e.preparation.fiche : null;
}
export async function datesDesFiches(ctx: Contexte): Promise<Set<string>> {
  const e = await entree(ctx.cle);
  return new Set(ctx.demo?.prepa && e?.preparation ? [e.preparation.course.date] : []);
}

// « Tes objectifs majeurs » : l'objectif affiché ; ?objectif=demande, un objectif suivant demandé à son coach.
export function objectifsDeDemonstration(ctx: Contexte, courses: CourseSecondaire[]) {
  const demandes: Demande[] = ctx.coache && ctx.demo?.objectifDemande ? [{
    id: 'demo-demande', athlete_id: 'demo', coach_id: 'demo', gpx_chemin: null, statut: 'a_valider', cree_le: ctx.jour, plan_id: null,
    champs: { course_nom: 'Trail Alsace 47k', date_course: '2027-10-02' },
  }] : [];
  return {
    liste: [{ id: ctx.cle, course_nom: ctx.plan.course.nom, course_date: ctx.plan.course.date, coache: ctx.coache, preparations: courses }],
    enCours: ctx.plan.course.date >= ctx.jour ? ctx.cle : null, demandes,
  };
}

// Le profil d'entraînement d'un coaché : celui du plan affiché ; ?profil=vide, pas encore rempli.
export async function profilDEntrainementDeDemonstration(ctx: Contexte): Promise<Record<string, string | string[]>> {
  if (ctx.demo?.profilVide) return {};
  const e = await entree(ctx.cle || 'L4');
  return { anciennete: 'plus_5', entrainement: 'structure', ...(e?.profil_entrainement ?? {}) };
}
export async function niveauDeDemonstration(ctx: Contexte): Promise<string> {
  return (await entree(ctx.cle))?.niveau ?? '';
}

// ─── Les états du bandeau ─────────────────────────────────────────────────────────────────────────────────────────

export type EtatDuBandeau = { titre: string; href: string };
export type GroupeDuBandeau = { titre: string; etats: EtatDuBandeau[] };

const adresse = (chemin: string, params: Record<string, string | undefined>) => {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][]);
  const q = p.toString();
  return q ? `${chemin}?${q}` : chemin;
};

// Les états à parcourir, pour les deux versions, datés sur les plans de la démonstration.
export async function etatsDuBandeau(): Promise<GroupeDuBandeau[]> {
  const plans = await plansDeDemonstration();
  const L4 = plans.L4;
  const debut = L4.plan.course.date_debut_plan;
  const course = L4.plan.course.date;
  const normal = jourNormal(L4);
  const invitation = jourDInvitation(debut, L4.achat);
  const recent = ajouterJours(debut, -12);
  const prep = L4.preparation;
  const t = (titre: string, chemin: string, params: Record<string, string | undefined>): EtatDuBandeau =>
    ({ titre, href: adresse(chemin, { plan: 'L4', ...params }) });
  const ex = { retours: 'exemple' };
  const versions = (coache: boolean): EtatDuBandeau[] => {
    const c = coache ? { coache: '1' } : {};
    const n = { ...c, jour: normal, ...ex };
    return [
      t('Semaine normale', '/app', n),
      t('Sans accord de lecture', '/app', { ...n, accord: '0' }),
      t('Ta semaine retouchée par le coach dans Nolio', '/app', { ...n, semaine: 'retouchee' }),
      t('Rien de prévu dans Nolio cette semaine', '/app', { ...n, semaine: 'vide' }),
      t('Nolio ne répond pas', '/app', { ...n, semaine: 'muet' }),
      t('Semaine pas encore partie dans Nolio', '/app', { ...n, semaine: 'pas_partie' }),
      // Q7 (05/11/2026 au soir) : la semaine écrite d'après la semaine passée (le moteur) ; plus d'étiquette « Semaine
      // ajustée » (décision 11 du coach du 09/11/2026).
      t('Semaine écrite d’après la fatigue', '/app', { ...n, semaine: 'fatigue' }),
      t('Semaine écrite après une séance manquée', '/app', { ...n, semaine: 'manquee' }),
      // Q14 : la ligne de la semaine d'un test ; sans accord, « Entrer mon résultat » (un acheteur).
      t('Semaine de test (première semaine, sans repère)', '/app', { ...c, jour: mardi(L4, L4.semaines.test?.numero) ?? ajouterJours(debut, 1), semaine: 'test' }),
      ...(coache ? [] : [t('Semaine de test, sans accord (« Entrer mon résultat »)', '/app', { jour: mardi(L4, L4.semaines.test?.numero) ?? ajouterJours(debut, 1), semaine: 'test', accord: '0' })]),
      // Q2 : les séances « Back-to-back » de Nolio s'affichent « Week-end choc ».
      t('Semaine de week-end choc', '/app', { ...c, jour: mardi(L4, L4.semaines.choc?.numero) ?? normal, ...ex }),
      ...(prep ? [
        t('Course de préparation ajoutée (sa semaine)', '/app', { ...c, jour: mardi(L4, prep.semaine.numero) ?? normal, ...ex, prepa: '1' }),
        t('Mon plan avec sa course de préparation', '/app/plan', { ...c, jour: mardi(L4, prep.semaine.numero) ?? normal, ...ex, prepa: '1' }),
        t('Fiche de la course de préparation', '/app/plan/course', { ...c, jour: mardi(L4, prep.semaine.numero) ?? normal, prepa: '1', course: prep.course.date }),
      ] : []),
      t('Semaine de course', '/app', { ...c, jour: ajouterJours(course, -3), ...ex }),
      t('Jour J', '/app', { ...c, jour: course, ...ex }),
      // Q12 : la même carte « Après ta course » pour les deux versions.
      t('Récupération (« Après ta course »)', '/app', { ...c, jour: ajouterJours(course, 2), ...ex }),
      // Lot 2 (12/11/2026) : un objectif enchaîné après une course ; sa montée et ses blocs partent de son début.
      ...(coache ? [
        t('Objectif enchaîné après une course (l’accueil)', '/app', { ...n, enchaine: '1' }),
        t('Objectif enchaîné après une course (ses blocs)', '/app/plan', { ...n, enchaine: '1' }),
      ] : []),
    ];
  };
  const L1 = plans.L1;
  const R21 = plans.R21;
  const F1 = plans.F1;
  return [
    {
      titre: 'Préparation CTS · avant le départ',
      etats: [
        t('Achat récent : l’écran de bienvenue', '/app/bienvenue', { jour: ajouterJours(recent, 1), achat: recent }),
        t('Achat récent : accès Nolio à venir', '/app', { jour: ajouterJours(recent, 1), achat: recent }),
        t('Achat de plus de 3 semaines : accès Nolio à venir', '/app', { jour: ajouterJours(invitation, -10) }),
        t('Invitation partie : confirmation de charge, Nolio relié', '/app', { jour: ajouterJours(invitation, 2) }),
        t('Confirmation de charge déjà répondue', '/app', { jour: ajouterJours(invitation, 2), confirmation: 'oui' }),
        t('Invitation Nolio pas encore acceptée', '/app', { jour: ajouterJours(invitation, 2), nolio: 'invite', confirmation: 'oui' }),
        t('Invitation Nolio qui n’a pas abouti', '/app', { jour: ajouterJours(invitation, 2), nolio: 'refuse', confirmation: 'oui' }),
        t('Sans accord de lecture, avant le départ', '/app', { jour: ajouterJours(invitation, 2), accord: '0', confirmation: 'oui' }),
        t('« Pour bien démarrer » masquée', '/app', { jour: ajouterJours(invitation, 2), demarrage: 'masque', confirmation: 'oui' }),
      ],
    },
    { titre: 'Préparation CTS · pendant', etats: [
      ...versions(false),
      // D5 (moteur 8.452) : la carte de l'accueil quand le test de vitesse critique n'est plus proposé (validée le 05/11/2026).
      t('Test de vitesse critique plus proposé (deux fois sans résultat)', '/app', { jour: normal, ...ex, testvc: 'non_repropose' }),
    ] },
    {
      titre: 'Préparation CTS · après, et Nolio',
      etats: [
        t('Après la préparation (« Préparer une nouvelle course » et son prix)', '/app', { jour: ajouterJours(course, 40), ...ex }),
        // C20 : « Ta préparation est terminée dans Nolio » dans « Après ta course ».
        t('Après la course, sorti de l’équipe Nolio', '/app', { jour: ajouterJours(course, 2), ...ex, nolio: 'sorti' }),
        // C19 : l'accueil réduit à la carte d'arrêt, la fiche de course et la bibliothèque.
        t('Préparation arrêtée (remboursée)', '/app', { jour: normal, ...ex, nolio: 'arrete' }),
        t('Sorti de l’équipe Nolio avant la course', '/app', { jour: normal, ...ex, nolio: 'sorti' }),
        // La carte Nolio s'affiche aussi avec « Pour bien démarrer » (corrigé le 05/11/2026 au soir : l'accueil restait sans
        // elle tant que la liste n'était pas masquée) ; « Ta semaine » montre la semaine du plan, sans rien de Nolio (« 3 A »).
        t('Plan acheté pendant un coaching', '/app', { jour: normal, nolio: 'coaching' }),
        t('Ta séance d’origine (lien d’une note Nolio)', '/app/garder', { seance: `${L4.semaines.fatigue?.numero ?? 'S11'}-mardi` }),
        t('Nouvel objectif : l’aiguillage', '/app/objectif/nouveau', { jour: ajouterJours(course, 40) }),
      ],
    },
    {
      titre: 'Coaching individualisé · avant le départ',
      etats: [
        t('Avant le départ', '/app', { coache: '1', jour: ajouterJours(debut, -5) }),
        t('Pour bien démarrer : profil à remplir, accord à donner', '/app', { coache: '1', jour: ajouterJours(debut, -5), accord: '0', profil: 'vide' }),
      ],
    },
    { titre: 'Coaching individualisé · pendant', etats: versions(true) },
    {
      titre: 'Coaching individualisé · après, et autres cas',
      etats: [
        // Q17 : une seule carte « Ton prochain objectif », en tête ; sa demande partie, « Annuler ».
        t('Entre deux objectifs', '/app', { coache: '1', jour: ajouterJours(course, 40), ...ex }),
        t('Entre deux objectifs : demande en attente (« Annuler »)', '/app', { coache: '1', jour: ajouterJours(course, 40), ...ex, objectif: 'demande' }),
        t('Objectif suivant demandé : demande envoyée', '/app/plan', { coache: '1', jour: ajouterJours(course, 40), ...ex, demande: 'envoyee', objectif: 'demande' }),
        // Q16 : le bouton « Ta fiche de course » ; C47 : ses phrases sur Données et Profil.
        t('Programmé à la main', '/app', { coache: '1', main: '1', jour: normal }),
        t('Programmé à la main : ses données', '/app/donnees', { coache: '1', main: '1', jour: normal, ...ex }),
        t('Programmé à la main : son profil', '/app/profil', { coache: '1', main: '1', jour: normal }),
        t('Programmé à la main, sans accord', '/app', { coache: '1', main: '1', jour: normal, accord: '0' }),
        { titre: 'Saison de fond (sans objectif à préparer)', href: adresse('/app', { plan: 'F1', coache: '1', jour: jourNormal(F1), retours: 'exemple' }) },
        { titre: 'Saison de fond : semaine de tests', href: adresse('/app', { plan: 'F1', coache: '1', jour: mardi(F1, F1.semaines.test?.numero) ?? jourNormal(F1), semaine: 'test' }) },
        { titre: 'Sans objectif', href: adresse('/app', { sansobjectif: '1' }) },
        { titre: 'Sans objectif : demande envoyée', href: adresse('/app', { sansobjectif: '1', demande: 'envoyee' }) },
        { titre: 'Sans objectif : profil à remplir, accord à donner', href: adresse('/app', { sansobjectif: '1', accord: '0', profil: 'vide' }) },
        // C41 et C46 : la carte du volume dit quand elle arrive ; le Compte montre Nolio et l'accord.
        { titre: 'Sans objectif : ses données', href: adresse('/app/donnees', { sansobjectif: '1' }) },
        { titre: 'Sans objectif : son compte', href: adresse('/app/compte', { sansobjectif: '1' }) },
      ],
    },
    {
      // Les autres écrans de la revue du 05/11/2026 au soir.
      titre: 'Profil, tests, données, compte',
      etats: [
        t('Bienvenue en pleine préparation (C10)', '/app/bienvenue', { jour: normal }),
        t('Profil sans repère (Q6-e, tuiles « à tester »)', '/app/profil', { jour: normal }),
        t('Profil avec repères (« Ton style de coureur »)', '/app/profil', { jour: normal, fc1: '150', vc: '13.5', fc2: '170', v1: '10.8' }),
        t('Profil sans accord (Q6-f, les badges)', '/app/profil', { jour: normal, accord: '0' }),
        t('Tes tests (Q13 : la saisie en tête)', '/app/plan/zones', { jour: normal }),
        t('Tes tests, protocole du test de la parole ouvert', '/app/plan/zones', { jour: normal, protocole: 'parole' }),
        t('Tes données (Q15 : les mêmes semaines)', '/app/donnees', { jour: normal, ...ex }),
        t('Tes données sans accord', '/app/donnees', { jour: normal, ...ex, accord: '0' }),
        t('Calculateur ouvert de la fiche de course (C31)', '/app/calculateurs/calculateur-nutrition', { jour: normal, heures: '7', garder: 'objectif' }),
        t('Compte d’un acheteur (« Écris-nous »)', '/app/compte', { jour: normal }),
        t('Compte d’un acheteur sans accord', '/app/compte', { jour: normal, accord: '0' }),
        { titre: 'Compte d’un coaché (« Ton coach »)', href: adresse('/app/compte', { plan: 'L4', coache: '1', jour: normal }) },
        t('Bibliothèque', '/app/bibliotheque', {}),
      ],
    },
    {
      titre: 'Autres plans et fiches de course',
      etats: [
        t('Fiche de course avec trace GPX (OCC)', '/app/plan/course', { jour: normal }),
        { titre: 'Fiche de course sans trace (GRF18)', href: adresse('/app/plan/course', { plan: 'L1', jour: jourNormal(L1) }) },
        { titre: 'Débutant, 3 séances (GRF18)', href: adresse('/app', { plan: 'L1', jour: jourNormal(L1), retours: 'exemple' }) },
        { titre: 'Objectif sur route (semi-marathon)', href: adresse('/app', { plan: 'R21', jour: jourNormal(R21), retours: 'exemple' }) },
        { titre: 'Fiche de course sur route', href: adresse('/app/plan/course', { plan: 'R21', jour: jourNormal(R21) }) },
        { titre: 'Coaché sur route', href: adresse('/app', { plan: 'R21', coache: '1', jour: jourNormal(R21), retours: 'exemple' }) },
      ],
    },
  ];
}
