import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import EnTeteApp from '@/components/app/EnTeteApp';
import CorpsFichePreparation, { type FichePrep } from '@/components/app/FichePreparation';
import DossierObjectif from '@/components/app/courses/DossierObjectif';
import { effacerStrategie } from '@/lib/app/actionsStrategie';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { demandeDuPlan, placeDansLaPreparation } from '@/lib/app/coursePlan';
import { COURSE_OBJECTIF, parametresCalculateur, STRATEGIE_EXEMPLE, strategiesDuPlan } from '@/lib/app/strategie';
import { blocsDuPlan } from '@/lib/app/tableau';
import { donneesTableau } from '@/lib/app/tableauDuPlan';
import { clientService } from '@/lib/app/supabase';
import { ficheDeDemonstration, niveauDeDemonstration } from '@/lib/app/demonstration';

export const metadata: Metadata = { title: 'Ton dossier de course' };

// Le dossier de course de l'objectif (cadrage, 3.4 ; maquette validée le 19/10/2026, puis refonte de l'app payante, étape (c) :
// maquette du 16/11/2026) : la présentation du dossier de l'app gratuite (components/app/courses/DossierObjectif.tsx), avec les
// données et les textes du plan. Son adresse reste celle d'avant : « /app/plan/jour-j » y mène, à « Ton jour J » (#jour-j). Avec
// ?course=AAAA-MM-JJ, la fiche d'une course de préparation (PO3), dans l'app (décision coach du 19/10/2026).
export default async function TaCourse({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  // Une saison de fond n'a pas de course : ni dossier ni fiche, sa page Courses (ses courses de préparation, « Ajouter »).
  if (plan.fond) redirect(lien('/app/courses', ctx));
  // Le niveau du questionnaire, pour préremplir le calculateur de nutrition (rien en démonstration) ; c'est aussi l'expérience
  // envoyée au moteur pour le dossier.
  const { data: q } = ctx.demonstration ? { data: { intake: { niveau: await niveauDeDemonstration(ctx) } } }
    : await clientService().from('plans').select('intake').eq('id', ctx.cle).maybeSingle();
  const niveau = String(((q?.intake ?? {}) as Record<string, unknown>).niveau ?? '');
  // Ses stratégies gardées, une par fiche de course (décision coach du 20/10/2026).
  const strategies = ctx.demonstration ? (ctx.exemple ? { [COURSE_OBJECTIF]: STRATEGIE_EXEMPLE } : {}) : await strategiesDuPlan(ctx.cle);
  const strategie = strategies[COURSE_OBJECTIF] ?? null;
  const calculateur = lien('/app/calculateurs/calculateur-nutrition', ctx,
    parametresCalculateur(plan.course.temps_cible, niveau, strategie, COURSE_OBJECTIF));
  // ?course=AAAA-MM-JJ : la fiche d'une course de préparation (PO3), dans l'app (décision coach du 19/10/2026).
  const course = (await searchParams).course;
  if (typeof course === 'string') {
    // En démonstration, la fiche que le moteur a faite pour la course de préparation (?prepa=1).
    const { data: fp, error } = ctx.demonstration ? { data: null, error: null }
      : await clientService().from('plans').select('fiches_preparation').eq('id', ctx.cle).maybeSingle();
    const fiche = ctx.demonstration ? await ficheDeDemonstration(ctx, course) ?? undefined
      : !error ? ((fp as { fiches_preparation?: Record<string, FichePrep> } | null)?.fiches_preparation ?? {})[course] : undefined;
    if (fiche) {
      const strategiePrep = strategies[course] ?? null;
      const calculateurPrep = lien('/app/calculateurs/calculateur-nutrition', ctx,
        parametresCalculateur(fiche.course.temps_cible, niveau, strategiePrep, course));
      return (
        <>
          <EnTeteApp ctx={ctx} />
          <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
            <Link href={lien('/app/courses', ctx)} className="inline-flex items-center min-h-11 text-sm font-bold text-teal">‹ Tes courses</Link>
            <CorpsFichePreparation fiche={fiche} calculateur={calculateurPrep}
              cheminFiche={(slug) => lien(`/app/bibliotheque/${slug}`, ctx)}
              strategie={strategiePrep} effacer={effacerStrategie.bind(null, ctx.cle, course)} />
          </main>
        </>
      );
    }
  }
  // Où il en est dans sa préparation (la carte « Dans ta préparation ») : rien pour un programme à la main, sans trame du moteur.
  const d = ctx.aLaMain ? null : await donneesTableau(ctx).catch(() => null);
  const depuis = ctx.coache ? d?.debut ?? null : null;
  const semaine = d ? placeDansLaPreparation(d.trame, ctx.jour, depuis) : null;
  const depuisMontagne = ctx.coache ? d?.debut ?? null : plan.course.rejoint?.lundi ?? null;
  const place = d && semaine ? {
    ...semaine, bloc: blocsDuPlan(d.trame, plan, ctx.jour, depuisMontagne).find((b) => b.moment === 'encours')?.nom ?? null,
  } : null;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5">
        <DossierObjectif ctx={ctx} demande={demandeDuPlan(plan, niveau, ctx.jour)} strategie={strategie} calculateur={calculateur}
          effacer={effacerStrategie.bind(null, ctx.cle, COURSE_OBJECTIF)} place={place} />
      </main>
    </>
  );
}
