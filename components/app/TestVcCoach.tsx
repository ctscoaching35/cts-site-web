'use client';

import { useActionState } from 'react';
import { enregistrerTestVc, type EtatCoach } from '@/lib/app/actionsCoaching';

// Le test de vitesse critique d'un coaché, saisi par son coach (décision coach du 19/10/2026) : la date du test et ses
// deux efforts, durée et distance ; le même calcul que dans l'app.
export default function TestVcCoach({ athleteId, aujourdhui }: { athleteId: string; aujourdhui: string }) {
  const [etat, action, enCours] = useActionState<EtatCoach, FormData>(enregistrerTestVc.bind(null, athleteId), null);
  const champ = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white';
  return (
    <form action={action} className="space-y-3">
      <label className="block text-xs font-semibold text-indigo">Date du test
        <input name="le" type="date" defaultValue={aujourdhui} max={aujourdhui} className={champ} required />
      </label>
      {[1, 2].map((i) => (
        <fieldset key={i} className="grid grid-cols-2 gap-2.5">
          <legend className="col-span-2 text-xs font-bold text-indigo">{i === 1 ? 'Effort long (12 min)' : 'Effort court (3 min)'}</legend>
          <label className="block text-xs font-semibold text-indigo">Durée
            <input name={`duree${i}`} required placeholder={i === 1 ? '12 ou 12:00' : '3 ou 3:00'} className={champ} />
          </label>
          <label className="block text-xs font-semibold text-indigo">Distance
            <input name={`distance${i}`} required inputMode="decimal" placeholder={i === 1 ? '3150 m ou 3,15' : '1000 m ou 1'} className={champ} />
          </label>
        </fieldset>
      ))}
      <p className="text-[0.72rem] text-[#5E5C78] leading-relaxed">
        D’autres durées marchent aussi, de 2 à 15 minutes, au moins 5 minutes d’écart entre les deux.
      </p>
      <button type="submit" disabled={enCours} className="min-h-11 px-4 rounded-[10px] bg-teal text-white text-sm font-bold disabled:opacity-50">
        {enCours ? 'Calcul…' : 'Enregistrer le test'}
      </button>
      {etat?.message && <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>}
    </form>
  );
}
