import EnTeteApp from '@/components/app/EnTeteApp';
import RetourPlan from '@/components/app/RetourPlan';
import StrategieCourse from '@/components/app/StrategieCourse';
import { Partie } from '@/components/app/Texte';
import { effacerStrategie } from '@/lib/app/actionsStrategie';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { COURSE_OBJECTIF, parametresCalculateur, STRATEGIE_EXEMPLE, strategiesDuPlan } from '@/lib/app/strategie';
import { clientService } from '@/lib/app/supabase';

// Ton jour J (cts_contenu.contenu_jour_j) : la durée visée, le calculateur de stratégie de course, puis les fiches qui
// préparent la course (StrategieCourse) ; la fiche ultra au-delà de 8h d'effort ; sa stratégie, s'il l'a gardée.
export default async function JourJ({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const j = plan.jour_j;
  // Le niveau du questionnaire, pour préremplir le calculateur de nutrition (rien en démonstration).
  const { data: q } = ctx.demonstration ? { data: null }
    : await clientService().from('plans').select('intake').eq('id', ctx.cle).maybeSingle();
  // Sa stratégie gardée (décision coach du 20/10/2026) : affichée, et le calculateur se rouvre rempli de ses réponses.
  const strategie = ctx.demonstration ? (ctx.exemple ? STRATEGIE_EXEMPLE : null) : (await strategiesDuPlan(ctx.cle))[COURSE_OBJECTIF] ?? null;
  const calculateur = lien('/app/calculateurs/calculateur-nutrition', ctx, parametresCalculateur(plan.course.temps_cible,
    String(((q?.intake ?? {}) as Record<string, unknown>).niveau ?? ''), strategie, COURSE_OBJECTIF));
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <RetourPlan ctx={ctx} />
        <h1 className="text-[1.75rem] font-extrabold text-indigo tracking-tight leading-tight">{j.titre}</h1>
        <Partie titre={j.nutrition.titre}>
          <StrategieCourse lignes={j.nutrition.lignes as [string, string][]} href={calculateur}
            fiche={(slug) => lien(`/app/bibliotheque/${slug}`, ctx)} ultra={Boolean(j.fiche_ultra)}
            strategie={strategie} effacer={effacerStrategie.bind(null, ctx.cle, COURSE_OBJECTIF)} />
        </Partie>
      </main>
    </>
  );
}
