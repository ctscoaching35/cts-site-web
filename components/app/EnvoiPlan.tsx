'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { envoyerUneSemaine } from '@/lib/app/actionsCoaching';

// « Envoyer tout le plan » (demande du coach du 13/10/2026) : les semaines restantes, de la semaine en cours à la course,
// envoyées une à une ; la progression s'affiche, le premier refus arrête tout et se dit. Les semaines déjà envoyées
// gardent « Mettre à jour ».
export default function EnvoiPlan({ planId, semaines, actif }: { planId: string; semaines: string[]; actif: boolean }) {
  const router = useRouter();
  const [etat, setEtat] = useState<{ message: string; ok: boolean } | null>(null);
  const [enCours, setEnCours] = useState(false);
  if (semaines.length === 0) return null;
  async function toutEnvoyer() {
    setEnCours(true);
    for (const [i, numero] of semaines.entries()) {
      setEtat({ ok: true, message: `Envoi de la semaine ${i + 1} sur ${semaines.length}…` });
      const r = await envoyerUneSemaine(planId, numero);
      if (!r?.ok) {
        setEtat({ ok: false, message: `Arrêté à la semaine ${numero.replace('S', '')} : ${r?.message ?? 'l’envoi n’a pas abouti.'}` });
        setEnCours(false);
        router.refresh();
        return;
      }
    }
    setEtat({ ok: true, message: `${semaines.length} semaine${semaines.length > 1 ? 's' : ''} envoyée${semaines.length > 1 ? 's' : ''} dans Nolio.` });
    setEnCours(false);
    router.refresh();
  }
  return (
    <div className="bg-white shadow-sm p-4 space-y-2">
      <button type="button" onClick={toutEnvoyer} disabled={!actif || enCours} className="btn btn-primary !py-2.5 disabled:opacity-40">
        {enCours ? 'Envoi en cours…' : `Envoyer tout le plan (${semaines.length} semaine${semaines.length > 1 ? 's' : ''})`}
      </button>
      <p className="text-xs text-indigo/60">De la semaine en cours à la course ; les semaines déjà envoyées ne bougent pas.</p>
      {etat && <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>}
    </div>
  );
}
