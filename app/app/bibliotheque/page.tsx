import Link from 'next/link';
import EnTeteApp from '@/components/app/EnTeteApp';
import { lireBibliotheque, ficheParSlug } from '@/lib/app/bibliotheque';
import { contexte, lien, type Contexte, type Recherche } from '@/lib/app/demonstration';
import { slugFiche } from '@/lib/app/plan';

// La bibliothèque (cadrage, 3.5 ; décision coach du 07/10/2026) : les fiches de ton plan
// d'abord, puis toutes celles du site, dans ses familles et son ordre.
export default async function Bibliotheque({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const familles = lireBibliotheque();
  const tesFiches = plan.pour_aller_plus_loin.fiches.map((f) => {
    const slug = slugFiche(f.url);
    return { slug, titre: f.titre, texte: ficheParSlug(familles, slug)?.texte ?? '' };
  });
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-6">
        <div>
          <h1 className="text-2xl text-indigo">Bibliothèque</h1>
          <p className="mt-2 text-sm text-indigo/70 leading-relaxed">{plan.pour_aller_plus_loin.app}</p>
        </div>
        <section className="space-y-2">
          <h2 className="eyebrow text-teal">Tes fiches</h2>
          <Cartes fiches={tesFiches} ctx={ctx} />
        </section>
        <section className="space-y-5">
          <h2 className="eyebrow text-indigo/60">Toute la bibliothèque</h2>
          {familles.map((famille) => (
            <div key={famille.titre} className="space-y-2">
              <h3 className="text-base text-indigo">{famille.titre}</h3>
              <Cartes fiches={famille.fiches} ctx={ctx} />
            </div>
          ))}
        </section>
      </main>
    </>
  );
}

function Cartes({ fiches, ctx }: { fiches: { slug: string; titre: string; texte: string }[]; ctx: Contexte }) {
  return (
    <ul className="bg-white shadow-sm divide-y divide-indigo/10">
      {fiches.map((f) => (
        <li key={f.slug}>
          <Link href={lien(`/app/bibliotheque/${f.slug}`, ctx)} className="flex items-center gap-3 px-4 py-3 hover:bg-sand/60">
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-indigo leading-snug">{f.titre}</span>
              {f.texte && <span className="block text-xs text-indigo/60 mt-0.5 leading-relaxed">{f.texte}</span>}
            </span>
            <span aria-hidden className="text-indigo/30">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
