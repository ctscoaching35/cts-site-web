'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Famille } from '@/lib/app/bibliotheque';

// Toutes les fiches de la bibliothèque, par famille (la première ouverte), et la recherche qui les filtre par titre
// et par résumé (maquette validée par le coach le 19/10/2026).
export default function ToutesLesFiches({ familles, suite }: { familles: Famille[]; suite: string }) {
  const [q, setQ] = useState('');
  const norme = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const cherche = norme(q.trim());
  const trouvees = cherche
    ? familles.flatMap((f) => f.fiches).filter((f) => norme(`${f.titre} ${f.texte}`).includes(cherche))
    : [];
  return (
    <>
      <label className="flex items-center gap-2.5 min-h-12 px-3.5 rounded-xl bg-white border border-indigo/[0.14]">
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="none" stroke="#5E5C78" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <span className="sr-only">Chercher une fiche</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une fiche"
          className="flex-1 bg-transparent outline-none text-sm text-indigo placeholder:text-[#8B89A3]" />
      </label>
      {cherche ? (
        <section className="space-y-2.5">
          <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">
            {trouvees.length ? `${trouvees.length} fiche${trouvees.length > 1 ? 's' : ''}` : 'Aucune fiche'}
          </h2>
          {trouvees.length > 0 && (
            <ul className="bg-white rounded-2xl border border-indigo/[0.08] px-4">
              {trouvees.map((f) => (
                <li key={f.slug} className="border-b last:border-b-0 border-indigo/[0.06]">
                  <Link href={`/app/bibliotheque/${f.slug}${suite}`} className="block py-3">
                    <span className="block text-sm font-bold text-indigo">{f.titre}</span>
                    <span className="block text-xs text-[#5E5C78] mt-0.5 leading-relaxed">{f.texte}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-2.5">
          <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Toutes les fiches</h2>
          {familles.map((f, i) => (
            <details key={f.titre} open={i === 0} className="group bg-white rounded-2xl border border-indigo/[0.08] px-4">
              <summary className="flex items-center justify-between min-h-[52px] cursor-pointer list-none">
                <span className="text-[0.9375rem] font-bold text-indigo">{f.titre}</span>
                <span className="text-xs text-[#5E5C78]">{f.fiches.length} fiche{f.fiches.length > 1 ? 's' : ''}
                  <span aria-hidden className="inline-block ml-1.5 transition-transform group-open:rotate-180">⌄</span></span>
              </summary>
              <ul className="pb-2">
                {f.fiches.map((x) => (
                  <li key={x.slug}>
                    <Link href={`/app/bibliotheque/${x.slug}${suite}`} className="flex items-center min-h-10 border-t border-indigo/[0.06] text-[0.84rem] text-indigo">
                      {x.titre}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
