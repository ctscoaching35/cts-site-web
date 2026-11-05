'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// La démonstration (développement seulement, lib/app/demonstration.ts) : le plan fictif, le jour simulé, et les états à
// parcourir pour les deux versions (Préparation CTS, Coaching individualisé), chacun par son adresse ; l'état affiché
// est souligné. Sous la barre, ce que le moteur a changé dans la semaine montrée (ses notes Nolio), quand il l'a ajustée.
export type GroupeDemo = { titre: string; etats: { titre: string; href: string }[] };

// Deux adresses désignent le même état : même page, mêmes paramètres, dans n'importe quel ordre.
const memeEtat = (href: string, chemin: string, params: URLSearchParams) => {
  const [c, q = ''] = href.split('?');
  if (c !== chemin) return false;
  const a = new URLSearchParams(q);
  const cles = new Set([...a.keys(), ...params.keys()]);
  return [...cles].every((k) => a.get(k) === params.get(k));
};

export default function BarreDemonstration({
  exemples, cle, jour, sansObjectif, groupes, notes,
}: {
  exemples: { cle: string; titre: string }[];
  cle: string;
  jour: string;
  sansObjectif: boolean;
  groupes: GroupeDemo[];
  notes: { numero: string; notes: string[] } | null;
}) {
  const router = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const courant = groupes.flatMap((g) => g.etats).find((e) => memeEtat(e.href, chemin, params));
  // Le jour change, le reste de l'état reste.
  const versLeJour = (j: string) => {
    const p = new URLSearchParams(params.toString());
    p.set('jour', j);
    router.replace(`${chemin}?${p.toString()}`);
  };
  // Un autre plan n'a pas les mêmes dates : on repart de son accueil, dans la même version.
  const versLePlan = (c: string) => {
    const p = new URLSearchParams({ plan: c });
    for (const k of ['coache', 'main']) if (params.get(k)) p.set(k, params.get(k) as string);
    router.replace(`/app?${p.toString()}`);
  };
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-xs">
      <div className="mx-auto max-w-2xl px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-bold uppercase tracking-cts-tight text-amber-800">Démonstration</span>
        {!sansObjectif && (
          <select aria-label="Plan d’exemple" value={cle} onChange={(e) => versLePlan(e.target.value)}
            className="bg-white border border-amber-300 px-1.5 py-1 text-indigo max-w-[14rem]">
            {exemples.map((x) => <option key={x.cle} value={x.cle}>{x.titre}</option>)}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-amber-900">
          Jour simulé
          <input type="date" value={jour} onChange={(e) => e.target.value && versLeJour(e.target.value)}
            className="bg-white border border-amber-300 px-1.5 py-0.5 text-indigo" />
        </label>
      </div>
      <details className="mx-auto max-w-2xl px-4 pb-2 group">
        <summary className="cursor-pointer list-none min-h-8 flex items-center gap-1.5 font-bold text-amber-900">
          <span aria-hidden className="inline-block group-open:rotate-90">›</span>
          <span className="min-w-0 truncate">États à parcourir{courant ? ` · ${courant.titre}` : ''}</span>
        </summary>
        <div className="pt-1 pb-1 space-y-2.5">
          {groupes.map((g) => (
            <div key={g.titre}>
              <p className="font-bold uppercase tracking-[0.06em] text-[0.65rem] text-amber-800">{g.titre}</p>
              <ul className="mt-0.5">
                {g.etats.map((e) => (
                  <li key={e.href}>
                    <Link href={e.href} className={clsx('block py-1 leading-snug underline-offset-2',
                      e === courant ? 'font-bold text-indigo' : 'text-amber-950 underline')}>
                      {e === courant ? '● ' : ''}{e.titre}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-amber-900/80 leading-relaxed">
            Rien ne s’enregistre, rien ne part dans Nolio, aucun cookie n’est posé. Les paramètres d’adresse sont décrits dans
            lib/app/demonstrationPorte.ts. <a href="/app?reinitialiser=1" className="underline">Effacer les cookies de l’ancienne démonstration</a>.
          </p>
        </div>
      </details>
      {notes && (
        <details className="mx-auto max-w-2xl px-4 pb-2">
          <summary className="cursor-pointer list-none min-h-8 flex items-center font-bold text-amber-900">
            Ce qui a changé dans la semaine {notes.numero.replace('S', '')} ›
          </summary>
          <ul className="space-y-1.5 text-amber-950 leading-relaxed">
            {notes.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
