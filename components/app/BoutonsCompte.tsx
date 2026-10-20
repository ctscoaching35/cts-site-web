'use client';

import { oublierCeQueLAppareilAGarde } from './HorsReseau';
import { seDeconnecter, supprimerCompte } from '@/lib/app/actionsCompte';

// Les boutons du compte : avant de partir, l'appareil oublie ce qu'il a gardé hors réseau. menu : le lien discret du
// menu de l'espace coach, pour changer de compte (décision coach du 20/10/2026 : chaque version par son compte).
export function Deconnexion({ menu = false }: { menu?: boolean }) {
  return (
    <form
      action={async () => {
        await oublierCeQueLAppareilAGarde();
        await seDeconnecter();
      }}
    >
      <button type="submit" className={menu
        ? 'inline-flex items-center min-h-11 px-3 text-xs font-bold text-[#8FD1C3]'
        : 'w-full min-h-12 rounded-xl bg-white border border-indigo/20 text-sm font-bold text-indigo'}>
        {menu ? 'Me déconnecter ›' : 'Me déconnecter'}
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
      className="bg-white rounded-2xl border border-indigo/[0.08] p-[18px] space-y-3"
    >
      <h2 className="font-bold text-indigo">Supprimer mon compte</h2>
      <p className="text-sm text-indigo/70">Ton compte et tout ce qu’il contient sont effacés, sans retour possible.</p>
      <label className="flex items-center gap-2 text-sm text-indigo">
        <input type="checkbox" name="confirmation" value="oui" required className="accent-[#9A3B2C]" />
        Je veux supprimer mon compte
      </label>
      <button type="submit" className="text-sm font-bold text-[#9A3B2C]">Supprimer définitivement</button>
    </form>
  );
}
