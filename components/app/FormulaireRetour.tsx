'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { enregistrerRetour, type EtatRetour } from '@/lib/app/actionsJournal';
import { SENSATIONS, STATUTS, type Retour, type Statut } from '@/lib/app/journal';

// L'écran de retour (cadrage §7.2, textes validés par le coach le 08/10/2026) : faite, raccourcie ou pas
// faite ; le RPE ressenti, réglé sur le RPE prévu ; les sensations du jour, facultatives ; la case de
// consentement au premier retour ; un lien vers le conseil en cas de douleur, qui n'enregistre rien.
export default function FormulaireRetour({
  planId, jourId, rpePrevu, rpeAffiche, retour, journal, consentement, lienDouleur, demonstration,
}: {
  planId: string; jourId: string; rpePrevu: number; rpeAffiche: string; retour: Retour | null; journal: boolean;
  consentement: string; lienDouleur: string; demonstration: boolean;
}) {
  const [etat, action, enCours] = useActionState<EtatRetour, FormData>(enregistrerRetour.bind(null, planId, jourId), null);
  const [statut, setStatut] = useState<Statut | null>(retour?.statut ?? null);
  const [rpe, setRpe] = useState<number>(retour?.rpe ?? rpePrevu);
  const [sensations, setSensations] = useState<number | null>(retour?.sensations ?? null);
  if (demonstration) return <p className="text-sm text-indigo/60">Démonstration : le journal s’enregistre avec les comptes.</p>;
  const faite = statut === 'faite' || statut === 'raccourcie';
  return (
    <form action={action} className="space-y-4">
      <p className="font-bold text-indigo">Comment s’est passée ta séance ?</p>
      {/* Les choix vivent dans l'état et partent par des champs cachés : après un envoi refusé, React
          remet le formulaire à zéro, et un bouton radio resté vert à l'écran ne partait plus. */}
      <input type="hidden" name="statut" value={statut ?? ''} />
      <div className="grid grid-cols-3 gap-2" role="radiogroup">
        {STATUTS.map(([s, libelle]) => (
          <button key={s} type="button" role="radio" aria-checked={statut === s} onClick={() => setStatut(s)}
            className={clsx('text-center text-sm font-semibold px-2 py-2.5 border',
              statut === s ? 'bg-teal text-white border-teal' : 'bg-white text-indigo border-indigo/20')}>
            {libelle}
          </button>
        ))}
      </div>
      {faite && (
        <>
          <label className="block">
            <span className="block text-sm font-bold text-indigo">Ton effort ressenti <span className="font-normal text-indigo/60">(RPE, de 0 à 10)</span></span>
            <div className="flex items-center gap-3 mt-1.5">
              <input type="range" min={0} max={10} step={1} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="flex-1 accent-teal" aria-label="Ton effort ressenti" />
              <input type="hidden" name="rpe" value={rpe} />
              <span className="w-8 text-right text-lg font-extrabold text-indigo">{rpe}</span>
            </div>
            <span className="text-xs text-indigo/55">Prévu : RPE {rpeAffiche}</span>
          </label>
          <div>
            <span className="block text-sm font-bold text-indigo">Tes sensations du jour <span className="font-normal text-indigo/60">(facultatif)</span></span>
            <div className="grid grid-cols-5 gap-1.5 mt-1.5">
              {SENSATIONS.map((mot, i) => (
                <button key={mot} type="button" onClick={() => setSensations(sensations === i + 1 ? null : i + 1)}
                  className={clsx('text-[0.7rem] leading-tight px-1 py-2 border',
                    sensations === i + 1 ? 'bg-teal text-white border-teal' : 'bg-white text-indigo border-indigo/20')}>
                  <span className="block text-base font-bold">{i + 1}</span>{mot}
                </button>
              ))}
            </div>
            <input type="hidden" name="sensations" value={sensations ?? ''} />
          </div>
        </>
      )}
      {!journal && (
        <label className="flex gap-2.5 items-start text-sm text-indigo/80 cursor-pointer">
          <input type="checkbox" name="consentement" className="mt-0.5 accent-teal" />
          <span>{consentement}</span>
        </label>
      )}
      <button type="submit" disabled={enCours || !statut} className="btn btn-primary !py-2.5 disabled:opacity-60">Enregistrer</button>
      {etat && <p role="status" className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-red-700'}>{etat.message}</p>}
      <Link href={lienDouleur} className="block text-sm text-indigo/70 underline underline-offset-2">J’ai une douleur ›</Link>
    </form>
  );
}
