/**
 * Ce que le tableau de bord et « Mon plan » lisent d'un plan (lib/app/tableau.ts) : sa trame et ses fiches à leur
 * moment, ce qui a été fait chaque semaine écoulée, où en est l'athlète dans Nolio. Côté serveur seulement. Le plan
 * est celui que le contexte a choisi parmi ceux du compte connecté.
 */
import { destinataire } from './coaching';
import type { Contexte } from './contexte';
import { objectifAffiche, trameDuPlan, type LigneTrame, type Realise } from './ecriture';
import { listeNolio } from './nolio';
import { semainesDeLaFiche } from './semainesNolio';
import { ajouterJours, type CleTest, type Semaine } from './plan';
import { clientService } from './supabase';
import { ajustementDuJournal, trameDesDonnees, type Ajustement, type CourseDuGraphique, type Fiche } from './tableau';
import { ajustementDeDemonstration, lectureDeDemonstration, semaineDeDemonstration, tableauDeDemonstration } from './demonstration';

// Où en est l'athlète dans Nolio (P1 à P4) ; « coache » : un objectif de son coach ; null : un plan d'avant le
// 19/10/2026, sans Nolio.
// coache : un objectif de coaching ; coaching : un plan acheté qui ne s'écrit pas, l'athlète étant en coaching
// (décision coach du 23/10/2026).
// arrete : la préparation arrêtée par le coach, remboursée (E3, 05/11/2026 ; plans.arretee_le).
export type EtatNolio = 'a_inviter' | 'en_cours' | 'invite' | 'actif' | 'refuse' | 'sorti' | 'arrete' | 'coache' | 'coaching' | null;
export type DonneesTableau = {
  trame: LigneTrame[]; realises: Realise[]; fiches: Fiche[]; nolio: EtatNolio; accord: boolean; ecrit: boolean;
  // Les courses secondaires ajoutées (O2).
  courses: CourseSecondaire[];
};
// chrono : le chrono visé (PO3), absent d'une course ajoutée avant le 19/10/2026.
export type CourseSecondaire = { nom: string; date: string; distance_km: number; dplus_m: number; chrono?: string | null;
  discipline?: 'trail' | 'route'; mode?: 'gestion' | 'a_fond' };

