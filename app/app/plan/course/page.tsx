import type { Metadata } from 'next';
import StrategieCourse from '@/components/app/StrategieCourse';
import { AjouterTrace } from '@/components/app/GestesEcriture';
import EnTeteApp from '@/components/app/EnTeteApp';
import CorpsFichePreparation, { type FichePrep } from '@/components/app/FichePreparation';
import ProfilCourse from '@/components/app/ProfilCourse';
import RepartitionPentes from '@/components/app/RepartitionPentes';
import RetourPlan from '@/components/app/RetourPlan';
import EnTeteCourse from '@/components/app/EnTeteCourse';
import { Partie, Puces, Tableau } from '@/components/app/Texte';
import { effacerStrategie } from '@/lib/app/actionsStrategie';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { COURSE_OBJECTIF, parametresCalculateur, STRATEGIE_EXEMPLE, strategiesDuPlan } from '@/lib/app/strategie';
import { clientService } from '@/lib/app/supabase';
import { ficheDeDemonstration, niveauDeDemonstration } from '@/lib/app/demonstration';

export const metadata: Metadata = { title: 'Ta fiche de course' };

// Q1 (décision coach du 05/11/2026 au soir, « A ») : des mots de coureur hors des noms de séance.
const enMotsDeCoureur = (t: string) => t.replace(/le déterminant physiologique central de ta préparation/g, 'ce qui compte le plus pour ta course');

// Ta fiche de course (cadrage, 3.4 ; maquette validée le 19/10/2026 : « profil, tronçons, ravitaillement ») : la fiche,
// le profil et ses pentes, ton terrain, les tronçons, les déterminants de la performance, puis ton jour J et ta
// stratégie de course et les fiches qui la préparent (StrategieCourse), comme la fiche de course privée des coachés.
export default async function TaCourse({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const { profil, terrain, determinants: d, jour_j: j } = plan;
  // Le niveau du questionnaire, pour préremplir le calculateur de nutrition (rien en démonstration).
  const { data: q } = ctx.demonstration ? { data: { intake: { niveau: await niveauDeDemonstration(ctx) } } }
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
        <EnTeteCourse surtitre="Ta fiche de course" nom={plan.course.nom} lignes={plan.ta_course.lignes} />

        {/* C29 et Q11 (audits du 05/11/2026 ; décision coach du 05/11/2026 au soir, « A ») : sans trace, une phrase de
            coureur à la place des phrases de fichier, et de quoi la donner. Validé par le coach le 05/11/2026 (1A). */}
        <Partie titre={profil.titre}>
          {profil.sans_trace ? (
            <>
              <p>Sans la trace GPX de ta course, sa fiche n’a pas encore son profil ni ses tronçons : ta préparation part de son dénivelé total.</p>
              {/* En démonstration, le geste répond que rien ne s'enregistre. */}
              <AjouterTrace planId={ctx.cle} />
            </>
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

        <h2 className="pt-3 text-[1.25rem] font-extrabold text-indigo tracking-tight">{d.titre}</h2>
        <Partie titre={d.physio.titre}>
          <Puces puces={d.physio.puces.map(enMotsDeCoureur)} />
        </Partie>
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

        <h2 id="jour-j" className="pt-3 text-[1.25rem] font-extrabold text-indigo tracking-tight scroll-mt-20">{j.titre}</h2>
        <Partie titre={j.nutrition.titre}>
          <StrategieCourse lignes={j.nutrition.lignes as [string, string][]} href={calculateur}
            fiche={(slug) => lien(`/app/bibliotheque/${slug}`, ctx)} ultra={Boolean(j.fiche_ultra)}
            strategie={strategie} effacer={effacerStrategie.bind(null, ctx.cle, COURSE_OBJECTIF)} />
        </Partie>
      </main>
    </>
  );
}
