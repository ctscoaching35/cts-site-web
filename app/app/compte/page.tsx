import EnTeteApp from '@/components/app/EnTeteApp';
import { Avertissement } from '@/components/app/Texte';
import { Deconnexion, Suppression } from '@/components/app/BoutonsCompte';
import Installation from '@/components/app/Installation';
import { choisirPlan } from '@/lib/app/actionsPlan';
import { contexte, type Recherche } from '@/lib/app/contexte';
import { dateLongue } from '@/lib/app/plan';
import { clientServeur } from '@/lib/app/supabase';

// Le compte (cadrage, 3.6) : l'e-mail, les plans (un par course), la déconnexion, la
// suppression. Les exports (PDF, agenda) et les pages légales viennent ensuite (1e, 1f).
export default async function Compte({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  if (ctx.demonstration) {
    return (
      <>
        <EnTeteApp ctx={ctx} />
        <main className="mx-auto max-w-2xl px-4 py-5 space-y-6">
          <h1 className="text-2xl text-indigo">Compte</h1>
          <p className="text-sm text-indigo/60">Démonstration : le compte n’existe qu’avec Supabase configuré.</p>
          <section className="bg-white shadow-sm p-4 space-y-2">
            <h2 className="eyebrow text-indigo/60">Ton plan sur ton écran d’accueil</h2>
            <Installation />
          </section>
          <Avertissement avertissement={ctx.plan.avertissement} />
        </main>
      </>
    );
  }
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const { data: plans } = await supabase.from('plans').select('id, course_nom, course_date').order('course_date', { ascending: false });
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <h1 className="text-2xl text-indigo">Compte</h1>
        <section className="bg-white shadow-sm p-4 space-y-1">
          <h2 className="eyebrow text-indigo/60">Ton e-mail</h2>
          <p className="text-indigo">{String(data?.claims?.email ?? '')}</p>
        </section>
        {/* « Tes plans » (décision coach du 07/10/2026) : avec plusieurs plans, on choisit celui que
            l'app affiche ; le choix se retient sur l'appareil. */}
        <section className="bg-white shadow-sm p-4 space-y-2">
          <h2 className="eyebrow text-indigo/60">Tes plans</h2>
          {(plans ?? []).length > 1 && (
            <p className="text-sm text-indigo/60">Touche un plan pour l’afficher dans l’app.</p>
          )}
          <ul className="divide-y divide-indigo/10">
            {(plans ?? []).map((p) => (
              <li key={p.id}>
                <form action={choisirPlan.bind(null, p.id)}>
                  <button type="submit" disabled={p.id === ctx.cle}
                    className="w-full py-2 flex justify-between items-baseline gap-3 text-sm text-left disabled:cursor-default">
                    <span className="font-semibold text-indigo">{p.course_nom}</span>
                    <span className={p.id === ctx.cle ? 'text-teal font-semibold' : 'text-indigo/60'}>
                      {p.id === ctx.cle ? 'Affiché' : dateLongue(p.course_date, true)}
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
        <section className="bg-white shadow-sm p-4 space-y-2">
          <h2 className="eyebrow text-indigo/60">Ton plan sur ton écran d’accueil</h2>
          <Installation />
        </section>
        <Deconnexion />
        <Suppression />
        <Avertissement avertissement={ctx.plan.avertissement} />
      </main>
    </>
  );
}
