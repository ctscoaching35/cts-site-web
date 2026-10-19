'use client';

import { useActionState } from 'react';
import { enregistrerProfil, type EtatCoach } from '@/lib/app/actionsCoaching';
import { textes } from '@/lib/plan';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// PO1 : le profil d'un athlète coaché, modifié à part de ses objectifs, sur sa fiche.
export default function ProfilAthlete({ athleteId, profil }: { athleteId: string; profil: Record<string, string | string[]> }) {
  const [etat, action, enCours] = useActionState<EtatCoach, FormData>(enregistrerProfil.bind(null, athleteId), null);
  const jours = Array.isArray(profil.jours_disponibles) ? profil.jours_disponibles : [];
  const champ = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white';
  return (
    <form action={action} className="space-y-3.5">
      <label className="block text-xs font-semibold text-indigo">Niveau
        <select name="niveau" defaultValue={String(profil.niveau ?? '')} className={champ} required>
          {textes.niveau.options.map((o) => <option key={o.valeur} value={o.valeur}>{o.titre}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-indigo">Terrain d’entraînement
        <select name="terrain" defaultValue={String(profil.terrain ?? '')} className={champ} required>
          {textes.terrain.options.map((o) => <option key={o.valeur} value={o.valeur}>{o.titre} — {o.description}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="text-xs font-semibold text-indigo">Jours disponibles</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {JOURS.map((j) => (
            <label key={j} className="inline-flex items-center gap-1.5 min-h-10 px-2.5 rounded-[10px] border border-indigo/20 text-[0.8rem] text-indigo has-[:checked]:bg-teal has-[:checked]:text-white has-[:checked]:border-teal">
              <input type="checkbox" name="jours_disponibles" value={j} defaultChecked={jours.includes(j)} className="sr-only" />
              {j.charAt(0).toUpperCase() + j.slice(1, 3)}.
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block text-xs font-semibold text-indigo">Sortie longue le
          <select name="jour_sl" defaultValue={String(profil.jour_sl ?? '')} className={champ} required>
            {JOURS.map((j) => <option key={j} value={j}>{j.charAt(0).toUpperCase() + j.slice(1)}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-indigo">Séances par semaine
          <input name="freq_hebdo" type="number" min={1} max={7} defaultValue={String(profil.freq_hebdo ?? '')} className={champ} required />
        </label>
      </div>
      <button type="submit" disabled={enCours} className="min-h-11 px-4 rounded-[10px] bg-teal text-white text-sm font-bold disabled:opacity-50">
        {enCours ? 'Enregistrement…' : 'Enregistrer son profil'}
      </button>
      {etat?.message && <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>}
    </form>
  );
}
