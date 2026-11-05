'use client';

import { useActionState, useState } from 'react';
import { formatRouteDe } from '@/lib/app/route';
import { CORRECTIONS, RAISONS, type Choix } from '@/lib/app/correctionsTextes';
import { BOUTON, BOUTON_DANGER } from './Ui';
import {
  ajouterCourse, ajouterTraceObjectif, annulerCorrections, annulerSemaine, arreterPreparationRemboursee, choisirCorrections, demarrerDansNolio, donnerMonAccord, modifierCourse, reessayerLaSemaine, retirerCourse, retirerMonAccord,
  type EtatGeste,
} from '@/lib/app/actionsEcriture';

// Les gestes de l'écriture semaine par semaine (lib/app/actionsEcriture.ts) : démarrer un objectif dans Nolio, annuler
// les ajustements d'une semaine, ajouter une course secondaire.
function Message({ etat }: { etat: EtatGeste }) {
  if (!etat?.message) return null;
  return <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>;
}

// Le lundi du départ, au choix du coach (décision coach du 22/10/2026) : vide, dès que possible ; premier : le premier
// lundi possible, dernier : celui de la semaine de course ; programme : un départ déjà programmé, que le geste déplace.
export function DemarrerNolio({ planId, actif, lundi, premier, dernier, programme }: {
  planId: string; actif: boolean; lundi: string; premier: string; dernier: string; programme: boolean;
}) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(demarrerDansNolio.bind(null, planId), null);
  const champ = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white';
  return (
    <form action={action} className="space-y-2">
      <label className="block max-w-[240px] text-xs font-semibold text-indigo">Démarre le lundi
        <input name="depart" type="date" min={premier} max={dernier} step={7} defaultValue={lundi} className={champ} />
      </label>
      <p className="text-xs text-indigo/60">Vide : dès que possible. Plus tard : par exemple après un objectif que tu prépares à la main.</p>
      <button type="submit" disabled={!actif || enCours} className="btn btn-primary !py-2.5 disabled:opacity-50">
        {enCours ? 'Départ…' : programme ? 'Changer le départ' : 'Démarrer dans Nolio'}
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
    <details className="text-xs min-w-0 open:basis-full">
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

// Modifier une course de préparation à venir (décision coach du 23/10/2026, « tout modifiable ») : le formulaire de
// l'ajout, prérempli.
export function ModifierCourse({ planId, course }: {
  planId: string; course: { nom: string; date: string; distance_km: number; dplus_m: number; chrono?: string | null; discipline?: 'trail' | 'route';
    mode?: 'gestion' | 'a_fond' };
}) {
  return (
    <details className="text-xs min-w-0 open:basis-full">
      <summary className="cursor-pointer inline-flex items-center min-h-11 font-semibold text-[#5E5C78] underline underline-offset-2">Modifier</summary>
      <div className="mt-1 pb-2"><AjouterCourse planId={planId} ancienne={course.date} initial={{ ...course, chrono: course.chrono ?? null }} /></div>
    </details>
  );
}

// initial : une course B de Nolio (lib/app/coursesNolio.ts), à relire avant d'ajouter ; ou la course à modifier
// (ancienne : sa date d'avant).
export function AjouterCourse({ planId, initial, ancienne }: {
  planId: string; ancienne?: string;
  initial?: { nom: string; date: string; distance_km: number | null; dplus_m: number | null; chrono: string | null; discipline?: 'trail' | 'route';
    mode?: 'gestion' | 'a_fond' } | null;
}) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(
    ancienne ? modifierCourse.bind(null, planId, ancienne) : ajouterCourse.bind(null, planId), null);
  // Trail ou route (décision coach du 23/10/2026) ; une course de Nolio qui ressemble à la route s'ouvre en route.
  const [route, setRoute] = useState(initial?.discipline ? initial.discipline === 'route'
    : Boolean(initial && formatRouteDe(initial.distance_km, initial.dplus_m)));
  // En gestion par défaut ; à fond seulement loin de l'objectif, jamais un ultra (CP1, décision coach du 01/11/2026) : le
  // moteur le vérifie.
  const [aFond, setAFond] = useState(initial?.mode === 'a_fond');
  const champ = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white';
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="discipline" value={route ? 'route' : 'trail'} />
      <input type="hidden" name="mode" value={aFond ? 'a_fond' : 'gestion'} />
      <div role="group" aria-label="Discipline" className="inline-flex p-1 rounded-xl bg-[#F2EFE8] gap-1">
        {([[false, 'Trail'], [true, 'Route']] as const).map(([r, nom]) => (
          <button key={nom} type="button" aria-pressed={route === r} onClick={() => setRoute(r)}
            className={`min-h-10 px-4 rounded-[9px] text-sm ${route === r ? 'bg-white text-indigo font-bold shadow-sm' : 'text-[#4A4866] font-semibold'}`}>
            {nom}
          </button>
        ))}
      </div>
      <label className="block text-xs font-semibold text-indigo">Nom de la course
        <input name="nom" className={champ} maxLength={80} placeholder={route ? '10 km de…' : 'Trail de…'} defaultValue={initial?.nom} />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block text-xs font-semibold text-indigo">Date
          <input name="date" type="date" required className={champ} defaultValue={initial?.date} />
        </label>
        <label className="block text-xs font-semibold text-indigo">Distance (km)
          <input name="distance_km" inputMode="decimal" required className={champ} defaultValue={initial?.distance_km ?? undefined} />
        </label>
        {!route && (
          <label className="block text-xs font-semibold text-indigo">D+ (m)
            <input name="dplus_m" inputMode="numeric" className={champ} defaultValue={initial?.dplus_m ?? undefined} />
          </label>
        )}
        <label className="block text-xs font-semibold text-indigo">Chrono visé
          <input name="chrono" required placeholder={route ? '0h45' : '2h15'} className={champ} defaultValue={initial?.chrono ?? undefined} />
        </label>
      </div>
      <div className="text-xs font-semibold text-indigo">Comment tu la cours ?
        <div role="group" aria-label="Comment tu la cours" className="mt-1.5 flex p-1 rounded-xl bg-[#F2EFE8] gap-1">
          {([[false, 'En gestion'], [true, 'À fond']] as const).map(([f, nom]) => (
            <button key={nom} type="button" aria-pressed={aFond === f} onClick={() => setAFond(f)}
              className={`flex-1 min-h-10 px-3 rounded-[9px] text-sm ${aFond === f ? 'bg-white text-indigo font-bold shadow-sm' : 'text-[#4A4866] font-semibold'}`}>
              {nom}
            </button>
          ))}
        </div>
        <span className="mt-1 block font-normal text-[#5E5C78]">{aFond
          ? 'À fond, pour une course de moins de 3 h : un vrai test, avec une récupération plus longue après.'
          : 'En gestion : environ 7 sur 10, ton objectif reste devant.'}</span>
      </div>
      {!route && <label className="flex flex-col gap-1.5 text-xs font-semibold text-indigo">{ancienne ? 'Nouvelle trace GPX — facultative' : 'Trace GPX — facultative'}
        <input name="gpx" type="file" accept=".gpx" className="block w-full max-w-full text-sm font-normal text-indigo file:mr-3 file:min-h-10 file:px-3 file:rounded-[10px] file:border-0 file:bg-[#E1EFEA] file:text-teal-dark file:font-bold" />
        <span className="font-normal text-[#5E5C78]">{ancienne
          ? 'Sans elle, sa trace d’avant est gardée.'
          : 'Avec elle, sa fiche de course montre son profil et ses tronçons.'}</span>
      </label>}
      <button type="submit" disabled={enCours} className={`${BOUTON} w-full`}>
        {enCours ? 'Vérification…' : ancienne ? 'Enregistrer la course' : 'Ajouter la course'}
      </button>
      <Message etat={etat} />
    </form>
  );
}

