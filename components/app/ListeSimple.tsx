import Link from 'next/link';
import clsx from 'clsx';
import { Carte } from './Ui';
import type { LigneDUnMot } from '@/lib/app/motsDesCoaches';

// « MES ATHLÈTES » SOUS LA 9.x (décision 241 du coach, 25/11/2026, moment 3) : une ligne par coaché, son nom et un seul mot à droite ; toute la ligne ouvre le bon geste (la page de l'athlète, à l'ancre du
// formulaire à remplir, ou l'endroit du point). Les mots et leur ordre : lib/app/unMot.ts.
const TONS = {
  ko: 'bg-[#FBE7E3] text-[#8A3326]', warn: 'bg-[#FFF6E5] text-[#7A520D]', ok: 'bg-[#E3EFE9] text-[#22604F]', neutre: 'bg-indigo/[0.05] text-[#4A4866]',
} as const;

export default function ListeSimple({ lignes }: { lignes: LigneDUnMot[] }) {
  if (!lignes.length) return <Carte className="!p-5"><p className="text-sm text-[#4A4866]">Aucun coaché pour l’instant.</p></Carte>;
  return (
    <Carte className="!p-0 overflow-hidden">
      <ul className="divide-y divide-indigo/[0.07]">
        {lignes.map((l) => {
          const contenu = (
            <>
              <span className="min-w-0 flex-1 text-[0.9375rem] font-bold text-indigo">{l.nom}</span>
              <span className={clsx('shrink-0 text-[0.8125rem] font-bold px-3 py-1.5 rounded-full', TONS[l.un.ton])}>{l.un.mot}</span>
              <span aria-hidden className="text-[#8B89A3]">›</span>
            </>
          );
          const classe = 'flex items-center gap-3 min-h-14 px-4 py-2 hover:bg-sand';
          return (
            <li key={l.id}>
              {l.un.externe ? <a href={l.un.href} target="_blank" rel="noopener" className={classe}>{contenu}</a> : <Link href={l.un.href} className={classe}>{contenu}</Link>}
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}
