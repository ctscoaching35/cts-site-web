import Link from 'next/link';
import { deciderAjustement } from '@/lib/app/actionsAdaptation';
import { BOUTONS, textes, type Proposition } from '@/lib/app/adaptation';
import { lien, type Contexte } from '@/lib/app/contexte';

// La proposition du moment (cadrage §7.2, étape 3, A6) : sa raison, ce qu'elle change, « Appliquer » ou
// « Non merci ». Au retour qui la déclenche, et en haut d'Aujourd'hui tant que la séance visée est à venir.
export default function PropositionAjustement({ ctx, p }: { ctx: Contexte; p: Proposition }) {
  const t = textes(ctx.plan, p);
  if (!t) return null;
  const source = p.regle === 'marche' ? p.source.id : null;
  const decider = (statut: 'applique' | 'refuse') => deciderAjustement.bind(null, ctx.cle, p.regle, p.cible.id, source, statut);
  const jourSimule = !ctx.demonstration && process.env.NODE_ENV !== 'production' ? ctx.jour : null;
  return (
    <section className="bg-white shadow-sm p-4 border-l-4 border-[#9A6A12]">
      <h2 className="eyebrow text-[#9A6A12] mb-1.5">{t.titre}</h2>
      <p className="text-indigo">{t.raison} {t.suite}</p>
      <p className="text-sm font-semibold text-indigo mt-2">{t.concret}</p>
      {t.renvoi && (
        <Link href={lien('/app/plan/mode-emploi', ctx) + '#fatigue'} className="block text-sm text-teal font-semibold mt-2">
          {t.renvoi}
        </Link>
      )}
      {ctx.demonstration ? (
        <p className="text-sm text-indigo/60 mt-3">Démonstration : l’ajustement s’enregistre avec les comptes.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
          <form action={decider('applique')}>
            {jourSimule && <input type="hidden" name="jour" value={jourSimule} />}
            <button type="submit" className="btn btn-primary !py-2.5">{BOUTONS.appliquer}</button>
          </form>
          <form action={decider('refuse')}>
            {jourSimule && <input type="hidden" name="jour" value={jourSimule} />}
            <button type="submit" className="text-sm text-indigo/70 underline underline-offset-2">{BOUTONS.refuser}</button>
          </form>
        </div>
      )}
    </section>
  );
}
