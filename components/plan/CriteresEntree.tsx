'use client';

import clsx from 'clsx';
import type { Champs } from '@/lib/plan';
import { CRITERES, REPONSES_CRITERE } from '@/lib/criteres';

// Les deux questions des critères du questionnaire d'entrée (doctrine du 21/11/2026), à la place de la case « niveau ».
// PRÉPARÉ, PAS BRANCHÉ : le questionnaire ne l'affiche que si CRITERES_BRANCHES est vrai (lib/criteres.ts), le jour où le
// nouveau moteur est en ligne. Trois réponses par question, une seule possible, obligatoire ; aucune porte : le moteur
// s'adapte, rien ne se refuse ici.
export default function CriteresEntree({ c, maj }: { c: Champs; maj: (champ: keyof Champs) => (v: string) => void }) {
  return (
    <div className="space-y-6">
      {CRITERES.map((q) => (
        <fieldset key={q.champ}>
          <legend className="font-bold text-indigo mb-3">{q.question}</legend>
          <div className="grid sm:grid-cols-3 gap-3">
            {REPONSES_CRITERE.map((r) => (
              <label key={r.valeur} className={clsx('flex gap-3 items-start p-4 rounded-xl border cursor-pointer transition-colors',
                c[q.champ] === r.valeur ? 'border-teal bg-teal/5' : 'border-indigo/15 hover:border-indigo/40')}>
                <input type="radio" name={q.champ} value={r.valeur} checked={c[q.champ] === r.valeur} required
                  onChange={() => maj(q.champ)(r.valeur)} className="mt-1 accent-teal" />
                <span>
                  <span className="block font-bold text-indigo">{r.titre}</span>
                  {r.precision && <span className="block text-[0.8125rem] text-[#5E5C78] leading-relaxed mt-1">{r.precision}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
