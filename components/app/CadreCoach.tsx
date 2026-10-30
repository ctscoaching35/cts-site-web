import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { Deconnexion } from './BoutonsCompte';

// Le cadre de l'espace coach (maquettes validées par le coach le 19/10/2026, puis le 24/10/2026) : un menu à gauche sur
// ordinateur, au-dessus du contenu sur téléphone (Tableau de bord, À regarder, sa propre page, Suivi des 7 jours,
// Dimanche, l'aperçu des semaines qui s'écrivent dimanche soir, ajouté le 30/10/2026, Chiffres ; plus de Bibliothèque, décision coach du 20/10/2026 : « ça ne m'apporte rien »), le coach. Plus de lien « Voir l'app d'un athlète » (décision coach du 20/10/2026) : il ouvrait l'app du compte coach ;
// chaque version se voit par son propre compte (coach, coaché, acheteur).
export type RubriqueCoach = 'tableau' | 'regarder' | 'suivi' | 'dimanche' | 'chiffres';

// aRegarder : le nombre de lignes de « À regarder », que le tableau de bord et « À regarder » connaissent.
export default function CadreCoach({ actif, aRegarder = 0, coach, children }: {
  actif: RubriqueCoach; aRegarder?: number; coach?: string; children: React.ReactNode;
}) {
  const liens: [RubriqueCoach, string, string][] = [
    ['tableau', 'Tableau de bord', '/app/coach'],
    ['regarder', 'À regarder', '/app/coach/a-regarder'],
    ['suivi', 'Suivi des 7 jours', '/app/coach/suivi'],
    ['dimanche', 'Dimanche', '/app/coach/dimanche'],
    ['chiffres', 'Chiffres', '/app/coach/chiffres'],
  ];
  return (
    <div className="min-h-screen flex flex-wrap bg-sand text-indigo">
      <aside className="flex-[1_1_220px] lg:max-w-[260px] bg-indigo text-white px-4 py-5 lg:py-6 flex flex-col gap-5">
        <Link href="/app/coach" className="flex items-center gap-2.5 px-2">
          <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
            <Image src="/logo/cts-logo-white.png" alt="CTS Coaching" width={32} height={32} className="w-8 h-8 object-contain" />
          </span>
          <span>
            <span className="block text-xs font-bold tracking-[0.12em]">CTS COACHING</span>
            <span className="block text-[0.6875rem] text-[#B9B8CC]">Espace coach</span>
          </span>
        </Link>
        <nav aria-label="Espace coach" className="flex flex-row flex-wrap lg:flex-col gap-1">
          {liens.map(([cle, titre, href]) => (
            <Link key={cle} href={href} aria-current={cle === actif ? 'page' : undefined}
              className={clsx('flex items-center justify-between gap-2 min-h-11 px-3 rounded-[10px] text-sm',
                cle === actif ? 'bg-white/10 text-white font-bold' : 'text-[#D6D5E6] font-semibold hover:bg-white/5')}>
              <span>{titre}</span>
              {cle === 'regarder' && aRegarder > 0 && (
                <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-[#2BB39B] text-[#10302B] text-xs font-extrabold inline-flex items-center justify-center">{aRegarder}</span>
              )}
            </Link>
          ))}
        </nav>
        {/* Changer de compte : coach, coaché ou acheteur, chacun voit sa version par son compte. */}
        <div className="-mt-3"><Deconnexion menu /></div>
        <div className="hidden lg:flex mt-auto p-3 rounded-xl bg-white/[0.06] flex-col gap-1">
          {coach && <span className="text-xs font-bold">{coach}</span>}
          <span className="text-[0.6875rem] text-[#B9B8CC]">Nolio relié par la clé de l’API</span>
        </div>
      </aside>
      <main className="flex-[999_1_560px] min-w-0 px-4 py-5 sm:px-8 sm:py-8">
        <div className="max-w-5xl space-y-6">{children}</div>
      </main>
    </div>
  );
}
