'use client';

import { useActionState } from 'react';
import { envoyer, mettreAJour, type EtatCoach } from '@/lib/app/actionsCoaching';

// « Envoyer dans Nolio » pour une semaine, puis « Mettre à jour dans Nolio » une fois envoyée (CTS_NOLIO_CADRAGE.md,
// N1, V4) ; le résultat s'affiche dessous.
export default function EnvoiSemaine({ planId, numero, actif, envoyee = false }: { planId: string; numero: string; actif: boolean; envoyee?: boolean }) {
  const geste = envoyee ? mettreAJour : envoyer;
  const [etat, action, enCours] = useActionState<EtatCoach, FormData>(geste.bind(null, planId, numero), null);
  const libelle = envoyee ? (enCours ? 'Mise à jour…' : 'Mettre à jour dans Nolio') : (enCours ? 'Envoi…' : 'Envoyer dans Nolio');
  return (
    <form action={action} className="space-y-1">
      <button type="submit" disabled={!actif || enCours}
        className={envoyee ? 'text-sm font-semibold text-teal underline underline-offset-2 disabled:opacity-40' : 'btn btn-primary !py-2 !px-4 disabled:opacity-40'}>
        {libelle}
      </button>
      {etat?.message && <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>}
    </form>
  );
}
