'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { enregistrerProfil, type EtatCoach } from '@/lib/app/actionsCoaching';
import { modifierMonProfil } from '@/lib/app/actionsObjectifs';
import { ANCIENNETES, ENTRAINEMENTS, niveauDesFaits } from '@/lib/app/niveau';
import { textes } from '@/lib/plan';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// PO1 : le profil d'un athlète coaché, modifié à part de ses objectifs, sur sa fiche : par son coach (athleteId), ou par
// lui-même dans son onglet Profil (pourMoi ; décision coach du 20/10/2026). Rempli d'abord, avant tout objectif
// (décision coach du 23/10/2026) : rafraichir recharge la page une fois enregistré, pour passer à la course. Le niveau,
// tiré de deux faits (lib/app/niveau.ts) ; le coach peut le choisir, et son choix l'emporte.
export default function ProfilAthlete({ athleteId, profil, pourMoi = false, rafraichir = false }: {
  athleteId?: string; profil: Record<string, string | string[]>; pourMoi?: boolean; rafraichir?: boolean;
}) {
  const [etat, action, enCours] = useActionState<EtatCoach, FormData>(
    pourMoi || !athleteId ? modifierMonProfil : enregistrerProfil.bind(null, athleteId), null);
  const router = useRouter();
  useEffect(() => {
    if (rafraichir && etat?.ok) router.refresh();
  }, [rafraichir, etat, router]);
  const [anciennete, setAnciennete] = useState(String(profil.anciennete ?? ''));
  const [entrainement, setEntrainement] = useState(String(profil.entrainement ?? ''));
  const [choix, setChoix] = useState(String(profil.niveau_coach ?? ''));
  const moi = pourMoi || !athleteId;
  const titre = (n: string | null) => textes.niveau.options.find((o) => o.valeur === n)?.titre;
  const desFaits = titre(niveauDesFaits(anciennete, entrainement));
  const jours = Array.isArray(profil.jours_disponibles) ? profil.jours_disponibles : [];
  const champ = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white';
  return (
    <form action={action} className="space-y-3.5">
      <fieldset className="space-y-2.5">
        <legend className="text-[0.8125rem] font-bold text-indigo">{moi ? 'Ton niveau' : 'Son niveau'}</legend>
        <label className="block text-xs font-semibold text-indigo">
          {moi ? 'Depuis combien de temps cours-tu régulièrement ?' : 'Depuis combien de temps court-il régulièrement ?'}
          <span className="block font-normal text-[#5E5C78]">Au moins deux fois par semaine, sans arrêt de plus de 3 mois.</span>
          <select name="anciennete" value={anciennete} onChange={(e) => setAnciennete(e.target.value)} className={champ} required={moi || !choix}>
            <option value="" disabled>Choisis</option>
            {ANCIENNETES.map((o) => <option key={o.valeur} value={o.valeur}>{o.titre}</option>)}
          </select>
        </label>
        <div role="radiogroup" aria-label={moi ? 'Ton entraînement' : 'Son entraînement'}>
          <div className="text-xs font-semibold text-indigo">{moi ? 'Ton entraînement' : 'Son entraînement'}</div>
          <div className="mt-1.5 space-y-1.5">
            {ENTRAINEMENTS.map((o) => (
              <label key={o.valeur} className="flex items-center gap-2.5 min-h-11 px-3 py-2 rounded-[10px] border border-indigo/20 bg-white text-sm text-indigo has-[:checked]:border-teal has-[:checked]:bg-[#E1EFEA]">
                <input type="radio" name="entrainement" value={o.valeur} checked={entrainement === o.valeur}
                  onChange={() => setEntrainement(o.valeur)} required={moi || !choix} className="accent-teal" />
                {o.titre}
              </label>
            ))}
          </div>
        </div>
        {moi ? (
          <p className="text-[0.8125rem] text-indigo" role="status">
            {profil.niveau_coach
              ? <>Ton niveau, choisi par ton coach : <b>{titre(String(profil.niveau_coach))}</b>.</>
              : desFaits ? <>Ton niveau : <b>{desFaits}</b>. Ton coach le relit.</> : 'Tes deux réponses donnent ton niveau.'}
          </p>
        ) : (
          <label className="block text-xs font-semibold text-indigo">Son niveau
            <select name="niveau_coach" value={choix} onChange={(e) => setChoix(e.target.value)} className={champ}>
              <option value="">{desFaits ? `D’après ses réponses : ${desFaits.toLowerCase()}` : 'D’après ses réponses'}</option>
              {textes.niveau.options.map((o) => <option key={o.valeur} value={o.valeur}>{o.titre}, choisi par toi</option>)}
            </select>
          </label>
        )}
      </fieldset>
      <label className="block text-xs font-semibold text-indigo">Terrain d’entraînement
        <select name="terrain" defaultValue={String(profil.terrain ?? '')} className={champ} required>
          <option value="" disabled>Choisis</option>
          {textes.terrain.options.map((o) => <option key={o.valeur} value={o.valeur}>{o.titre} — {o.description}</option>)}
        </select>
      </label>
      <fieldset className="space-y-2.5">
        <legend className="text-[0.8125rem] font-bold text-indigo">{moi ? 'Ta semaine habituelle' : 'Sa semaine habituelle'}</legend>
        <p className="text-xs text-[#5E5C78] leading-relaxed">
          {moi
            ? 'Ta semaine de tous les jours : ta préparation se construit dessus. Chaque dimanche, le questionnaire « Ta semaine prochaine » change la semaine qui vient.'
            : 'Sa semaine de tous les jours : sa préparation se construit dessus. Chaque dimanche, son questionnaire « Ta semaine prochaine » change la semaine qui vient.'}
        </p>
        <div className="text-xs font-semibold text-indigo">Jours disponibles</div>
        <div className="flex flex-wrap gap-1.5">
          {JOURS.map((j) => (
            <label key={j} className="inline-flex items-center gap-1.5 min-h-10 px-2.5 rounded-[10px] border border-indigo/20 text-[0.8rem] text-indigo has-[:checked]:bg-teal has-[:checked]:text-white has-[:checked]:border-teal">
              <input type="checkbox" name="jours_disponibles" value={j} defaultChecked={jours.includes(j)} className="sr-only" />
              {j.charAt(0).toUpperCase() + j.slice(1, 3)}.
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block text-xs font-semibold text-indigo">Sortie longue le
            <select name="jour_sl" defaultValue={String(profil.jour_sl ?? '')} className={champ} required>
              <option value="" disabled>Choisis</option>
              {JOURS.map((j) => <option key={j} value={j}>{j.charAt(0).toUpperCase() + j.slice(1)}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-indigo">Séances par semaine
            <input name="freq_hebdo" type="number" min={1} max={7} defaultValue={String(profil.freq_hebdo ?? '')} className={champ} required />
          </label>
        </div>
      </fieldset>
      <button type="submit" disabled={enCours} className="min-h-11 px-4 rounded-[10px] bg-teal text-white text-sm font-bold disabled:opacity-50">
        {enCours ? 'Enregistrement…' : pourMoi ? 'Enregistrer mon profil' : 'Enregistrer son profil'}
      </button>
      {etat?.message && <p className={etat.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'} role="status">{etat.message}</p>}
    </form>
  );
}
