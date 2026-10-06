'use client';

import { usePathname, useRouter } from 'next/navigation';

// La démonstration (développement seulement) : choisir un plan du corpus et le jour simulé,
// pour lire l'app à n'importe quel moment de la préparation.
export default function BarreDemonstration({
  exemples, cle, jour,
}: {
  exemples: { cle: string; titre: string }[];
  cle: string;
  jour: string;
}) {
  const router = useRouter();
  const chemin = usePathname();
  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="mx-auto max-w-2xl px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="font-bold uppercase tracking-cts-tight text-amber-800">Démonstration</span>
        <select
          aria-label="Plan d’exemple"
          value={cle}
          // Un autre plan n'a pas les mêmes séances : on repart d'Aujourd'hui.
          onChange={(e) => router.replace(`/app?plan=${e.target.value}`)}
          className="bg-white border border-amber-300 px-1.5 py-1 text-indigo max-w-[14rem]"
        >
          {exemples.map((x) => (
            <option key={x.cle} value={x.cle}>
              {x.titre}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-amber-900">
          Jour simulé
          <input
            type="date"
            value={jour}
            onChange={(e) => e.target.value && router.replace(`${chemin}?plan=${cle}&jour=${e.target.value}`)}
            className="bg-white border border-amber-300 px-1.5 py-0.5 text-indigo"
          />
        </label>
      </div>
    </div>
  );
}
