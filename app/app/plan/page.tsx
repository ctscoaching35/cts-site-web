import EnTeteApp from '@/components/app/EnTeteApp';
import { contexte, type Recherche } from '@/lib/app/demonstration';

// Onglet construit à l'étape 1d du cadrage de l'app : la démonstration le montre vide.
export default async function Onglet({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5">
        <h1 className="text-2xl text-indigo">Mon plan</h1>
        <p className="mt-3 text-sm text-indigo/60">Démonstration : cet onglet arrive à l’étape 1d.</p>
      </main>
    </>
  );
}
