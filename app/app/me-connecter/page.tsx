import type { Metadata } from 'next';
import EnTeteGratuit from '@/components/app/EnTeteGratuit';
import FormulaireMeConnecter from '@/components/app/FormulaireMeConnecter';
import { pageGratuite } from '@/lib/app/accesGratuit';
import { gratuitOuvert } from '@/lib/app/gratuit';

// Le titre seulement quand l'app gratuite est ouverte pour cette visite : en mode « coupe », la page est introuvable et
// son titre ne transparaît pas (le titre par défaut, comme toute adresse inexistante).
export async function generateMetadata(): Promise<Metadata> {
  return (await gratuitOuvert()) ? { title: 'Me connecter' } : {};
}
export const dynamic = 'force-dynamic';

// « Me connecter » de l'app gratuite (maquette « Garder » du 16/11/2026) : l'e-mail, le code à 6 chiffres ; le compte se
// crée ici, nulle part ailleurs. Un compte déjà connecté va à son accueil. La connexion des acheteurs (/app/connexion) ne
// change pas.
// Lot A2 : ?suite=/app/coaching, la demande de coaching, qui passe par un compte : après le code, la personne revient au formulaire.
const SUITES = ['/app/coaching'];
export default async function MeConnecter({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const acces = await pageGratuite({ visiteurSeulement: true });
  const { suite } = await searchParams;
  return (
    <>
      <EnTeteGratuit acces={acces} fermer />
      <main className="mx-auto max-w-sm px-4 pt-6 pb-6">
        <FormulaireMeConnecter suite={SUITES.includes(String(suite)) ? String(suite) : null} />
      </main>
    </>
  );
}