// L'accord de lecture donné après l'achat (décision coach du 21/10/2026), avec la phrase du questionnaire d'achat ; C18
// (audits du 05/11/2026) : elle dit aussi qu'il montre sa semaine dans l'app. Q4 : le bouton de l'app. demonstration :
// rien ne s'enregistre.
export function DonnerAccord({ planId, demonstration = false }: { planId: string; demonstration?: boolean }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(donnerMonAccord.bind(null, planId), null);
  const [demo, setDemo] = useState<EtatGeste>(null);
  if (etat?.ok) return <Message etat={etat} />;
  return (
    <form action={action} onSubmit={demonstration ? (e) => { e.preventDefault(); setDemo({ ok: false, message: 'Démonstration : rien ne s’enregistre.' }); } : undefined}
      className="space-y-2">
      <p className="text-[0.8rem] text-[#4A4866] leading-relaxed">
        {/* La phrase du questionnaire d'achat (PL7, décision coach du 04/11/2026), et C18 : « et voir ma semaine ici ».
            Validé par le coach le 05/11/2026 (1A ; l'ajout). */}
        J’accepte que l’app lise aussi dans Nolio mon RPE, mon ressenti, mon Hooper et la trace de mes séances test
        (distance, FC), pour ajuster mon plan à ma fatigue, en tirer mes repères et voir ma semaine ici. Je peux retirer cet
        accord à tout moment.
      </p>
      <button type="submit" disabled={enCours} className={BOUTON}>
        {enCours ? 'Envoi…' : 'Donner mon accord'}
      </button>
      <Message etat={demo ?? etat} />
    </form>
  );
}

// C1 (audits du 05/11/2026) : un vrai bouton de 44 px, plus un lien rouge de 20 px.
export function RetirerAccord({ planId }: { planId: string }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(retirerMonAccord.bind(null, planId), null);
  if (etat?.ok) return <Message etat={etat} />;
  return (
    <form action={action} className="space-y-1">
      <button type="submit" disabled={enCours} className={BOUTON_DANGER}>
        {enCours ? 'Retrait…' : 'Retirer mon accord'}
      </button>
      <Message etat={etat} />
    </form>
  );
}

