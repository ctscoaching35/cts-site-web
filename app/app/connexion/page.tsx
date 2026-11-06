import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import FormulaireConnexion from '@/components/app/FormulaireConnexion';
import { clientServeur, supabaseConfigure } from '@/lib/app/supabase';

export const metadata: Metadata = { title: 'Connexion' };

// La session se lit à chaque visite : jamais figée à la compilation.
export const dynamic = 'force-dynamic';

// La connexion (cadrage, 3.7 ; D6). Sans Supabase configuré, la démonstration n'en a pas besoin.
// ?achat=1 : le retour d'un paiement dont le compte s'ouvre par code (lib/app/rangement.ts). ?suite= : la page de l'app
// où revenir une fois connecté (le lien d'une note Nolio, « Garder ma séance d'origine ») ; seulement une page de l'app.
export default async function Connexion({ searchParams }: { searchParams: Promise<{ achat?: string; suite?: string }> }) {
  const { achat, suite: demandee } = await searchParams;
  const suite = demandee && /^\/app(\/[A-Za-z0-9/_?=&%.-]*)?$/.test(demandee) ? demandee : '/app';
  if (!supabaseConfigure()) redirect('/app');
  const { data } = await (await clientServeur()).auth.getClaims();
  if (data?.claims?.sub) redirect(suite);
  return (
    <main className="mx-auto max-w-sm px-4 py-12 space-y-8">
      <div className="text-center space-y-3">
        {/* Q4 et C11 (audits du 05/11/2026) : au style de l'app, le logo sans son disque gris. */}
        <Image src="/logo/cts-logo-rond-blanc.png" alt="CTS Coaching" width={64} height={64} className="mx-auto w-16 h-16 object-contain" />
        <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight">Ton espace CTS</h1>
        {achat && (
          <p className="text-sm text-[#4A4866] leading-relaxed">
            Ton nouveau plan est rangé dans ton compte. Entre l’e-mail donné au questionnaire : tu reçois un code
            pour l’ouvrir.
          </p>
        )}
      </div>
      <FormulaireConnexion suite={suite} />
    </main>
  );
}
