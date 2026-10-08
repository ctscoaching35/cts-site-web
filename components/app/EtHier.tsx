import Link from 'next/link';
import { cookies } from 'next/headers';
import { ignorerHier } from '@/lib/app/actionsJournal';
import { lien, type Contexte } from '@/lib/app/contexte';
import { COOKIE_HIER, seanceDHier } from '@/lib/app/journal';
import { ajouterJours } from '@/lib/app/plan';

// « Et hier ? » (J2) : la séance de la veille sans retour, à remplir ou à ignorer.
export default async function EtHier({ ctx }: { ctx: Contexte }) {
  const hier = seanceDHier(ctx.plan, ctx.retours, ajouterJours(ctx.jour, -1));
  if (!hier || (await cookies()).get(COOKIE_HIER)?.value === hier.id) return null;
  return (
    <section className="bg-white shadow-sm border-l-4 border-indigo px-4 py-3 text-sm">
      <p className="text-indigo"><strong>Et hier ?</strong> {hier.seance}</p>
      <div className="flex gap-4 mt-1.5">
        <Link href={lien(`/app/seance/${hier.id}`, ctx, { retour: '1' }) + '#retour'} className="font-semibold text-teal">Dire comment elle s’est passée ›</Link>
        {!ctx.demonstration && (
          <form action={ignorerHier.bind(null, hier.id)}>
            <button type="submit" className="text-indigo/55 underline underline-offset-2">Ignorer</button>
          </form>
        )}
      </div>
    </section>
  );
}
