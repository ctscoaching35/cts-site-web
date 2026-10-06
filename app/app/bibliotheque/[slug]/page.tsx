import Link from 'next/link';
import { notFound } from 'next/navigation';
import { lireBibliotheque, ficheParSlug } from '@/lib/app/bibliotheque';
import { contexte, lien, type Recherche } from '@/lib/app/demonstration';

// Une fiche ouverte dans l'app : la page du site elle-même (une seule source), dans un cadre,
// sous la barre d'onglets. Seules les fiches de l'index de la bibliothèque s'ouvrent ici.
export default async function Fiche({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Recherche;
}) {
  const ctx = await contexte(searchParams);
  const { slug } = await params;
  const fiche = ficheParSlug(lireBibliotheque(), slug);
  if (!fiche) notFound();
  // Le cadre occupe l'écran jusqu'à la barre d'onglets (h-16 et la zone sûre, BarreOnglets).
  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex flex-col bg-sand">
      <div className="bg-indigo text-white">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Link href={lien('/app/bibliotheque', ctx)} className="text-sm font-semibold text-white/80 hover:text-white whitespace-nowrap">
            ‹ Bibliothèque
          </Link>
          <span className="text-sm font-bold truncate">{fiche.titre}</span>
        </div>
      </div>
      <iframe src={`/bibliotheque/${fiche.slug}`} title={fiche.titre} className="flex-1 w-full border-0 bg-white" />
    </div>
  );
}
