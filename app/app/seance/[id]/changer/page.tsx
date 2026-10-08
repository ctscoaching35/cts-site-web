import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import ChoixJour, { type LigneChoix } from '@/components/app/ChoixJour';
import EnTeteApp from '@/components/app/EnTeteApp';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { TEXTES, choixDuJour, peutChanger } from '@/lib/app/deplacement';
import { jourParId } from '@/lib/app/plan';

// « Changer de jour » (cadrage §7.2, E1 à E6) : les sept jours de la semaine, le jour prévu marqué, les
// jours moins propices en rouge avec leur raison ; rien n'est interdit.
export default async function ChangerDeJour({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Recherche;
}) {
  const ctx = await contexte(searchParams);
  const { id } = await params;
  const jour = jourParId(ctx.plan, decodeURIComponent(id));
  if (!jour) notFound();
  const fiche = lien(`/app/seance/${jour.id}`, ctx);
  if (!peutChanger(jour, ctx.plan, ctx.retours, ctx.jour)) redirect(fiche);
  const choix = choixDuJour(ctx.prevu, ctx.deplacements, jour.id, ctx.retours, ctx.jour) ?? [];
  const lignes: LigneChoix[] = choix.map((c) => ({
    id: c.jour.id, date: c.jour.date, seance: c.jour.famille === 'repos' ? 'Repos' : c.jour.seance,
    repos: c.jour.famille === 'repos', actuel: c.actuel, prevuIci: c.prevuIci, blocage: c.blocage, raisons: c.raisons,
  }));
  const regles = !!ctx.prevu.deplacement?.regles;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-4">
        <Link href={fiche} className="text-teal font-semibold text-sm">‹ {jour.seance}</Link>
        <div>
          <div className="eyebrow text-teal mb-1">{jour.semaine.numero} · {jour.semaine.dates}</div>
          <h1 className="text-2xl text-indigo leading-tight">{TEXTES.bouton}</h1>
          <p className="text-sm text-indigo/70 mt-1">{TEXTES.intro}</p>
        </div>
        {!regles && <p className="text-sm text-indigo/80 bg-white shadow-sm p-3 border-l-4 border-indigo/30">{TEXTES.sansRegles}</p>}
        <ChoixJour
          planId={ctx.cle} jourId={jour.id} lignes={lignes} demonstration={ctx.demonstration}
          suite={fiche} jourSimule={ctx.demonstration || process.env.NODE_ENV === 'production' ? null : ctx.jour}
        />
        {regles && <p className="text-sm text-indigo/60">{TEXTES.sousLaListe}</p>}
      </main>
    </>
  );
}
