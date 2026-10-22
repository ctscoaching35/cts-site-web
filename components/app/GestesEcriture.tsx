'use client';

import { useActionState } from 'react';
import { ajouterCourse, annulerSemaine, demarrerDansNolio, donnerMonAccord, reessayerLaSemaine, retirerCourse, retirerMonAccord, type EtatGeste } from '@/lib/app/actionsEcriture';

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

// Retirer une course de préparation à venir (décision coach du 20/10/2026) : une confirmation, puis le retrait.
export function RetirerCourse({ planId, date, nom }: { planId: string; date: string; nom: string }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(retirerCourse.bind(null, planId, date), null);
  if (etat?.ok) return <Message etat={etat} />;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer inline-flex items-center min-h-11 font-semibold text-[#5E5C78] underline underline-offset-2">Retirer</summary>
      <form action={action} className="mt-1 space-y-2">
        <p className="text-[#4A4866] leading-relaxed">{nom} quitte ta préparation ; dans Nolio, sa course et le rappel de sa fiche partent.</p>
        <button type="submit" disabled={enCours} className="min-h-11 px-4 rounded-[10px] border border-indigo/25 bg-white text-indigo text-sm font-bold disabled:opacity-50">
          {enCours ? 'Retrait…' : `Retirer ${nom}`}
        </button>
        <Message etat={etat} />
      </form>
    </details>
  );
}

// initial : une course B de Nolio (lib/app/coursesNolio.ts), à relire avant d'ajouter.
export function AjouterCourse({ planId, initial }: {
  planId: string; initial?: { nom: string; date: string; distance_km: number | null; dplus_m: number | null; chrono: string | null } | null;
}) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(ajouterCourse.bind(null, planId), null);
  const champ = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white';
  return (
    <form action={action} className="space-y-3">
      <label className="block text-xs font-semibold text-indigo">Nom de la course
        <input name="nom" className={champ} maxLength={80} placeholder="Trail de…" defaultValue={initial?.nom} />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block text-xs font-semibold text-indigo">Date
          <input name="date" type="date" required className={champ} defaultValue={initial?.date} />
        </label>
        <label className="block text-xs font-semibold text-indigo">Distance (km)
          <input name="distance_km" inputMode="decimal" required className={champ} defaultValue={initial?.distance_km ?? undefined} />
        </label>
        <label className="block text-xs font-semibold text-indigo">D+ (m)
          <input name="dplus_m" inputMode="numeric" className={champ} defaultValue={initial?.dplus_m ?? undefined} />
        </label>
        <label className="block text-xs font-semibold text-indigo">Chrono visé
          <input name="chrono" required placeholder="2h15" className={champ} defaultValue={initial?.chrono ?? undefined} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-indigo">Trace GPX — facultative
        <input name="gpx" type="file" accept=".gpx" className="block text-sm font-normal text-indigo file:mr-3 file:min-h-10 file:px-3 file:rounded-[10px] file:border-0 file:bg-[#E1EFEA] file:text-teal-dark file:font-bold" />
        <span className="font-normal text-[#5E5C78]">Avec elle, sa fiche de course montre son profil et ses tronçons.</span>
      </label>
      <button type="submit" disabled={enCours}
        className="w-full min-h-12 rounded-xl bg-teal text-white text-sm font-bold disabled:opacity-50">
        {enCours ? 'Vérification…' : 'Ajouter la course'}
      </button>
      <Message etat={etat} />
    </form>
  );
}

// L'accord de lecture donné après l'achat (décision coach du 21/10/2026), avec la phrase du questionnaire d'achat.
export function DonnerAccord({ planId }: { planId: string }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(donnerMonAccord.bind(null, planId), null);
  if (etat?.ok) return <Message etat={etat} />;
  return (
    <form action={action} className="space-y-2">
      <p className="text-[0.8rem] text-[#4A4866] leading-relaxed">
        J’accepte que l’app lise dans Nolio mes séances faites, mon RPE, mon ressenti et mon Hooper, et la trace de mes
        séances test (distance, FC) pour en tirer mes repères (FC aux seuils, allures) et les garder, seulement pour ajuster
        ma préparation et afficher mes graphiques. Je peux retirer cet accord à tout moment.
      </p>
      <button type="submit" disabled={enCours} className="btn btn-primary disabled:opacity-50">
        {enCours ? 'Envoi…' : 'Donner mon accord'}
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

// La semaine en cours pas partie dans Nolio (« À regarder », décision coach du 21/10/2026) : la réécrire et l'envoyer.
export function ReessayerSemaine({ planId }: { planId: string }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(reessayerLaSemaine.bind(null, planId), null);
  if (etat?.ok) return <Message etat={etat} />;
  return (
    <form action={action} className="space-y-1">
      <button type="submit" disabled={enCours} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal disabled:opacity-50">
        {enCours ? 'Envoi…' : 'Réessayer ›'}
      </button>
      <Message etat={etat} />
    </form>
  );
}
