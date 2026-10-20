import StrategieCourse from '@/components/app/StrategieCourse';
import EnTeteApp from '@/components/app/EnTeteApp';
import CorpsFichePreparation, { type FichePrep } from '@/components/app/FichePreparation';
import ProfilCourse from '@/components/app/ProfilCourse';
import RepartitionPentes from '@/components/app/RepartitionPentes';
import RetourPlan from '@/components/app/RetourPlan';
import { Lignes, Partie, Puces, Tableau } from '@/components/app/Texte';
import { effacerStrategie } from '@/lib/app/actionsStrategie';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { COURSE_OBJECTIF, parametresCalculateur, STRATEGIE_EXEMPLE, strategiesDuPlan } from '@/lib/app/strategie';
import { clientService } from '@/lib/app/supabase';

// Ta fiche de course (cadrage, 3.4 ; maquette validée le 19/10/2026 : « profil, tronçons, ravitaillement ») : la fiche,
// le profil et ses pentes, ton terrain, les tronçons, les déterminants de la performance, puis ton jour J et ta
// stratégie de course et les fiches qui la préparent (StrategieCourse), comme la fiche de course privée des coachés.
export default async function TaCourse({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const { profil, terrain, determinants: d, jour_j: j } = plan;
  // Le niveau du questionnaire, pour préremplir le calculateur de nutrition (rien en démonstration).
  const { data: q } = ctx.demonstration ? { data: null }
    : await clientService().from('plans').select('intake').eq('id', ctx.cle).maybeSingle();
  const niveau = String(((q?.intake ?? {}) as Record<string, unknown>).niveau ?? '');
  // Ses stratégies gardées, une par fiche de course (décision coach du 20/10/2026).
  const strategies = ctx.demonstration ? (ctx.exemple ? { [COURSE_OBJECTIF]: STRATEGIE_EXEMPLE } : {}) : await strategiesDuPlan(ctx.cle);
  const strategie = strategies[COURSE_OBJECTIF] ?? null;
  const calculateur = lien('/app/calculateurs/calculateur-nutrition', ctx,
    parametresCalculateur(plan.course.temps_cible, niveau, strategie, COURSE_OBJECTIF));
  const t = profil.troncons;
  // ?course=AAAA-MM-JJ : la fiche d'une course de préparation (PO3), dans l'app (décision coach du 19/10/2026).
  const course = (await searchParams).course;
  if (typeof course === 'string' && !ctx.demonstration) {
    const { data: fp, error } = await clientService().from('plans').select('fiches_preparation').eq('id', ctx.cle).maybeSingle();
    const fiche = !error ? ((fp as { fiches_preparation?: Record<string, FichePrep> } | null)?.fiches_preparation ?? {})[course] : undefined;
    if (fiche) {
      const strategiePrep = strategies[course] ?? null;
      const calculateurPrep = lien('/app/calculateurs/calculateur-nutrition', ctx,
        parametresCalculateur(fiche.course.temps_cible, niveau, strategiePrep, course));
      return (
        <>
          <EnTeteApp ctx={ctx} />
          <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
            <RetourPlan ctx={ctx} />
            <CorpsFichePreparation fiche={fiche} calculateur={calculateurPrep}
              cheminFiche={(slug) => lien(`/app/bibliotheque/${slug}`, ctx)}
              strategie={strategiePrep} effacer={effacerStrategie.bind(null, ctx.cle, course)} />
          </main>
        </>
      );
    }
  }
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <RetourPlan ctx={ctx} />
        <h1 className="text-2xl text-indigo leading-tight">{plan.ta_course.titre}</h1>
        <div className="bg-white shadow-sm px-4 py-1">
          <Lignes lignes={plan.ta_course.lignes} />
        </div>

        <Partie titre={profil.titre}>
          {profil.sans_trace ? (
            <p>{profil.sans_trace}</p>
          ) : (
            <>
              {profil.points && <ProfilCourse points={profil.points} />}
              {profil.pentes && <RepartitionPentes pentes={profil.pentes} />}
            </>
          )}
        </Partie>

        {terrain && (
          <Partie titre={terrain.titre}>
            <p>{terrain.texte}</p>
          </Partie>
        )}

        {t && (t.homogene || t.tableau) && (
          <Partie titre={t.titre}>
            {t.homogene ? <p>{t.homogene}</p> : t.tableau && <Tableau lignes={t.tableau} />}
          </Partie>
        )}

        <h2 className="text-xl text-indigo leading-tight pt-2">{d.titre}</h2>
        <Partie titre={d.physio.titre}>
          <Puces puces={d.physio.puces} />
        </Partie>
        {d.sans_trace && <p className="text-sm text-indigo/75 px-1">{d.sans_trace}</p>}
        {d.mecanique && (
          <Partie titre={d.mecanique.titre}>
            <Puces puces={d.mecanique.puces} />
          </Partie>
        )}
        {d.secteurs_cles && (
          <Partie titre={d.secteurs_cles.titre}>
            <Puces puces={d.secteurs_cles.puces} />
          </Partie>
        )}

        <h2 id="jour-j" className="text-2xl text-indigo leading-tight pt-4 scroll-mt-20">{j.titre}</h2>
        <Partie titre={j.nutrition.titre}>
          <StrategieCourse lignes={j.nutrition.lignes as [string, string][]} href={calculateur}
            fiche={(slug) => lien(`/app/bibliotheque/${slug}`, ctx)} ultra={Boolean(j.fiche_ultra)}
            strategie={strategie} effacer={effacerStrategie.bind(null, ctx.cle, COURSE_OBJECTIF)} />
        </Partie>
      </main>
    </>
  );
}
