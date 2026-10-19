import Link from 'next/link';
import EnTeteApp from '@/components/app/EnTeteApp';
import ToutesLesFiches from '@/components/app/ToutesLesFiches';
import { Surtitre } from '@/components/app/Ui';
import { lireBibliotheque, ficheParSlug, lireCalculateurs } from '@/lib/app/bibliotheque';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { dateLongue, slugFiche } from '@/lib/app/plan';
import { ficheDuMoment } from '@/lib/app/tableau';
import { donneesTableau } from '@/lib/app/tableauDuPlan';

// La bibliothèque (cadrage, 3.5 ; décisions coach des 07 et 11/10/2026 ; AP1 et maquette validée le 19/10/2026) :
// les fiches de la préparation d'abord, la fiche du moment en tête ; les deux calculateurs du site ; toutes les
// fiches par famille, avec une recherche.
export default async function Bibliotheque({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan, jour } = ctx;
  const familles = lireBibliotheque();
  const calculateurs = lireCalculateurs();
  const d = await donneesTableau(ctx);
  const moment = ficheDuMoment(d.fiches, jour);
  const slugDe = (f: { cle: string; url: string | null }) => (f.url ? slugFiche(f.url) : f.cle);
  const momentSlug = moment && moment.fiche.cle !== 'course' && !moment.avenir ? slugDe(moment.fiche) : null;
  // Le moment de chaque fiche du plan (sa note dans Nolio), pour dire quand elle compte.
  const quand = new Map(d.fiches.filter((f) => f.cle !== 'course').map((f) => [slugDe(f), f]));
  const tesFiches = plan.pour_aller_plus_loin.fiches.map((f) => {
    const slug = slugFiche(f.url);
    const m = quand.get(slug);
    return { slug, titre: ficheParSlug(familles, slug)?.titre ?? f.titre,
      sous: m ? (m.date > jour ? `à lire le ${dateLongue(m.date, true)}` : m.pourquoi) : ficheParSlug(familles, slug)?.texte ?? '' };
  }).filter((f) => f.slug !== momentSlug);
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
          <Surtitre>Pour ta préparation</Surtitre>
          {moment && momentSlug && (
            <Link href={lien(`/app/bibliotheque/${momentSlug}`, ctx)}
              className="block bg-white rounded-2xl border-[1.5px] border-[#C9A25A] p-4 space-y-1.5">
              <span className="inline-block text-[0.656rem] font-bold tracking-[0.08em] text-[#7A520D] bg-[#F6ECD8] rounded-md px-2 py-0.5">À LIRE MAINTENANT</span>
              <span className="block text-base font-bold text-indigo">{ficheParSlug(familles, momentSlug)?.titre ?? moment.fiche.titre}</span>
              <span className="block text-[0.8rem] text-[#4A4866] leading-relaxed">{moment.fiche.pourquoi}</span>
            </Link>
          )}
          {tesFiches.length > 0 && (
            <ul className="bg-white rounded-2xl border border-indigo/[0.08] px-4">
              {tesFiches.map((f) => (
                <li key={f.slug} className="border-b last:border-b-0 border-indigo/[0.06]">
                  <Link href={lien(`/app/bibliotheque/${f.slug}`, ctx)} className="flex items-center justify-between gap-3 min-h-[52px] py-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-indigo">{f.titre}</span>
                      {f.sous && <span className="block text-[0.72rem] text-[#5E5C78] mt-0.5">{f.sous}</span>}
                    </span>
                    <span aria-hidden className="text-[#5E5C78]">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

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
