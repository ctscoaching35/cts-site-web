import FormulaireRetour from '@/components/app/FormulaireRetour';
import { effacerRetour } from '@/lib/app/actionsJournal';
import { lien, type Contexte } from '@/lib/app/contexte';
import { resume, rpePrevu, seanceDuJournal } from '@/lib/app/journal';
import type { Jour } from '@/lib/app/plan';

const CONSENTEMENT =
  'J’accepte que CTS garde mes retours de séance dans mon compte, seulement pour suivre et ajuster mon plan. Je peux les effacer à tout moment.';

// Le retour d'une séance, sur sa fiche (J2, J5, J7) : « J'ai fait ma séance », ou ce qui a été saisi,
// corrigeable et effaçable. Pas de retour avant le jour de la séance.
// ouvert : arrivé par « J'ai fait ma séance », « Et hier ? » ou la jauge (?retour=1).
export default function RetourSeance({ jour, ctx, ouvert = false }: { jour: Jour; ctx: Contexte; ouvert?: boolean }) {
  if (!seanceDuJournal(jour) || !jour.date_iso || jour.date_iso > ctx.jour) return null;
  const retour = ctx.retours[jour.id] ?? null;
  const formulaire = (
    <FormulaireRetour
      planId={ctx.cle} jourId={jour.id} rpePrevu={rpePrevu(jour)} rpeAffiche={jour.rpe} retour={retour}
      journal={ctx.journal} consentement={CONSENTEMENT} lienDouleur={lien('/app/plan/mode-emploi', ctx) + '#fatigue'}
      demonstration={ctx.demonstration}
    />
  );
  return (
    <section id="retour" className="bg-white shadow-sm p-4 scroll-mt-20">
      {retour ? (
        <>
          <h2 className="eyebrow text-indigo/60 mb-1.5">Ton retour</h2>
          <p className="text-indigo font-semibold">{resume(retour, jour)}</p>
          <details className="mt-2">
            <summary className="text-sm font-semibold text-teal cursor-pointer">Modifier</summary>
            <div className="mt-3">{formulaire}</div>
          </details>
          {!ctx.demonstration && (
            <form action={effacerRetour.bind(null, ctx.cle, jour.id)} className="mt-2">
              <button type="submit" className="text-sm text-indigo/60 underline underline-offset-2">Effacer ce retour</button>
            </form>
          )}
        </>
      ) : (
        <details open={ouvert || jour.date_iso < ctx.jour}>
          <summary className="btn btn-primary !py-2.5 cursor-pointer list-none inline-block">J’ai fait ma séance</summary>
          <div className="mt-4">{formulaire}</div>
        </details>
      )}
    </section>
  );
}
