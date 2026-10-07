import Image from 'next/image';
import { redirect } from 'next/navigation';
import FormulaireConnexion from '@/components/app/FormulaireConnexion';
import { clientServeur, supabaseConfigure } from '@/lib/app/supabase';

// La session se lit à chaque visite : jamais figée à la compilation.
export const dynamic = 'force-dynamic';

// La connexion (cadrage, 3.7 ; D6). Sans Supabase configuré, la démonstration n'en a pas besoin.
// ?achat=1 : le retour d'un paiement dont le compte s'ouvre par code (lib/app/rangement.ts).
export default async function Connexion({ searchParams }: { searchParams: Promise<{ achat?: string }> }) {
  const { achat } = await searchParams;
  if (!supabaseConfigure()) redirect('/app');
  const { data } = await (await clientServeur()).auth.getClaims();
  if (data?.claims?.sub) redirect('/app');
  return (
    <main className="mx-auto max-w-sm px-4 py-12 space-y-8">
      <div className="text-center space-y-3">
        <Image src="/logo/cts-logo-rond-navy.png" alt="CTS Coaching" width={64} height={64} className="mx-auto w-16 h-16" />
        <h1 className="text-2xl text-indigo">Ton plan CTS</h1>
        {achat && (
          <p className="text-indigo/70 leading-relaxed">
            Ton nouveau plan est rangé dans ton compte. Entre l’e-mail donné au questionnaire : tu reçois un code
            pour l’ouvrir.
          </p>
        )}
      </div>
      <FormulaireConnexion />
    </main>
  );
}
