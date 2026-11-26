import Link from 'next/link';
import clsx from 'clsx';
import { Carte } from './Ui';
import type { LigneDUnMot } from '@/lib/app/motsDesCoaches';

// « MES ATHLÈTES » SOUS LA 9.x (décision 241 du coach, 25/11/2026, moment 3) : une ligne par coaché, son nom et un seul mot à droite. Le nom ouvre toujours la page de l'athlète, le mot ouvre son geste (la
// page, à l'ancre du formulaire à remplir, ou l'endroit du point : Nolio, sa demande…) ; quand le geste est sur sa page, toute la ligne y mène. Les mots et leur ordre : lib/app/unMot.ts.
const TONS = {
  ko: 'bg-[#FBE7E3] text-[#8A3326]', warn: 'bg-[#FFF6E5] text-[#7A520D]', ok: 'bg-[#E3EFE9] text-[#22604F]', neutre: 'bg-indigo/[0.05] text-[#4A4866]',
} as const;

export default function ListeSimple({ lignes }: { lignes: LigneDUnMot[] }) {
  if (!lignes.length) return <Carte className="!p-5"><p className="text-sm text-[#4A4866]">Aucun coaché pour l’instant.</p></Carte>;
  return (
    <Carte className="!p-0 overflow-hidden">
      <ul className="divide-y divide-indigo/[0.07]">
        {lignes.map((l) => {
          const nom = <span className="min-w-0 flex-1 text-[0.9375rem] font-bold text-indigo">{l.nom}</span>;
          const mot = <span className={clsx('shrink-0 text-[0.8125rem] font-bold px-3 py-1.5 rounded-full', TONS[l.un.ton])}>{l.un.mot}</span>;
          const fleche = <span aria-hidden className="text-[#8B89A3]">›</span>;
          const contenu = <>{nom}{mot}{fleche}</>;
          const classe = 'flex items-center gap-3 min-h-14 px-4 py-2 hover:bg-sand';
          // Quand le geste est ailleurs que sur sa page (Nolio, sa demande, un nouvel objectif), le nom ouvre sa page et le mot seul mène au geste ; sans cela, sa page ne s'ouvrait plus (vu en ligne le 26/11/2026).
          const page = `/app/coach/athlete/${l.id}`;
          if (!l.un.href.startsWith(page)) {
            const classeDuMot = 'shrink-0 min-h-11 flex items-center';
            return (
              <li key={l.id} className={classe}>
                <Link href={page} className="min-w-0 flex-1 min-h-11 flex items-center">{nom}</Link>
                {l.un.externe ? <a href={l.un.href} target="_blank" rel="noopener" className={classeDuMot}>{mot}</a> : <Link href={l.un.href} className={classeDuMot}>{mot}</Link>}
                {fleche}
              </li>
            );
          }
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
