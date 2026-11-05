import { redirect } from 'next/navigation';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';

// C28 (audits du 05/11/2026) : la page orpheline « Ton plan en un coup d'œil » (ancien style, « Assimilation »,
// « Mécanique ») est retirée ; son adresse mène à « Ta préparation ».
export default async function VueEnsemble({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  redirect(lien('/app/plan', ctx));
}
