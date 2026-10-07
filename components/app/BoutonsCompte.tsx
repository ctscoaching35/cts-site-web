'use client';

import { oublierCeQueLAppareilAGarde } from './HorsReseau';
import { seDeconnecter, supprimerCompte } from '@/lib/app/actionsCompte';

// Les boutons du compte : avant de partir, l'appareil oublie ce qu'il a gardé hors réseau.
export function Deconnexion() {
  return (
    <form
      action={async () => {
        await oublierCeQueLAppareilAGarde();
        await seDeconnecter();
      }}
    >
      <button type="submit" className="w-full bg-white shadow-sm p-4 text-left font-semibold text-indigo">
        Me déconnecter
      </button>
    </form>
  );
}

export function Suppression() {
  return (
    <form
      action={async (formulaire: FormData) => {
        await oublierCeQueLAppareilAGarde();
        await supprimerCompte(formulaire);
      }}
      className="bg-white shadow-sm p-4 space-y-3"
    >
      <h2 className="font-bold text-indigo">Supprimer mon compte</h2>
      <p className="text-sm text-indigo/70">Ton compte, tes plans et leurs PDF sont effacés, sans retour possible.</p>
      <label className="flex items-center gap-2 text-sm text-indigo">
        <input type="checkbox" name="confirmation" value="oui" required className="accent-[#9A3B2C]" />
        Je veux supprimer mon compte
      </label>
      <button type="submit" className="text-sm font-bold text-[#9A3B2C]">Supprimer définitivement</button>
    </form>
  );
}