// Q11 (décision coach du 05/11/2026 au soir, « A ») : la trace GPX de l'objectif, donnée depuis sa fiche de course, avec
// le même champ que pour une course de préparation (lib/app/actionsEcriture.ts, ajouterTraceObjectif). Validé par le coach
// le 05/11/2026 (1A).
export function AjouterTrace({ planId }: { planId: string }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(ajouterTraceObjectif.bind(null, planId), null);
  if (etat?.ok) return <Message etat={etat} />;
  return (
    <form action={action} className="space-y-3">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-indigo">Ajoute la trace de ta course
        <input name="gpx" type="file" accept=".gpx" required className="block w-full max-w-full text-sm font-normal text-indigo file:mr-3 file:min-h-10 file:px-3 file:rounded-[10px] file:border-0 file:bg-[#E1EFEA] file:text-teal-dark file:font-bold" />
        <span className="font-normal text-[#5E5C78]">Le fichier .gpx du site de la course : sa fiche montre alors son profil et ses tronçons. Ta préparation, elle, ne change pas.</span>
      </label>
      <button type="submit" disabled={enCours} className={BOUTON}>{enCours ? 'Lecture de la trace…' : 'Ajouter la trace'}</button>
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

// EC3 (décision coach du 04/11/2026, « A ») : les corrections d'une semaine avant son envoi, sur l'aperçu ; gardées
// jusqu'au passage du dimanche, annulables d'ici là.
export function CorrigerSemaine({ planId, lundi, choix }: { planId: string; lundi: string; choix: Choix | null }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(choisirCorrections.bind(null, planId, lundi), null);
  const [etatAnnule, annuler, enAnnulation] = useActionState<EtatGeste, FormData>(annulerCorrections.bind(null, planId, lundi), null);
  const cochees = new Set(choix && !choix.appliquee ? choix.corrections : []);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.entries(CORRECTIONS) as [string, string][]).map(([cle, titre]) => (
            <label key={cle} className="inline-flex items-center gap-2 min-h-11 px-3 rounded-[10px] border border-indigo/20 bg-white text-sm font-semibold">
              <input type="checkbox" name="correction" value={cle} defaultChecked={cochees.has(cle as never)} className="w-4 h-4 accent-teal" />
              {titre}
            </label>
          ))}
        </div>
        <label className="block max-w-md text-xs font-semibold text-indigo">Pourquoi
          <select name="raison" defaultValue={choix?.raison ?? ''} className="mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal bg-white">
            <option value="">—</option>
            {(Object.entries(RAISONS) as [string, string][]).map(([cle, texte]) => <option key={cle} value={cle}>{texte}</option>)}
          </select>
        </label>
        <button type="submit" disabled={enCours} className="btn btn-primary !py-2.5 disabled:opacity-50">{enCours ? 'Enregistrement…' : 'Garder pour dimanche'}</button>
        <Message etat={etat} />
      </form>
      {cochees.size > 0 && (
        <form action={annuler}>
          <button type="submit" disabled={enAnnulation} className="text-sm font-semibold text-[#5E5C78] underline underline-offset-2 disabled:opacity-50">
            {enAnnulation ? 'Retrait…' : 'Retirer mes corrections'}
          </button>
          <Message etat={etatAnnule} />
        </form>
      )}
    </div>
  );
}

// E3 (audits du 05/11/2026) : arrêter la préparation d'un acheteur remboursé, après une confirmation ; le remboursement se
// fait dans Stripe.
export function ArreterPreparation({ planId, nom }: { planId: string; nom: string }) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(arreterPreparationRemboursee.bind(null, planId), null);
  if (etat?.ok) return <div className="basis-full"><Message etat={etat} /></div>;
  return (
    <details className="basis-full text-xs">
      <summary className="cursor-pointer inline-flex items-center min-h-11 font-semibold text-[#5E5C78] underline underline-offset-2">Arrêter cette préparation (remboursée)</summary>
      <form action={action} className="mt-1 space-y-2">
        <p className="text-[#4A4866] leading-relaxed">
          La préparation {/^[aeiouyhàâéèêëîïôûAEIOUYHÀÂÉÈÊÎÔÛ]/.test(nom) ? 'd’' : 'de '}{nom} s’arrête : plus d’invitation ni de séance écrite, ce qui est encore à venir quitte son Nolio,
          et il quitte ton équipe s’il n’y est que pour elle. Le remboursement, lui, se fait dans Stripe.
        </p>
        <button type="submit" disabled={enCours} className="min-h-11 px-3 rounded-lg border border-[#E2725B]/50 font-bold text-[#B5462F] disabled:opacity-50">
          {enCours ? 'Arrêt…' : 'Confirmer l’arrêt'}
        </button>
        <Message etat={etat} />
      </form>
    </details>
  );
}
