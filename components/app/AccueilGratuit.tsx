import Link from 'next/link';
import type { Acces } from '@/lib/app/acces';
import EnTeteGratuit from './EnTeteGratuit';
import { AllerPlusLoin } from './AllerPlusLoin';
import { TITRE } from './Ui';

// L'accueil de l'app gratuite (maquette « Main » validée le 16/11/2026, textes mot pour mot) : trois entrées, la phrase
// sur le compte (un visiteur seulement) et « Aller plus loin », qui mène à la page /app/aller-plus-loin (lot A2).
const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ENTREES = [
  {
    href: '/app/profil?test=1', titre: 'Faire un test', texte: 'Deux efforts à fond, ou le test de la parole : tes zones et ton style de coureur.',
    icone: <path d="M4 14h3l2-6 3 10 2-6 2 3h4" {...trait} />,
  },
  {
    href: '/app/courses', titre: 'Préparer ma course', texte: 'Importe ta trace GPX : profil, pentes, gestion de l’effort, nutrition, carte à partager.',
    icone: <path d="M3 20 9 9l4 6 3-4 5 9z" {...trait} />,
  },
  {
    href: '/app/bibliotheque', titre: 'Lire la bibliothèque', texte: 'Les fiches de Juliette et Romain, kinés du sport, fondées sur la littérature.',
    icone: <><path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z" {...trait} /><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" {...trait} /></>,
  },
];

export default function AccueilGratuit({ acces }: { acces: Acces }) {
  return (
    <>
      <EnTeteGratuit acces={acces} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div className="space-y-2.5 pt-2">
          <span className="text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-teal">L’app gratuite</span>
          <h1 className={TITRE}>Comprends ton profil. Prépare ta course.</h1>
          <p className="text-sm text-[#5E5C78] leading-relaxed">
            Comprendre ton profil, t’entraîner avec méthode et progresser en trail, même loin de la montagne : la méthode de deux kinés, adaptée chaque semaine à ce que tu cours.
          </p>
        </div>

        {ENTREES.map((e) => (
          <Link key={e.href} href={e.href}
            className="flex items-center gap-3.5 bg-white rounded-2xl border border-indigo/[0.08] p-4 min-h-11">
            <span className="w-11 h-11 shrink-0 rounded-xl bg-sand-dark text-teal flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>{e.icone}</svg>
            </span>
            <span className="flex-1 flex flex-col gap-0.5">
              <span className="text-base font-extrabold text-indigo">{e.titre}</span>
              <span className="text-[0.78rem] leading-snug text-[#5E5C78]">{e.texte}</span>
            </span>
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-[#5E5C78]" aria-hidden><path d="M9 6l6 6-6 6" {...trait} /></svg>
          </Link>
        ))}

        {acces.cas === 'visiteur' && (
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Sans compte, tu vois tes résultats. Pour les garder sur ton téléphone et ton ordinateur, ton e-mail suffit, sans mot de passe.{' '}
            <Link href="/app/me-connecter" className="font-bold text-teal whitespace-nowrap">Créer mon compte ›</Link>
          </p>
        )}

        <AllerPlusLoin />
      </main>
    </>
  );
}
