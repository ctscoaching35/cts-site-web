'use client';

import { useActionState, useState } from 'react';
import clsx from 'clsx';
import { echangerJours, type EtatEchange } from '@/lib/app/actionsDeplacement';
import { TEXTES } from '@/lib/app/deplacement';
import { PASTILLES } from '@/lib/app/charte';

export type LigneChoix = {
  id: string; date: string; seance: string; repos: boolean; actuel: boolean; prevuIci: boolean;
  blocage: string | null; raisons: string[];
};

// Le rouge de la charte, celui de la pastille « Cible » (E3, décision coach du 08/10/2026).
const [FOND_ROUGE, ENCRE_ROUGE] = PASTILLES.Cible;

// Les sept jours de la semaine pour « Changer de jour » (E3, E4) : un toucher sur un jour, puis
// « Échanger ». Un jour moins propice est en rouge avec sa raison, et reste possible.
export default function ChoixJour({
  planId, jourId, lignes, demonstration, suite, jourSimule,
}: {
  planId: string; jourId: string; lignes: LigneChoix[]; demonstration: boolean; suite: string; jourSimule: string | null;
}) {
  const [etat, action, enCours] = useActionState<EtatEchange, FormData>(echangerJours.bind(null, planId, jourId), null);
  const [choisi, setChoisi] = useState<string | null>(null);
  return (
    <form action={action} className="space-y-4">
      {/* Le choix vit dans l'état et part par un champ caché (comme le retour de séance). */}
      <input type="hidden" name="avec" value={choisi ?? ''} />
      <input type="hidden" name="suite" value={suite} />
      {jourSimule && <input type="hidden" name="jour" value={jourSimule} />}
      <ul className="bg-white divide-y divide-indigo/10 shadow-sm" role="radiogroup">
        {lignes.map((l) => {
          const libre = !l.actuel && !l.blocage;
          const rouge = libre && l.raisons.length > 0;
          return (
            <li key={l.id}>
              <button
                type="button" role="radio" aria-checked={choisi === l.id} disabled={!libre}
                onClick={() => setChoisi(l.id)}
                className={clsx(
                  'w-full text-left flex items-start gap-3 px-3 py-3',
                  l.actuel && 'bg-sand/70',
                  l.blocage && 'opacity-45',
                  choisi === l.id && 'ring-2 ring-inset ring-indigo',
                )}
                style={rouge ? { backgroundColor: FOND_ROUGE } : undefined}
              >
                <span className="w-[4.6rem] shrink-0 text-xs text-indigo/55 pt-0.5">{l.date}</span>
                <span className="flex-1 min-w-0">
                  <span className={clsx('block leading-snug', l.repos ? 'text-indigo/50' : 'font-semibold text-indigo')}>
                    {l.seance}
                  </span>
                  {l.prevuIci && <span className="block text-xs font-semibold text-teal mt-0.5">{TEXTES.prevuIci}</span>}
                  {l.blocage && <span className="block text-xs text-indigo/70 mt-0.5">{l.blocage}</span>}
                  {rouge && l.raisons.map((r) => (
                    <span key={r} className="block text-xs font-semibold mt-0.5" style={{ color: ENCRE_ROUGE }}>
                      {TEXTES.moinsPropice}{r}
                    </span>
                  ))}
                </span>
                {libre && (
                  <span aria-hidden className={clsx('mt-0.5 w-4 h-4 shrink-0 rounded-full border-2',
                    choisi === l.id ? 'border-indigo bg-indigo' : 'border-indigo/30')} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {demonstration ? (
        <p className="text-sm text-indigo/60">Démonstration : l’échange s’enregistre avec les comptes.</p>
      ) : (
        <button type="submit" disabled={!choisi || enCours} className="btn btn-primary !py-2.5 disabled:opacity-40">
          {TEXTES.echanger}
        </button>
      )}
      {etat?.message && <p className="text-sm font-semibold text-indigo" role="alert">{etat.message}</p>}
    </form>
  );
}
