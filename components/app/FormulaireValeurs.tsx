'use client';

import { useActionState } from 'react';
import { enregistrerValeurs, type EtatCoach } from '@/lib/app/actionsCoaching';

// Les valeurs d'un athlète coaché (CTS_NOLIO_CADRAGE.md, N8) : chacune facultative ; un champ vide l'efface. L'allure
// au seuil 1 (le palier du test de la parole) recoupe le seuil 1 avec la VC : l'allure du seuil 1 se décale (8.320).
export default function FormulaireValeurs({
  athleteId, fc1, vs1Allure, vcAllure, fc2,
}: { athleteId: string; fc1: number | null; vs1Allure: string | null; vcAllure: string | null; fc2: number | null }) {
  const [etat, action, enCours] = useActionState<EtatCoach, FormData>(enregistrerValeurs.bind(null, athleteId), null);
  const champ = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white';
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block text-xs font-semibold text-indigo">FC au seuil 1
          <input name="fc_seuil1" inputMode="numeric" defaultValue={fc1 ?? ''} placeholder="bpm" className={champ} />
        </label>
        <label className="block text-xs font-semibold text-indigo">Allure au seuil 1
          <input name="vs1_allure" defaultValue={vs1Allure ?? ''} placeholder="min/km : 6:00" className={champ} />
        </label>
        <label className="block text-xs font-semibold text-indigo">Vitesse critique
          <input name="vc_allure" defaultValue={vcAllure ?? ''} placeholder="min/km : 4:10" className={champ} />
        </label>
        <label className="block text-xs font-semibold text-indigo">FC au seuil 2
          <input name="fc_seuil2" inputMode="numeric" defaultValue={fc2 ?? ''} placeholder="bpm" className={champ} />
        </label>
      </div>
      <button type="submit" disabled={enCours} className="min-h-11 px-4 rounded-[10px] bg-teal text-white text-sm font-bold disabled:opacity-50">Enregistrer</button>
      {etat?.message && <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>}
    </form>
  );
}
