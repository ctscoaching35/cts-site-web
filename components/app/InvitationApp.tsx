'use client';

import { useActionState } from 'react';
import { inviterDansLApp, type EtatCoach } from '@/lib/app/actionsCoaching';

// T6 : l'adresse de l'athlète et « Inviter dans l'app » (ou renvoyer le lien à la même adresse).
export default function InvitationApp({ athleteId, adresse }: { athleteId: string; adresse: string | null }) {
  const [etat, action, enCours] = useActionState<EtatCoach, FormData>(inviterDansLApp.bind(null, athleteId), null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input name="email" type="email" required defaultValue={adresse ?? ''} placeholder="son e-mail"
          className="flex-1 min-w-[12rem] border border-indigo/20 px-2 py-2 text-sm text-indigo bg-white" />
        <button type="submit" disabled={enCours} className="text-sm font-semibold text-teal disabled:opacity-50">
          {enCours ? 'Envoi…' : adresse ? 'Renvoyer le lien' : 'Inviter dans l’app'}
        </button>
      </div>
      {etat?.message && <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>}
    </form>
  );
}
