'use client';

import { useActionState } from 'react';
import { envoyer, type EtatCoach } from '@/lib/app/actionsCoaching';

// « Envoyer dans Nolio » pour une semaine (CTS_NOLIO_CADRAGE.md, N1, N4) ; le résultat s'affiche dessous.
export default function EnvoiSemaine({ planId, numero, actif }: { planId: string; numero: string; actif: boolean }) {
  const [etat, action, enCours] = useActionState<EtatCoach, FormData>(envoyer.bind(null, planId, numero), null);
  return (
    <form action={action} className="space-y-1">
      <button type="submit" disabled={!actif || enCours} className="btn btn-primary !py-2 !px-4 disabled:opacity-40">
        {enCours ? 'Envoi…' : 'Envoyer dans Nolio'}
      </button>
      {etat?.message && <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>}
    </form>
  );
}
