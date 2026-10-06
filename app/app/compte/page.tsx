import EnTeteApp from '@/components/app/EnTeteApp';
import { Avertissement } from '@/components/app/Texte';
import { seDeconnecter, supprimerCompte } from '@/lib/app/actionsCompte';
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
        <section className="bg-white shadow-sm p-4 space-y-2">
          <h2 className="eyebrow text-indigo/60">Tes plans</h2>
          <ul className="divide-y divide-indigo/10">
            {(plans ?? []).map((p) => (
              <li key={p.id} className="py-2 flex justify-between gap-3 text-sm">
                <span className="font-semibold text-indigo">{p.course_nom}</span>
                <span className="text-indigo/60">{dateLongue(p.course_date, true)}</span>
              </li>
            ))}
          </ul>
        </section>
        <form action={seDeconnecter}>
          <button type="submit" className="w-full bg-white shadow-sm p-4 text-left font-semibold text-indigo">
            Me déconnecter
          </button>
        </form>
        <form action={supprimerCompte} className="bg-white shadow-sm p-4 space-y-3">
          <h2 className="font-bold text-indigo">Supprimer mon compte</h2>
          <p className="text-sm text-indigo/70">Ton compte, tes plans et leurs PDF sont effacés, sans retour possible.</p>
          <label className="flex items-center gap-2 text-sm text-indigo">
            <input type="checkbox" name="confirmation" value="oui" required className="accent-[#9A3B2C]" />
            Je veux supprimer mon compte
          </label>
          <button type="submit" className="text-sm font-bold text-[#9A3B2C]">Supprimer définitivement</button>
        </form>
        <Avertissement avertissement={ctx.plan.avertissement} />
      </main>
    </>
  );
}
