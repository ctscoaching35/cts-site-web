'use client';

import { useActionState } from 'react';
import { enregistrerFcSeuil2, enregistrerParole, enregistrerVitesseCritique, type EtatZones } from '@/lib/app/actionsZones';
import type { CleTest } from '@/lib/app/plan';

const champ = 'w-full bg-white border border-indigo/20 focus:border-teal px-3 py-2.5 text-indigo outline-none';
const etiquette = 'block text-xs font-semibold tracking-cts uppercase text-indigo/60 mb-1.5';

const ACTIONS = { parole: enregistrerParole, vitesse_critique: enregistrerVitesseCritique, fc_seuil2: enregistrerFcSeuil2 };

// La saisie d'un test de « Tes zones » (cadrage §7.1) : la case de consentement tant qu'il n'a pas été
// donné pour ce plan (Z2), la FC ou les deux efforts de la vitesse critique (Z4).
export default function FormulaireZones({
  cle, planId, consentement, consentementDonne, valeurActuelle, demonstration,
}: {
  cle: CleTest; planId: string; consentement: string; consentementDonne: boolean; valeurActuelle: string | null;
  demonstration: boolean;
}) {
  const [etat, action, enCours] = useActionState<EtatZones, FormData>(ACTIONS[cle].bind(null, planId), null);
  if (demonstration)
    return <p className="text-sm text-indigo/60">Démonstration : la saisie s’enregistre avec les comptes.</p>;
  return (
    <form action={action} className="space-y-3">
      {cle === 'vitesse_critique' ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <fieldset key={i} className="space-y-2">
              <legend className="text-sm font-bold text-indigo mb-1">{i === 1 ? 'Effort long' : 'Effort court'}</legend>
              <label className="block">
                <span className={etiquette}>Durée</span>
                <input name={`duree${i}`} defaultValue={i === 1 ? '12:00' : '3:00'} inputMode="numeric" className={champ} />
              </label>
              <label className="block">
                <span className={etiquette}>Distance (m)</span>
                <input name={`distance${i}`} inputMode="decimal" placeholder={i === 1 ? '3150' : '950'} className={champ} />
              </label>
            </fieldset>
          ))}
        </div>
      ) : (
        <label className="block max-w-[12rem]">
          <span className={etiquette}>Ta FC (bpm)</span>
          <input name="fc" inputMode="numeric" defaultValue={valeurActuelle ?? ''} placeholder="152" className={champ} />
        </label>
      )}
      {!consentementDonne && (
        <label className="flex gap-2.5 items-start text-sm text-indigo/80 cursor-pointer">
          <input type="checkbox" name="consentement" className="mt-0.5 accent-teal" />
          <span>{consentement}</span>
        </label>
      )}
      <button type="submit" disabled={enCours} className="btn btn-primary !py-2.5 disabled:opacity-60">
        {valeurActuelle ? 'Mettre à jour' : 'Enregistrer'}
      </button>
      {etat && (
        <p role="status" className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-red-700'}>{etat.message}</p>
      )}
    </form>
  );
}
