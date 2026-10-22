import Link from 'next/link';
import type { Entree } from '@/lib/app/entree';
import { Carte, Surtitre } from './Ui';

// « Son entrée » (décision coach du 22/10/2026) : en tête de sa fiche tant qu'elle n'est pas complète, les étapes dans
// l'ordre, cochées d'elles-mêmes (lib/app/entree.ts), chacune avec son geste ; le rappel de ses anciennes séries.
export default function CarteEntree({ entree }: { entree: Entree }) {
  return (
    <Carte className="!p-5 space-y-3">
      <div className="flex justify-between items-baseline gap-3">
        <Surtitre>Son entrée</Surtitre>
        <span className="text-[0.8125rem] font-bold text-[#7A520D]">{entree.faites}/{entree.total}</span>
      </div>
      <ol>
        {entree.etapes.map((e) => (
          <li key={e.cle} className="grid grid-cols-[22px_1fr_auto] items-start gap-x-2.5 py-2.5 border-t border-indigo/[0.06] first:border-t-0">
            <span aria-hidden className={e.fait
              ? 'mt-0.5 w-[18px] h-[18px] rounded-full bg-teal flex items-center justify-center'
              : 'mt-0.5 w-[18px] h-[18px] rounded-full border-2 border-indigo/25'}>
              {e.fait && (
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17 19 7" /></svg>
              )}
            </span>
            <span className="min-w-0">
              <span className={e.fait ? 'block text-sm text-[#5E5C78]' : 'block text-sm font-bold text-indigo'}>
                {e.titre}<span className="sr-only">{e.fait ? ', fait' : ', à faire'}</span>
              </span>
              {e.detail && <span className="block mt-0.5 text-[0.8125rem] text-[#4A4866] leading-relaxed">{e.detail}</span>}
            </span>
            {e.action && (
              <Link href={e.action.href} className="inline-flex items-center min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold whitespace-nowrap">
                {e.action.texte}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <p className="p-3 rounded-xl bg-sand text-xs text-[#4A4866] leading-relaxed">
        Avant de démarrer, retire de son Nolio tes anciennes séries de questionnaire et de Hooper : les siennes partent
        désormais d’ici.
      </p>
    </Carte>
  );
}
