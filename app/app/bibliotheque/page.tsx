import Link from 'next/link';
import EnTeteApp from '@/components/app/EnTeteApp';
import ToutesLesFiches from '@/components/app/ToutesLesFiches';
import { Surtitre } from '@/components/app/Ui';
import { lireBibliotheque, lireCalculateurs } from '@/lib/app/bibliotheque';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';

// La bibliothèque (cadrage, 3.5 ; décisions coach des 07 et 11/10/2026 ; AP1 et maquette validée le 19/10/2026) :
// les deux calculateurs du site ; toutes les fiches par famille, avec une recherche. Plus de « Pour ta préparation »
// en tête (décision coach du 20/10/2026 : des doublons) ; la fiche du moment reste sur l'accueil.
export default async function Bibliotheque({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const familles = lireBibliotheque();
  const calculateurs = lireCalculateurs();
  const params = new URLSearchParams(lien('', ctx).split('?')[1] ?? '').toString();
  const suite = params ? `?${params}` : '';
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div>
          <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight">Bibliothèque</h1>
          <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78] leading-relaxed">Les fiches de tes coachs, kinés du sport, fondées sur la littérature.</p>
        </div>

        <section className="space-y-2.5">
          <Surtitre>Calculateurs</Surtitre>
          <ul className="grid grid-cols-2 gap-2.5">
            {calculateurs.map((c, i) => (
              <li key={c.slug}>
                <Link href={lien(`/app/calculateurs/${c.slug}`, ctx)} className="h-full min-h-24 bg-indigo text-white rounded-[14px] p-3.5 flex flex-col gap-2">
                  <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="none" stroke="#8FD1C3" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {i === 0 ? <path d="M3 20 9 9l4 6 3-4 5 9z" /> : <><path d="M8 3h8l-1 5a4 4 0 0 1-6 0z" /><path d="M12 11v10M8 21h8" /></>}
                  </svg>
                  <span className="text-[0.84rem] font-bold leading-snug">{c.titre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <ToutesLesFiches familles={familles} suite={suite} />
      </main>
    </>
  );
}
