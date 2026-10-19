'use client';

import { useActionState } from 'react';
import { ajouterCourse, annulerSemaine, demarrerDansNolio, retirerMonAccord, type EtatGeste } from '@/lib/app/actionsEcriture';

// Les gestes de l'écriture semaine par semaine (lib/app/actionsEcriture.ts) : démarrer un objectif dans Nolio, annuler
// les ajustements d'une semaine, ajouter une course secondaire.
function Message({ etat }: { etat: EtatGeste }) {
  if (!etat?.message) return null;
  return <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>;
}

export function DemarrerNolio({ planId, actif }: { planId: string; actif: boolean }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(demarrerDansNolio.bind(null, planId), null);
  return (
    <form action={action} className="space-y-2">
      <button type="submit" disabled={!actif || enCours} className="btn btn-primary !py-2.5 disabled:opacity-50">
        {enCours ? 'Départ…' : 'Démarrer dans Nolio'}
      </button>
      {!actif && <p className="text-xs text-indigo/60">Associe d’abord l’athlète à Nolio, sur sa fiche.</p>}
      <Message etat={etat} />
    </form>
  );
}

export function AnnulerSemaine({ planId, numero }: { planId: string; numero: string }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(annulerSemaine.bind(null, planId, numero), null);
  return (
    <form action={action} className="space-y-1">
      <button type="submit" disabled={enCours} className="text-sm font-semibold text-teal disabled:opacity-50">
        {enCours ? 'Réécriture…' : 'Annuler les ajustements'}
      </button>
      <Message etat={etat} />
    </form>
  );
}

export function AjouterCourse({ planId }: { planId: string }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(ajouterCourse.bind(null, planId), null);
  const champ = 'w-full border border-indigo/20 px-2 py-2 text-sm text-indigo bg-white';
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs text-indigo/70">Nom de la course
          <input name="nom" className={champ} maxLength={80} />
        </label>
        <label className="text-xs text-indigo/70">Date
          <input name="date" type="date" required className={champ} />
        </label>
        <label className="text-xs text-indigo/70">Distance (km)
          <input name="distance_km" inputMode="decimal" required className={champ} />
        </label>
        <label className="text-xs text-indigo/70">D+ (m)
          <input name="dplus_m" inputMode="numeric" className={champ} />
        </label>
      </div>
      <button type="submit" disabled={enCours} className="text-sm font-semibold text-teal disabled:opacity-50">
        {enCours ? 'Vérification…' : 'Ajouter la course'}
      </button>
      <Message etat={etat} />
    </form>
  );
}

export function RetirerAccord({ planId }: { planId: string }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(retirerMonAccord.bind(null, planId), null);
  if (etat?.ok) return <Message etat={etat} />;
  return (
    <form action={action} className="space-y-1">
      <button type="submit" disabled={enCours} className="text-sm font-semibold text-red-700 underline underline-offset-2 disabled:opacity-50">
        {enCours ? 'Retrait…' : 'Retirer mon accord'}
      </button>
      <Message etat={etat} />
    </form>
  );
}
