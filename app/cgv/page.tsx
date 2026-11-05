import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Liste, PageLegale, Section } from '@/components/PageLegale';
import { ARTICLES, LIGNES_FORMULAIRE, NUMEROS, PRIX_SANS_LISTE, titreNumerote, type Bloc, type Morceau } from '@/lib/cgv';
import { plansVisibles, VERSION_CGV } from '@/lib/legal';
import { API_URL } from '@/lib/plan';
import { enTetesMoteur } from '@/lib/app/cleMoteur';

// Les conditions générales de vente des plans (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L5). LEUR TEXTE EST DANS
// lib/cgv.ts (5B, décision coach du 05/11/2026 au soir) : la confirmation de commande le porte en entier, mot pour mot
// celui de cette page ; son historique y est aussi. Ici, sa mise en page et le prix de chaque durée, lu dans l'API comme
// sur la page des plans. Fermées comme elle jusqu'au lancement (lib/legal.ts, plansVisibles).
export const metadata: Metadata = {
  title: 'Conditions générales de vente — CTS Coaching',
  description: 'Les conditions de vente des plans d’entraînement trail CTS Coaching.',
};

export const dynamic = 'force-dynamic';

async function prixParMois(): Promise<Record<string, number> | null> {
  try {
    const r = await fetch(`${API_URL}/v1/config`, { next: { revalidate: 3600 }, headers: enTetesMoteur() });
    return r.ok ? (await r.json()).prix_eur_par_mois ?? null : null;
  } catch {
    return null;
  }
}

// Un paragraphe : son texte, ses liens (un autre site s'ouvre à part), ses renvois (le numéro de l'article visé), ses
// sauts de ligne.
function Morceaux({ morceaux }: { morceaux: Morceau[] }) {
  return (
    <>
      {morceaux.map((m, i) => (typeof m === 'string' ? m
        : 'saut' in m ? <br key={i} />
        : 'article' in m ? NUMEROS[m.article]
        : m.externe ? <a key={i} href={m.lien} target="_blank" rel="noopener noreferrer">{m.texte}</a>
        : <a key={i} href={m.lien}>{m.texte}</a>))}
    </>
  );
}

function BlocCgv({ bloc, prix }: { bloc: Bloc; prix: Record<string, number> | null }) {
  switch (bloc.type) {
    case 'p': return <p><Morceaux morceaux={bloc.morceaux} /></p>;
    case 'liste': return <Liste>{bloc.elements.map((e, i) => <li key={i}><Morceaux morceaux={e} /></li>)}</Liste>;
    case 'prix': return prix ? (
      <Liste>
        {Object.entries(prix)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([mois, eur]) => (
            <li key={mois}>
              Plan de {mois} mois : {eur} €
            </li>
          ))}
      </Liste>
    ) : (
      <p>{PRIX_SANS_LISTE}</p>
    );
    case 'formulaire': return (
      <div className="border border-indigo/20 p-4 text-sm space-y-2">
        {LIGNES_FORMULAIRE.map((l, i) => <p key={l} className={i === 0 ? 'font-semibold' : undefined}>{l}</p>)}
      </div>
    );
    case 'encadre': return (
      <div className="border-2 border-indigo/20 bg-white p-5 space-y-3 text-sm">
        {bloc.paragraphes.map((x, i) => <p key={i}><Morceaux morceaux={x} /></p>)}
      </div>
    );
  }
}

export default async function CGV() {
  if (!(await plansVisibles())) notFound();
  const prix = await prixParMois();
  return (
    <PageLegale titre="Conditions générales de vente" version={VERSION_CGV} plans>
      {ARTICLES.map((a) => (
        <Section key={a.cle} titre={titreNumerote(a)}>
          {a.blocs.map((b, i) => <BlocCgv key={i} bloc={b} prix={prix} />)}
        </Section>
      ))}
    </PageLegale>
  );
}
