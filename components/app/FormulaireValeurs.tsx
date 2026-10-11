'use client';

import { useActionState } from 'react';
import { enregistrerValeurs, type EtatCoach } from '@/lib/app/actionsCoaching';

// Les valeurs d'un athlète coaché (CTS_NOLIO_CADRAGE.md, N8) : chacune facultative ; un champ vide l'efface.
export default function FormulaireValeurs({
  athleteId, fc1, vcKmh, fc2,
}: { athleteId: string; fc1: number | null; vcKmh: string | null; fc2: number | null }) {
  const [etat, action, enCours] = useActionState<EtatCoach, FormData>(enregistrerValeurs.bind(null, athleteId), null);
  const champ = 'w-full border border-indigo/20 px-2 py-2 text-sm text-indigo bg-white';
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-indigo/70">FC au seuil 1
          <input name="fc_seuil1" inputMode="numeric" defaultValue={fc1 ?? ''} placeholder="bpm" className={champ} />
        </label>
        <label className="text-xs text-indigo/70">Vitesse critique
          <input name="vc_kmh" inputMode="decimal" defaultValue={vcKmh ?? ''} placeholder="km/h" className={champ} />
        </label>
        <label className="text-xs text-indigo/70">FC au seuil 2
          <input name="fc_seuil2" inputMode="numeric" defaultValue={fc2 ?? ''} placeholder="bpm" className={champ} />
        </label>
      </div>
      <button type="submit" disabled={enCours} className="text-sm font-semibold text-teal disabled:opacity-50">Enregistrer</button>
      {etat?.message && <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>}
    </form>
  );
}
