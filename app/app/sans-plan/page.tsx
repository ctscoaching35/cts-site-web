import Link from 'next/link';
import { Deconnexion } from '@/components/app/BoutonsCompte';
import { redirect } from 'next/navigation';
import { coachConnecte } from '@/lib/app/nolio';
import { clientServeur, clientService, supabaseConfigure } from '@/lib/app/supabase';

// La session se lit à chaque visite : jamais figée à la compilation.
export const dynamic = 'force-dynamic';

// Un compte sans plan : il en construit un par le questionnaire (D2 : depuis le site ou l'app) ; un coaché invité par
// son coach (T6) va à son tableau de bord, même sans objectif ; le compte coach va dans son espace (décision coach du 20/10/2026 : chaque
// version par son compte, la sienne est l'espace coach).
export default async function SansPlan() {
  if (!supabaseConfigure()) redirect('/app');
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/app/connexion');
  if (await coachConnecte()) redirect('/app/coach');
  const email = String(data.claims.email ?? '');
  const { data: fiche } = await clientService().from('athletes_coaches').select('id').eq('compte_id', data.claims.sub).limit(1);
  // Un coaché sans objectif : son tableau de bord (décision coach du 20/10/2026, « tableau de bord complet »).
  if (fiche?.length) redirect('/app');
  return (
    <main className="mx-auto max-w-sm px-4 py-12 space-y-6 text-center">
      <h1 className="text-2xl text-indigo">Tu n’as pas encore de plan</h1>
      <Link href="/plan" className="btn btn-primary">Construire ma préparation</Link>
      <Compte email={email} />
    </main>
  );
}

// Le compte connecté, et de quoi en changer : un lien d'invitation ouvert dans un navigateur déjà connecté à un autre
// compte y mène (décision coach du 20/10/2026).
function Compte({ email }: { email: string }) {
  return (
    <div className="pt-6 space-y-2">
      <p className="text-xs text-indigo/60">Connecté avec {email || 'un compte sans adresse'}. Pas le bon compte ?</p>
      <Deconnexion />
    </div>
  );
}
