import type { ReactNode } from 'react';
import TexteRiche from './TexteRiche';

// Les briques de texte des fiches : une partie titrée, des puces, des lignes clé-valeur, un tableau. Le texte vient du
// moteur (cts_contenu), tel quel ; la forme est celle du reste de l'app (retour du coach du 20/10/2026 : « la fiche est
// restée dans un ancien format ») : une carte aux coins arrondis, son titre en surtitre.

export function Partie({ titre, children, id }: { titre: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="bg-white rounded-2xl border border-indigo/[0.08] p-[18px] space-y-3 scroll-mt-20">
      <h2 className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">{titre}</h2>
      <div className="space-y-3 text-[0.875rem] text-[#4A4866] leading-relaxed">{children}</div>
    </section>
  );
}

export function Puces({ puces }: { puces: string[] }) {
  return (
    <ul className="space-y-2">
      {puces.map((p, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.55em] w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
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
    <dl>
      {lignes.map(([cle, valeur]) => (
        <div key={cle} className="grid grid-cols-[minmax(7rem,40%)_1fr] gap-x-3 py-2.5 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem]">
          <dt className="font-semibold text-[#5E5C78]">{cle}</dt>
          <dd className="text-indigo">{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

// Un tableau du plan (première ligne : les en-têtes), qui défile à l'horizontale s'il le faut.
export function Tableau({ lignes }: { lignes: string[][] }) {
  const [entetes, ...corps] = lignes;
  return (
    <div className="overflow-x-auto -mx-[18px] px-[18px]">
      <table className="min-w-full text-[0.78rem]">
        <thead>
          <tr className="border-b border-indigo/10">
            {entetes.map((e) => (
              <th key={e} className="text-left font-bold text-[0.65rem] tracking-[0.08em] uppercase text-[#5E5C78] px-2 first:pl-0 py-2 whitespace-nowrap">{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {corps.map((ligne, i) => (
            <tr key={i} className="border-b last:border-b-0 border-indigo/[0.06]">
              {ligne.map((c, k) => (
                <td key={k} className={k === 0 ? 'pl-0 pr-2 py-2.5 align-top font-semibold text-indigo whitespace-nowrap' : 'px-2 py-2.5 align-top text-[#4A4866]'}>{c}</td>
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
