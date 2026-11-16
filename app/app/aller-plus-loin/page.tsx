import type { Metadata } from 'next';
import Link from 'next/link';
import EnTeteGratuit from '@/components/app/EnTeteGratuit';
import { Carte, Surtitre, TITRE } from '@/components/app/Ui';
import { pageGratuite } from '@/lib/app/accesGratuit';
import { prixDesFormules } from '@/lib/app/prix';
import { planOuvert } from '@/lib/planAcces';

export const metadata: Metadata = { title: 'Aller plus loin' };
export const dynamic = 'force-dynamic';

// « ALLER PLUS LOIN » (app gratuite, lot A2 ; maquette « Aller plus loin » validée par le coach le 16/11/2026, qui a demandé de
// mieux valoriser le plan face au coaching : le plan, en tête, sur la carte sombre et grande ; le coaching, plus discret, en
// dessous). Les prix du plan viennent de l'API du moteur (jamais écrits ici) ; sans réponse, la carte s'affiche sans prix. Le
// plan reste fermé jusqu'au lancement (lib/planAcces.ts) : « Les plans ouvrent bientôt » à la place du bouton. AUCUN texte du
// plan n'invite à échanger avec le coach. Textes en brouillon, à valider par le coach.
const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ATOUTS: { texte: string; icone: React.ReactNode }[] = [
  { texte: 'Il part de ce que tu cours vraiment, et monte d’un cran à la fois.', icone: <path d="M4 20h4v-4h4v-4h4V8h4" {...trait} /> },
  { texte: 'Chaque dimanche, ta semaine suivante est réécrite selon ce que tu as fait.', icone: <><path d="M20 12a8 8 0 1 1-3-6.2" {...trait} /><path d="M20 4v5h-5" {...trait} /></> },
  { texte: 'Construit sur ta course et sur tes zones.', icone: <path d="M3 20 9 9l4 6 3-4 5 9z" {...trait} /> },
  { texte: 'Tes séances dans Nolio, jusqu’à ta montre ; ta préparation dans l’app.', icone: <><rect x="7" y="6" width="10" height="12" rx="3" {...trait} /><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 10v2.5l1.5 1" {...trait} /></> },
];

// Le prix de lancement court jusqu'au 28/02/2027 (CLAUDE.md) : la phrase ne se dit plus après.
const FIN_LANCEMENT = '2027-02-28';
const jourParis = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

export default async function AllerPlusLoin() {
  const acces = await pageGratuite();
  const [prix, ouvert] = await Promise.all([prixDesFormules(), planOuvert()]);
  const formules = prix ? ['3', '4', '6'].filter((m) => typeof prix[m] === 'number') : [];
  return (
    <>
      <EnTeteGratuit acces={acces} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div className="space-y-2.5 pt-2">
          <Surtitre as="div">Aller plus loin</Surtitre>
          <h1 className={TITRE}>Tu sais ce que ta course demande. Maintenant, t’y préparer.</h1>
          <p className="text-sm text-[#5E5C78] leading-relaxed">Deux façons de t’entraîner avec la méthode City to Summit : celle de deux kinés, adaptée chaque semaine à ce que tu cours.</p>
        </div>

        {/* Le plan, en tête et en grand. */}
        <section className="bg-indigo text-white rounded-[18px] p-5 space-y-4 ring-2 ring-teal">
          <div className="flex items-center justify-between gap-2">
            <Surtitre ton="clair">Le plan adaptatif</Surtitre>
            <span className="text-[0.6875rem] font-bold text-indigo bg-white rounded-full px-2.5 py-1">30 places fondatrices</span>
          </div>
          <h2 className="text-[1.3125rem] leading-tight font-extrabold">Ton plan jusqu’à ta course, qui s’adapte chaque semaine à ce que tu as couru.</h2>
          <ul className="space-y-3">
            {ATOUTS.map((a) => (
              <li key={a.texte} className="flex items-start gap-3">
                <span className="w-9 h-9 shrink-0 rounded-[10px] bg-white/10 text-[#8FD1C3] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>{a.icone}</svg>
                </span>
                <span className="text-[0.84rem] leading-snug pt-1.5">{a.texte}</span>
              </li>
            ))}
          </ul>
          {formules.length > 0 && prix && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {formules.map((m) => (
                  <div key={m} className="bg-white/10 rounded-xl px-2 py-3 text-center">
                    <span className="block text-[0.6875rem] font-bold text-[#D6D5E6]">{m} mois</span>
                    <span className="block mt-0.5 text-[1.375rem] font-extrabold">{prix[m]}&nbsp;€</span>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-[#D6D5E6]">
                Paiement unique.{jourParis() <= FIN_LANCEMENT ? ' Prix de lancement jusqu’au 28 février 2027.' : ''} La formule qui colle à ta date est proposée d’office.
              </p>
            </>
          )}
          {formules.length === 0 && <p className="text-xs leading-relaxed text-[#D6D5E6]">Paiement unique, en 3, 4 ou 6 mois : la formule qui colle à ta date est proposée d’office.</p>}
          {ouvert ? (
            <Link href="/plan" className="flex items-center justify-center min-h-[52px] rounded-xl bg-white text-indigo text-[0.9375rem] font-bold">Construire mon plan</Link>
          ) : (
            <div className="rounded-xl bg-white/10 px-4 py-3.5 space-y-0.5">
              <p className="text-[0.9375rem] font-bold">Les plans ouvrent bientôt.</p>
              <p className="text-xs leading-relaxed text-[#D6D5E6]">Ton profil et tes courses restent à toi : ils t’attendront.</p>
            </div>
          )}
        </section>

        {/* Le coaching, plus discret. */}
        <Carte className="space-y-3">
          <Surtitre>Le coaching humain</Surtitre>
          <h2 className="text-[1.0625rem] leading-snug font-extrabold text-indigo">Un coach qui te suit : la relation, l’échange et son jugement, semaine après semaine.</h2>
          <p className="text-[0.8125rem] leading-relaxed text-[#4A4866]">Pour un objectif qui compte, une situation particulière, ou quand tu veux un suivi humain.</p>
          <p className="text-lg font-extrabold text-indigo">89&nbsp;€ par mois.</p>
          <Link href="/app/coaching" className="inline-flex w-full items-center justify-center min-h-12 rounded-xl border border-indigo/25 bg-white text-indigo text-sm font-bold">Demander le coaching</Link>
          <p className="text-xs leading-relaxed text-[#5E5C78]">D’abord quelques questions, puis un appel pour voir si vous pouvez travailler ensemble.</p>
        </Carte>

        <Carte className="space-y-2">
          <Surtitre>Lequel choisir ?</Surtitre>
          <p className="text-[0.8125rem] leading-relaxed text-[#4A4866]">
            Tu cours régulièrement, sans douleur, et tu veux une préparation qui suit ta vraie vie : le plan. Tu veux un suivi humain, ou tu as une douleur, une maladie, une situation particulière : vois d’abord un professionnel de santé si besoin, puis le coaching.
          </p>
        </Carte>

        {acces.cas === 'visiteur' ? (
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed text-center">
            Ton profil et tes courses restent à toi, plan ou pas.{' '}
            <Link href="/app/me-connecter" className="font-bold text-teal whitespace-nowrap">Créer mon compte ›</Link>
          </p>
        ) : (
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed text-center">Ton profil et tes courses restent à toi, plan ou pas.</p>
        )}
      </main>
    </>
  );
}