export async function donneesTableau(ctx: Contexte): Promise<DonneesTableau> {
  // Un coaché sans objectif : ni trame ni semaines écrites ; ses données sont sa saison (saisonDuCoureur).
  if (ctx.sansObjectif) {
    return { trame: [], realises: [], fiches: [], nolio: 'coache', accord: Boolean(ctx.fiche?.accord), ecrit: false, courses: [] };
  }
  if (ctx.demonstration) return tableauDeDemonstration(ctx);
  const service = clientService();
  // Les lectures de la base en parallèle (§8, point 13, audit du 03/11/2026 : l'accueil les enchaînait en série).
  const [{ data: p }, accordCoache, trame, { data: lignes }] = await Promise.all([
    service.from('plans').select('parametres, nolio_statut, accord_lecture_le').eq('id', ctx.cle).maybeSingle(),
    // Un coaché : ses séances sont dans Nolio, son accord est celui du Suivi de son coach (T5).
    ctx.coache ? accordDuCoache(ctx.cle) : Promise.resolve(false),
    trameDuPlan(ctx.cle).catch(() => null),
    service.from('semaines_ecrites').select('numero, realise').eq('plan_id', ctx.cle).not('realise', 'is', null),
  ]);
  if (!p?.parametres) {
    return { trame: trameDesDonnees(ctx.plan), realises: [], fiches: [], nolio: ctx.coache ? 'coache' : null, accord: false, ecrit: false,
      courses: [] };
  }
  const realises = (lignes ?? []).map((l) => l.realise as Realise)
    .sort((a, b) => Number(a.numero.slice(1)) - Number(b.numero.slice(1)));
  // E3 : une préparation arrêtée (remboursée) ; sans la migration du 05/11/2026, la lecture échoue et rien ne change.
  const arretee = !ctx.coache && p.nolio_statut === 'sorti'
    ? Boolean((await service.from('plans').select('arretee_le').eq('id', ctx.cle).maybeSingle().then((r) => r.data, () => null))?.arretee_le)
    : false;
  return {
    trame: trame?.semaines ?? trameDesDonnees(ctx.plan), realises, fiches: trame?.fiches ?? [],
    nolio: ctx.coache ? 'coache' : arretee ? 'arrete' : (p.nolio_statut ?? null) as EtatNolio, accord: ctx.coache ? accordCoache : Boolean(p.accord_lecture_le),
    ecrit: true,
    courses: (((p.parametres as Record<string, unknown>).courses_secondaires ?? []) as CourseSecondaire[])
      .slice().sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// La saison d'un coaché (décision coach du 20/10/2026, « toute sa saison ») : ses semaines faites sur TOUS ses
// objectifs, d'une préparation à l'autre, par leur lundi (le plus récent objectif l'emporte sur une même semaine), celles
// que le moteur n'a pas écrites (semainesNolio.ts), et ses
// courses (objectifs et courses de préparation) pour les repères des graphiques. Un acheteur : son plan seul.
export type Saison = { realises: Realise[]; courses: CourseDuGraphique[] };
export async function saisonDuCoureur(ctx: Contexte, d: DonneesTableau): Promise<Saison> {
  // Un coaché sans objectif : ses semaines résumées depuis Nolio, sans course en repère.
  if (ctx.sansObjectif) {
    const realises = ctx.fiche && !ctx.demonstration ? await semainesDeLaFiche(ctx.fiche.id) : [];
    return { realises: realises.sort((a, b) => a.lundi.localeCompare(b.lundi)), courses: [] };
  }
  const coursesDe = (nom: string, date: string, prepa: CourseSecondaire[]) => [{ date, nom }, ...prepa.map((c) => ({ date: c.date, nom: c.nom }))];
  const seul = { realises: d.realises, courses: coursesDe(ctx.plan.course.nom, ctx.plan.course.date, d.courses) };
  if (ctx.demonstration || !ctx.coache) return seul;
  try {
    const service = clientService();
    const { data: lien } = await service.from('coaching').select('athlete_id').eq('plan_id', ctx.cle).maybeSingle();
    if (!lien) return seul;
    const { data: objectifs } = await service.from('coaching').select('plan_id, plans(course_nom, course_date, parametres, cree_le)')
      .eq('athlete_id', lien.athlete_id);
    type Objectif = { plan_id: string; plans: { course_nom: string; course_date: string; parametres: Record<string, unknown> | null; cree_le: string } | null };
    const liste = ((objectifs ?? []) as unknown as Objectif[]).filter((o) => o.plans);
    const { data: lignes } = liste.length
      ? await service.from('semaines_ecrites').select('plan_id, realise').in('plan_id', liste.map((o) => o.plan_id)).not('realise', 'is', null)
      : { data: [] };
    const ordre = new Map(liste.map((o) => [o.plan_id, o.plans?.cree_le ?? '']));
    const parLundi = new Map<string, { r: Realise; cree: string }>();
    for (const l of lignes ?? []) {
      const r = l.realise as Realise;
      const cree = ordre.get(l.plan_id as string) ?? '';
      const deja = parLundi.get(r.lundi);
      if (r.lundi && (!deja || cree > deja.cree)) parLundi.set(r.lundi, { r, cree });
    }
    // Les semaines que le moteur n'a pas écrites (à la main, entre deux objectifs), résumées depuis Nolio chaque nuit.
    for (const r of await semainesDeLaFiche(lien.athlete_id as string)) if (r.lundi && !parLundi.has(r.lundi)) parLundi.set(r.lundi, { r, cree: '' });
    const realises = [...parLundi.values()].map((x) => x.r).sort((a, b) => a.lundi.localeCompare(b.lundi));
    const courses = liste.flatMap((o) => coursesDe(o.plans?.course_nom ?? '', o.plans?.course_date ?? '',
      ((o.plans?.parametres?.courses_secondaires ?? []) as CourseSecondaire[])));
    return { realises, courses };
  } catch {
    return seul;
  }
}

async function accordDuCoache(planId: string): Promise<boolean> {
  const service = clientService();
  const { data: c } = await service.from('coaching').select('coach_id, athlete_id').eq('plan_id', planId).maybeSingle();
  const { data: a } = c ? await service.from('athletes_coaches').select('nolio_athlete_id').eq('id', c.athlete_id).maybeSingle() : { data: null };
  if (!c || !a?.nolio_athlete_id) return false;
  const { data } = await service.from('nolio_accords').select('accord_le').eq('coach_id', c.coach_id).eq('nolio_athlete_id', a.nolio_athlete_id).maybeSingle();
  return Boolean(data);
}

// La semaine telle qu'elle est partie dans Nolio (semaines_ecrites, ajustements compris) ; sinon celle du plan
// (un plan envoyé en entier, la démonstration, une semaine pas encore écrite).
export async function semaineEcrite(ctx: Contexte, numero: string): Promise<Semaine | null> {
  if (ctx.demonstration) return semaineDeDemonstration(ctx, numero);
  const duPlan = ctx.plan.semaines.find((s) => s.numero === numero) ?? null;
  const { data } = await clientService().from('semaines_ecrites').select('donnees').eq('plan_id', ctx.cle).eq('numero', numero).maybeSingle();
  return (data?.donnees as Semaine | undefined) ?? duPlan;
}

// « Cette semaine » telle qu'elle est dans Nolio (décision coach du 20/10/2026 : « on envoie et je modifie au besoin »,
// et ce que le coach y change se voit dans l'app) : les séances prévues de la semaine, lues à l'affichage, sans copie,
// avec l'accord de lecture (la politique de confidentialité) et une fois l'objectif parti dans Nolio. null sinon, ou si
// Nolio ne répond pas : la carte montre la semaine écrite par le moteur. numero : une semaine de la préparation, lue
// dans Nolio une fois qu'elle y est partie (décision coach du 20/10/2026 : avant, la carte montre celle du moteur).
export type SeanceNolio = { id: string; date: string; nom: string; minutes: number | null; couleur: string | null };
// La raison d'une semaine non lue (B-AT-1 et B-AT-2, audit du 03/11/2026 ; AT1, décision coach du 04/11/2026) : la
// carte « Ta semaine » ne confond plus « pas encore partie », « sans accord » et « Nolio muet ».
export type RaisonNolio = 'lue' | 'sans_accord' | 'pas_partie' | 'muet' | 'sans_nolio' | 'demo';
export type LectureNolio = { seances: SeanceNolio[] | null; raison: RaisonNolio };
export async function lireSemaineNolio(ctx: Contexte, lundi: string, numero?: string): Promise<LectureNolio> {
  if (ctx.demonstration) return lectureDeDemonstration(ctx, lundi, numero);
  let o: { nolioAthlete: string | null; accordLecture: boolean; coache: boolean; envois: { semaine: string }[] } | null;
  try {
    // Un coaché sans objectif : celui de sa fiche, avec son accord.
    o = ctx.sansObjectif
      ? (ctx.fiche?.nolio ? { nolioAthlete: ctx.fiche.nolio, accordLecture: Boolean(ctx.fiche.accord), coache: true, envois: [] } : null)
      : await objectifAffiche(ctx.cle);
  } catch {
    return { seances: null, raison: 'muet' };
  }
  // Un coaché : sa semaine dans Nolio, quel qu'en soit l'auteur (son coach à la main, décision coach du 20/10/2026) ;
  // un acheteur : une fois son plan parti dans Nolio.
  if (!o?.nolioAthlete) return { seances: null, raison: 'sans_nolio' };
  if (!o.coache && !o.envois.length) return { seances: null, raison: 'pas_partie' };
  if (numero && !o.coache && !o.envois.some((e) => e.semaine === numero)) return { seances: null, raison: 'pas_partie' };
  if (!o.accordLecture) return { seances: null, raison: 'sans_accord' };
  if (numero && !o.envois.some((e) => e.semaine === numero)) return { seances: null, raison: 'pas_partie' };
  try {
    const d = await destinataire(o.nolioAthlete);
    type Prevue = { id: string; name?: string; date_start: string; duration?: { value?: number } | null; color?: string | null };
    const prevues = await listeNolio<Prevue>(
      `planned/trainings/?date_from=${lundi}&date_to=${ajouterJours(lundi, 6)}${d.moi ? '' : `&athlete=${d.usr}`}`);
    return {
      raison: 'lue',
      seances: prevues
        .map((p) => ({ id: p.id, date: p.date_start.slice(0, 10), nom: p.name ?? 'Séance',
          minutes: p.duration?.value ? Math.round(p.duration.value / 60) : null, couleur: p.color ?? null }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch {
    return { seances: null, raison: 'muet' };
  }
}
// D5 (moteur 8.452 ; CONTRAT_API_CTS.md, « non reproposé ») : le test de vitesse critique n'est plus proposé à un
// acheteur après deux propositions restées sans valeur ; le journal d'une semaine écrite le dit (regle « TN », test
// « vitesse_critique »). Vrai tant qu'aucune vitesse critique n'est connue : la carte de l'accueil le dit
// (components/app/TableauDeBord.tsx, CarteTestVitesseCritique). Pas pour un coaché : son coach s'en charge.
export async function testVcNonRepropose(ctx: Contexte): Promise<boolean> {
  if (ctx.coache || ctx.sansObjectif || ctx.profil.vc_ms !== null) return false;
  if (ctx.demonstration) return Boolean(ctx.demo?.vcNonRepropose);
  const { data, error } = await clientService().from('semaines_ecrites').select('numero').eq('plan_id', ctx.cle)
    // Un tableau JSON en texte : supabase-js écrirait un tableau JavaScript en tableau Postgres (« {…} »), pas en jsonb.
    .contains('journal', JSON.stringify([{ regle: 'TN', test: 'vitesse_critique' }])).limit(1);
  return !error && Boolean(data?.length);
}

export async function semaineDansNolio(ctx: Contexte, lundi: string, numero?: string): Promise<SeanceNolio[] | null> {
  return (await lireSemaineNolio(ctx, lundi, numero)).seances;
}

// Les courses de préparation qui ont leur fiche de course (PO3), par leur date ; vide avant la migration du 19/10/2026.
export async function fichesDePreparation(planId: string): Promise<Set<string>> {
  const { data, error } = await clientService().from('plans').select('fiches_preparation').eq('id', planId).maybeSingle();
  if (error || !data) return new Set();
  return new Set(Object.keys(((data as { fiches_preparation?: Record<string, unknown> }).fiches_preparation ?? {})));
}

// LA SEMAINE AJUSTÉE (Q7, décision coach du 05/11/2026 au soir, « A ») : la semaine en cours que le passage du dimanche a
// écrite d'après la semaine passée (« moteur » : les règles du journal gardé avec elle, semaines_ecrites.journal), ou,
// pour un coaché, que son coach a retouchée (« coach » : une correction de l'aperçu du dimanche appliquée, journal COACH,
// ou des séances changées dans Nolio, comptées chaque nuit dans la table retouches). null sinon : la semaine de la trame.
// Les règles qui changent la semaine d'après la semaine passée : moins de 60 % faits (R1), une séance clé trop dure ou
// écourtée (R2), la fatigue (R3), un arrêt (R4), un week-end choc réduit (R5), une séance clé manquée ou retirée (R8),
// la semaine allégée par le coach (CH), une course dans la récupération (C5), une course qui tient lieu de week-end choc
// (O3), la reprise après un autre objectif (OM4). Pas les doses lues (C1, chaque semaine), ni un test (TN), ni un repli.
export async function ajustementDeLaSemaine(ctx: Contexte, numero: string): Promise<Ajustement> {
  if (ctx.sansObjectif || ctx.aLaMain) return null;
  if (ctx.demonstration) return ajustementDeDemonstration(ctx, numero);
  try {
    const service = clientService();
    const [{ data: ecrite }, retouches] = await Promise.all([
      service.from('semaines_ecrites').select('journal').eq('plan_id', ctx.cle).eq('numero', numero).maybeSingle(),
      // La table retouches manque tant que sa migration n'est pas passée : rien de retouché.
      ctx.coache ? service.from('retouches').select('familles, ajoutees').eq('plan_id', ctx.cle).eq('semaine', numero).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const r = retouches.data as { familles?: Record<string, { modifiees?: number; supprimees?: number }> | null; ajoutees?: number } | null;
    const retouchee = Boolean(r && (Number(r.ajoutees ?? 0) > 0
      || Object.values(r.familles ?? {}).some((f) => Number(f?.modifiees ?? 0) > 0 || Number(f?.supprimees ?? 0) > 0)));
    return ajustementDuJournal(ecrite?.journal, ctx.coache, retouchee);
  } catch {
    return null;
  }
}

// LE TEST DE LA SEMAINE (Q14, décision coach du 05/11/2026 au soir, « A ») : la séance que la préparation écrit à la
// place d'une autre pour donner un repère (son jour porte reperes.test.ecrit). Le premier de la semaine, ou null.
export function testDeLaSemaine(semaine: Semaine | null): CleTest | null {
  return semaine?.jours.find((j) => j.reperes?.test?.ecrit)?.reperes?.test?.cle ?? null;
}
