import { CHOIX_TRAIL, POINTS_TRAIL, type ChampTrail, type ValeursTrail } from '@/lib/app/pointsTrail';

const PUCE = 'inline-flex items-center min-h-10 px-2.5 rounded-[10px] border border-indigo/20 bg-white text-[0.8rem] font-normal text-indigo has-[:checked]:bg-teal has-[:checked]:text-white has-[:checked]:border-teal';

// Ses points forts et faibles en trail : une ligne par point, trois choix (lib/app/pointsTrail.ts). Avec `onChange`, les choix sont tenus par la page (la carte du coach) ; sans lui, par le formulaire (la fiche, le profil de l'athlète).
export default function ChoixPointsTrail({ titre, valeurs, onChange }: { titre: string; valeurs: ValeursTrail; onChange?: (champ: ChampTrail, valeur: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-indigo">{titre}</legend>
      {POINTS_TRAIL.map((p) => (
        <div key={p.champ} role="radiogroup" aria-label={p.titre} className="flex flex-wrap items-center gap-1.5">
          <span className="w-full sm:w-24 text-xs text-indigo">{p.titre}</span>
          {CHOIX_TRAIL.map(([valeur, libelle]) => (
            <label key={valeur} className={PUCE}>
              <input type="radio" name={p.champ} value={valeur} className="sr-only"
                {...(onChange ? { checked: valeurs[p.champ] === valeur, onChange: () => onChange(p.champ, valeur) } : { defaultChecked: valeurs[p.champ] === valeur })} />
              {libelle}
            </label>
          ))}
        </div>
      ))}
    </fieldset>
  );
}
