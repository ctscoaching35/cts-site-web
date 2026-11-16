import type { Metadata } from 'next';
import EnTeteGratuit from '@/components/app/EnTeteGratuit';
import FormulaireMeConnecter from '@/components/app/FormulaireMeConnecter';
import { pageGratuite } from '@/lib/app/accesGratuit';

export const metadata: Metadata = { title: 'Me connecter' };
export const dynamic = 'force-dynamic';

// « Me connecter » de l'app gratuite (maquette « Garder » du 16/11/2026) : l'e-mail, le code à 6 chiffres ; le compte se
// crée ici, nulle part ailleurs. Un compte déjà connecté va à son accueil. La connexion des acheteurs (/app/connexion) ne
// change pas.
export default async function MeConnecter() {
  const acces = await pageGratuite({ visiteurSeulement: true });
  return (
    <>
      <EnTeteGratuit acces={acces} fermer />
      <main className="mx-auto max-w-sm px-4 pt-6 pb-6">
        <FormulaireMeConnecter />
      </main>
    </>
  );
}
