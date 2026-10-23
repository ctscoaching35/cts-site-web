'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { basculerEnCoaching, basculerEnPlan, type EtatMode } from '@/lib/app/actionsCoaching';

// Le mode de l'athlète, coaching ou plan (décision coach du 23/10/2026, « le vérifier avec un bouton ») : chaque passage
// dit ce qu'il fait, puis se confirme.
function Message({ etat, versLaFiche }: { etat: EtatMode; versLaFiche?: boolean }) {
  if (!etat?.message) return null;
  return (
    <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">
      {etat.message}
      {etat.ok && versLaFiche && etat.athleteId && <> <Link href={`/app/coach/athlete/${etat.athleteId}`} className="underline">Sa fiche ›</Link></>}
    </p>
  );
}

const bouton = 'min-h-11 px-4 rounded-[10px] border border-indigo/25 bg-white text-indigo text-sm font-bold disabled:opacity-50';

export function PasserEnCoaching({ planId, athleteId, nom }: { planId?: string; athleteId?: string; nom: string }) {
  const [etat, action, enCours] = useActionState<EtatMode, FormData>(
    basculerEnCoaching.bind(null, planId ? { planId } : { athleteId: athleteId as string }), null);
  if (etat?.ok) return <Message etat={etat} versLaFiche={Boolean(planId)} />;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer inline-flex items-center min-h-11 font-semibold text-teal underline underline-offset-2">Passer en coaching</summary>
      <form action={action} className="mt-1 space-y-2">
        <p className="text-[#4A4866] leading-relaxed">
          {nom} passe en mode coaching : sa fiche se crée ou reprend, reliée à Nolio et à son compte de l’app ; sa sortie
          programmée de l’équipe est annulée ; son plan acheté cesse de s’écrire après cette semaine et reste lisible dans
          son app. Tu crées ensuite son objectif de coaching.
        </p>
        <button type="submit" disabled={enCours} className={bouton}>{enCours ? 'Passage…' : `Passer ${nom} en coaching`}</button>
        <Message etat={etat} />
      </form>
    </details>
  );
}

export function PasserEnPlan({ athleteId, nom }: { athleteId: string; nom: string }) {
  const [etat, action, enCours] = useActionState<EtatMode, FormData>(basculerEnPlan.bind(null, athleteId), null);
  if (etat?.ok) return <Message etat={etat} />;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer inline-flex items-center min-h-11 font-semibold text-[#5E5C78] underline underline-offset-2">Passer en plan</summary>
      <form action={action} className="mt-1 space-y-2">
        <p className="text-[#4A4866] leading-relaxed">
          {nom} passe en mode plan : après cette semaine, ses objectifs de coaching ne s’écrivent plus et quittent Nolio, ses
          questionnaires du dimanche aussi ; sa fiche reste pour l’historique ; son app devient celle d’un acheteur. Un plan
          qu’il a acheté démarre lundi.
        </p>
        <button type="submit" disabled={enCours} className={bouton}>{enCours ? 'Passage…' : `Passer ${nom} en plan`}</button>
        <Message etat={etat} />
      </form>
    </details>
  );
}
