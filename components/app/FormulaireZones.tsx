'use client';

import { useActionState, useState } from 'react';
import { effacerZones, enregistrerFcSeuil2, enregistrerParole, enregistrerVitesseCritique, type EtatZones } from '@/lib/app/actionsZones';
import type { CleTest } from '@/lib/app/plan';
import { BOUTON, BOUTON_DANGER, CHAMP } from './Ui';

// Q4 (décision coach du 05/11/2026 au soir, « A ») : au style de l'app (champs arrondis, libellés sans capitales, le
// bouton vert arrondi) ; avant, celui du site.
const etiquette = 'block text-xs font-semibold text-indigo mb-1.5';

const ACTIONS = { parole: enregistrerParole, vitesse_critique: enregistrerVitesseCritique, fc_seuil2: enregistrerFcSeuil2 };

// La saisie d'un test de « Tes tests » (cadrage §7.1) : la case de consentement tant qu'il n'a pas été donné pour ce
// plan (Z2), la FC ou les deux efforts de la vitesse critique (Z4). En démonstration, le formulaire se montre ; rien ne
// s'enregistre.
export default function FormulaireZones({
  cle, planId, consentement, consentementDonne, valeurActuelle, allureActuelle, demonstration,
}: {
  cle: CleTest; planId: string; consentement: string; consentementDonne: boolean; valeurActuelle: string | null;
  // L'allure du palier du test de la parole déjà enregistrée, [minutes, secondes] (moteur 8.320).
  allureActuelle?: [string, string] | null;
  demonstration: boolean;
}) {
  const [etat, action, enCours] = useActionState<EtatZones, FormData>(ACTIONS[cle].bind(null, planId), null);
  const [demo, setDemo] = useState<string | null>(null);
  const message = demo ?? etat?.message ?? null;
  return (
    <form action={action} onSubmit={demonstration ? (e) => { e.preventDefault(); setDemo('Démonstration : rien ne s’enregistre.'); } : undefined}
      className="space-y-3">
      {cle === 'vitesse_critique' ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <fieldset key={i} className="space-y-2 min-w-0">
              <legend className="text-sm font-bold text-indigo mb-1">{i === 1 ? 'Effort long' : 'Effort court'}</legend>
              <label className="block">
                <span className={etiquette}>Durée</span>
                <input name={`duree${i}`} defaultValue={i === 1 ? '12:00' : '3:00'} inputMode="numeric" className={CHAMP} />
              </label>
              <label className="block">
                <span className={etiquette}>Distance (m)</span>
                <input name={`distance${i}`} inputMode="decimal" placeholder={i === 1 ? '3150' : '950'} className={CHAMP} />
              </label>
            </fieldset>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <label className="block w-32">
            <span className={etiquette}>Ta FC (bpm)</span>
            <input name="fc" inputMode="numeric" defaultValue={valeurActuelle ?? ''} placeholder="152" className={CHAMP} />
          </label>
          {cle === 'parole' && (
            // L'allure du palier, comme le calculateur : elle recoupe le seuil 1 avec la vitesse critique.
            <fieldset className="block">
              <legend className={etiquette}>Allure de ce palier (min : s par km)</legend>
              <div className="flex items-center gap-1.5">
                <input name="allure_min" inputMode="numeric" defaultValue={allureActuelle?.[0] ?? ''} placeholder="6" aria-label="Minutes" className={`${CHAMP} !w-16 text-center`} />
                <span className="text-indigo font-bold">:</span>
                <input name="allure_sec" inputMode="numeric" defaultValue={allureActuelle?.[1] ?? ''} placeholder="00" aria-label="Secondes" className={`${CHAMP} !w-16 text-center`} />
              </div>
            </fieldset>
          )}
        </div>
      )}
      {!consentementDonne && (
        <label className="flex gap-2.5 items-start text-sm text-[#4A4866] cursor-pointer">
          <input type="checkbox" name="consentement" className="mt-1 w-4 h-4 accent-teal" />
          <span>{consentement}</span>
        </label>
      )}
      <button type="submit" disabled={enCours} className={BOUTON}>
        {valeurActuelle ? 'Mettre à jour' : 'Enregistrer'}
      </button>
      {message && (
        <p role="status" className={etat?.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'}>{message}</p>
      )}
    </form>
  );
}

// Effacer ses repères (C1 et C30, audits du 05/11/2026) : un vrai bouton de 44 px, et une confirmation avant.
export function EffacerReperes({ planId, libelle }: { planId: string; libelle: string }) {
  return (
    <details className="bg-white rounded-2xl border border-indigo/[0.08] px-[18px]">
      <summary className="cursor-pointer list-none flex items-center min-h-12 text-sm font-bold text-[#9A3B2C]">{libelle}</summary>
      <form action={effacerZones.bind(null, planId)} className="pb-4 space-y-2">
        {/* BROUILLON, à valider par le coach. */}
        <p className="text-sm text-[#4A4866] leading-relaxed">Tes valeurs s’effacent : tes séances se règlent de nouveau sur ton effort ressenti.</p>
        <button type="submit" className={BOUTON_DANGER}>Confirmer</button>
      </form>
    </details>
  );
}
