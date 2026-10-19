import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clientServeur, clientService, supabaseConfigure } from '@/lib/app/supabase';

// La session se lit à chaque visite : jamais figée à la compilation.
export const dynamic = 'force-dynamic';

// Un compte sans plan : il en construit un par le questionnaire (D2 : depuis le site ou l'app) ; un coaché invité par
// son coach (T6) attend son premier objectif.
export default async function SansPlan() {
  if (!supabaseConfigure()) redirect('/app');
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/app/connexion');
  const { data: fiche } = await clientService().from('athletes_coaches').select('id').eq('compte_id', data.claims.sub).limit(1);
  if (fiche?.length) {
    return (
      <main className="mx-auto max-w-sm px-4 py-12 space-y-4 text-center">
        <h1 className="text-2xl text-indigo">Ton espace est prêt</h1>
        <p className="text-indigo/75">Ton coach prépare ton objectif : il apparaîtra ici dès qu’il sera prêt.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-sm px-4 py-12 space-y-6 text-center">
      <h1 className="text-2xl text-indigo">Tu n’as pas encore de plan</h1>
      <Link href="/plan" className="btn btn-primary">Construire mon plan</Link>
    </main>
  );
}
