import Image from 'next/image';
import Link from 'next/link';
import BarreDemonstration from './BarreDemonstration';
import { EXEMPLES, demonstrationOuverte } from '@/lib/app/demonstration';
import { initiales, lien, type Contexte } from '@/lib/app/contexte';

// L'en-tête de l'app (maquettes validées par le coach le 19/10/2026) : le logo, la marque, les initiales de
// l'athlète, qui ouvrent son compte.
export default function EnTeteApp({ ctx }: { ctx: Contexte }) {
  return (
    <>
      <header className="bg-white border-b border-indigo/[0.08]">
        <div className="mx-auto max-w-2xl h-16 px-4 flex items-center justify-between gap-3">
          <Link href={lien('/app', ctx)} className="flex items-center gap-2.5 min-w-0">
            <Image src="/logo/cts-logo-white.png" alt="CTS Coaching" width={36} height={36} className="w-9 h-9 object-contain" />
            <span className="text-[0.8125rem] font-bold tracking-[0.12em] text-indigo">CTS COACHING</span>
          </Link>
          <Link href={lien('/app/compte', ctx)} aria-label="Ton compte"
            className="w-9 h-9 rounded-full bg-[#E1EFEA] text-teal-dark flex items-center justify-center text-[0.8125rem] font-bold shrink-0">
            {initiales(ctx.plan.athlete.nom)}
          </Link>
        </div>
      </header>
      {ctx.demonstration && demonstrationOuverte() && (
        <BarreDemonstration
          exemples={Object.entries(EXEMPLES).map(([cle, x]) => ({ cle, titre: x.titre }))}
          cle={ctx.cle}
          jour={ctx.jour}
        />
      )}
    </>
  );
}
