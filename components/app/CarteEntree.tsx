import Link from 'next/link';
import { NOTE_AVANT_DE_DEMARRER as NOTE_D_AVANT, type Entree } from '@/lib/app/entree';
import { motsDuCoach } from '@/lib/app/motsDuCoach';
import { Carte, Surtitre } from './Ui';

// Une section de « Réglages » (9.x) : le même contenu, sans la carte.
function Section({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={className}>{children}</section>;
}

// « Son entrée » (décision coach du 22/10/2026) : en tête de sa fiche tant qu'elle n'est pas complète, les étapes dans
// l'ordre, cochées d'elles-mêmes (lib/app/entree.ts), chacune avec son geste ; le rappel de ses anciennes séries.
// accordRecu : « Accord reçu », le geste de son accord de lecture (il vivait dans le Suivi des 7 jours, supprimé le
// 04/11/2026) ; sans compte Nolio associé, pas encore.
// plat : sous la 9.x, la carte, une fois les étapes du coach faites, est une section de « Réglages » (sans cadre à elle, et sans le rappel du départ quand l'entrée est complète) ; sans lui, la carte d'avant
// (la 8.x ne montre jamais une entrée complète : rien n'y change).
// Sous la 9.x (`plat`), les phrases de l'entrée se lisent en mots du coach (« son effort ressenti et sa fatigue déclarée » : lib/app/motsDuCoach.ts, décision 220 du coach, 24/11/2026) ; sous la 8.x, telles qu'avant.
export default function CarteEntree({ entree, accordRecu, plat = false }: { entree: Entree; accordRecu?: () => Promise<void>; plat?: boolean }) {
  const Cadre = plat ? Section : Carte;
  const enMots = motsDuCoach(plat).enMots;
  // Le rappel du départ, en mots du coach sous la 9.x (sans « Hooper »), tel qu'avant sous la 8.x.
  const NOTE_AVANT_DE_DEMARRER = enMots(NOTE_D_AVANT);
  return (
    <Cadre id="son-entree" className={plat ? 'py-4 space-y-3 scroll-mt-6' : '!p-5 space-y-3 scroll-mt-6'}>
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
              {e.detail && <span className="block mt-0.5 text-[0.8125rem] text-[#4A4866] leading-relaxed">{enMots(e.detail)}</span>}
            </span>
            {e.cle === 'accord' && !e.fait && accordRecu ? (
              <form action={accordRecu}>
                <button type="submit" className="inline-flex items-center min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold whitespace-nowrap">
                  Accord reçu
                </button>
              </form>
            ) : e.action && (
              <Link href={e.action.href} className="inline-flex items-center min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold whitespace-nowrap">
                {e.action.texte}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {!entree.complete && <p className="p-3 rounded-xl bg-sand text-xs text-[#4A4866] leading-relaxed">{NOTE_AVANT_DE_DEMARRER}</p>}
    </Cadre>
  );
}
