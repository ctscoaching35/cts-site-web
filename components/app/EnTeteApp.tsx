import Image from 'next/image';
import BarreDemonstration from './BarreDemonstration';
import { EXEMPLES, demonstrationOuverte, type Contexte } from '@/lib/app/demonstration';

export default function EnTeteApp({ ctx }: { ctx: Contexte }) {
  return (
    <>
      <header className="bg-indigo text-white">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Image src="/logo/cts-logo-rond-navy.png" alt="CTS Coaching" width={36} height={36} className="w-9 h-9" />
          <div className="min-w-0">
            <div className="text-[0.62rem] font-bold tracking-cts uppercase text-white/55">CTS Coaching</div>
            <div className="text-sm font-bold truncate">{ctx.plan.course.nom}</div>
          </div>
        </div>
      </header>
      {demonstrationOuverte() && (
        <BarreDemonstration
          exemples={Object.entries(EXEMPLES).map(([cle, x]) => ({ cle, titre: x.titre }))}
          cle={ctx.cle}
          jour={ctx.jour}
        />
      )}
    </>
  );
}
