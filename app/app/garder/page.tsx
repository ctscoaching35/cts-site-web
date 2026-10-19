import Link from 'next/link';
import { redirect } from 'next/navigation';
import EnTeteCoach from '@/components/app/EnTeteCoach';
import { garderSeanceOrigine } from '@/lib/app/ecriture';
import { clientServeur, supabaseConfigure } from '@/lib/app/supabase';

// Le veto (CTS_NOLIO_CADRAGE.md, décision du 19/10/2026 : « Garder ma séance d'origine ») : le lien de la note Nolio d'une
// séance allégée par la fatigue mène ici ; un geste, et la séance d'origine revient dans Nolio.
export const dynamic = 'force-dynamic';

type Recherche = Promise<{ plan?: string; seance?: string; fait?: string }>;

async function garder(planId: string, seance: string) {
  'use server';
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const compte = data?.claims?.sub;
  if (!compte) redirect('/app/connexion');
  const ok = await garderSeanceOrigine(planId, seance, compte);
  redirect(`/app/garder?plan=${planId}&seance=${encodeURIComponent(seance)}&fait=${ok ? '1' : '0'}`);
}

export default async function Garder({ searchParams }: { searchParams: Recherche }) {
  if (!supabaseConfigure()) redirect('/app');
  const { plan, seance, fait } = await searchParams;
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/app/connexion?suite=${encodeURIComponent(`/app/garder?plan=${plan ?? ''}&seance=${seance ?? ''}`)}`);
  const valide = plan && seance && /^[0-9a-f-]{36}$/.test(plan) && /^S\d+-[a-z]+$/.test(seance);
  return (
    <>
      <EnTeteCoach />
      <main className="mx-auto max-w-xl px-4 py-8 space-y-4">
        <h1 className="text-2xl text-indigo">Ta séance d’origine</h1>
        {!valide && <p className="text-sm text-indigo/75">Ce lien ne correspond à aucune séance.</p>}
        {valide && fait === '1' && <p className="text-sm text-teal font-semibold">C’est fait : ta séance d’origine est de retour dans Nolio.</p>}
        {valide && fait === '0' && (
          <p className="text-sm text-indigo/75">Cette séance n’a pas pu revenir : elle a peut-être déjà été retouchée dans Nolio.</p>
        )}
        {valide && !fait && (
          <>
            <p className="text-sm text-indigo/80 leading-relaxed">
              Ta séance a été allégée en endurance fondamentale à cause de signaux de fatigue. Si tu te sens bien, tu
              peux la remettre telle qu’elle était prévue.
            </p>
            <form action={garder.bind(null, plan, seance)}>
              <button type="submit" className="btn btn-primary !py-2.5">Garder ma séance d’origine</button>
            </form>
          </>
        )}
        <Link href="/app" className="inline-block text-sm text-teal font-semibold">‹ Retour à l’app</Link>
      </main>
    </>
  );
}
