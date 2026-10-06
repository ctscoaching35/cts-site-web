import type { ReactNode } from 'react';
import TexteRiche from './TexteRiche';

// Les briques de texte de « Mon plan » : une partie titrée, des puces, des lignes clé-valeur.
// Le texte vient du moteur (cts_contenu), tel quel.

export function Partie({ titre, children, id }: { titre: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="bg-white shadow-sm p-4 sm:p-5 scroll-mt-4">
      <h2 className="text-lg text-indigo leading-snug mb-3">{titre}</h2>
      <div className="space-y-3 text-[0.95rem] text-indigo/85 leading-relaxed">{children}</div>
    </section>
  );
}

export function Puces({ puces }: { puces: string[] }) {
  return (
    <ul className="space-y-2">
      {puces.map((p, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="text-teal font-bold">•</span>
          <span>
            <TexteRiche texte={p} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Lignes({ lignes }: { lignes: [string, string][] }) {
  return (
    <dl className="divide-y divide-indigo/10">
      {lignes.map(([cle, valeur]) => (
        <div key={cle} className="grid grid-cols-[minmax(7rem,40%)_1fr] gap-3 py-2">
          <dt className="font-bold text-indigo text-sm">{cle}</dt>
          <dd className="text-sm">{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

// Un tableau du plan (première ligne : les en-têtes), qui défile à l'horizontale s'il le faut.
export function Tableau({ lignes }: { lignes: string[][] }) {
  const [entetes, ...corps] = lignes;
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="min-w-full text-xs sm:text-sm">
        <thead>
          <tr className="bg-indigo text-white">
            {entetes.map((e) => (
              <th key={e} className="text-left font-bold px-2 py-2 whitespace-nowrap">{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {corps.map((ligne, i) => (
            <tr key={i} className={i % 2 ? 'bg-sand' : 'bg-white'}>
              {ligne.map((c, k) => (
                <td key={k} className="px-2 py-2 align-top">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Avertissement({ avertissement }: { avertissement: { surtitre: string; paragraphes: string[] } }) {
  return (
    <aside className="border-t-2 border-teal pt-4 text-center text-sm text-indigo/70 leading-relaxed space-y-2 px-2">
      <div className="text-[0.65rem] font-bold tracking-cts text-teal">{avertissement.surtitre}</div>
      {avertissement.paragraphes.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </aside>
  );
}
