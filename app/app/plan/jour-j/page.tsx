import EnTeteApp from '@/components/app/EnTeteApp';
import RetourPlan from '@/components/app/RetourPlan';
import StrategieCourse from '@/components/app/StrategieCourse';
import { Partie } from '@/components/app/Texte';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { requeteCalculateurNutrition } from '@/lib/app/plan';
import { clientService } from '@/lib/app/supabase';

// Ton jour J (cts_contenu.contenu_jour_j) : la durée visée, le calculateur de stratégie de course, puis les fiches qui
// préparent la course (StrategieCourse) ; la fiche ultra au-delà de 8h d'effort.
export default async function JourJ({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const j = plan.jour_j;
  // Le niveau du questionnaire, pour préremplir le calculateur de nutrition (rien en démonstration).
  const { data: q } = ctx.demonstration ? { data: null }
    : await clientService().from('plans').select('intake').eq('id', ctx.cle).maybeSingle();
  const calculateur = lien('/app/calculateurs/calculateur-nutrition', ctx, Object.fromEntries(new URLSearchParams(
    requeteCalculateurNutrition(plan.course.temps_cible, String(((q?.intake ?? {}) as Record<string, unknown>).niveau ?? '')))));
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <RetourPlan ctx={ctx} />
        <h1 className="text-2xl text-indigo leading-tight">{j.titre}</h1>
        <Partie titre={j.nutrition.titre}>
          <StrategieCourse lignes={j.nutrition.lignes as [string, string][]} href={calculateur}
            fiche={(slug) => lien(`/app/bibliotheque/${slug}`, ctx)} ultra={Boolean(j.fiche_ultra)} />
        </Partie>
      </main>
    </>
  );
}
