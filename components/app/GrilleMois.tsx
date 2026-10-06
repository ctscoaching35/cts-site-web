import Link from 'next/link';
import clsx from 'clsx';
import { ajouterJours, jourDuMois, jourParDate, rangDansSemaine, semaineDeDate, type Plan } from '@/lib/app/plan';
import { BANNIERE, FAMILLES } from '@/lib/app/charte';
import { lien, type Contexte } from '@/lib/app/contexte';

const ENTETES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Le mois : chaque jour du plan porte la couleur de sa séance ; le filet de gauche, la couleur
// du type de semaine (celle des bannières) ; la course en teal plein.
export default function GrilleMois({ plan, mois, ctx }: { plan: Plan; mois: string; ctx: Contexte }) {
  const premier = `${mois}-01`;
  const debut = ajouterJours(premier, -rangDansSemaine(premier));
  const lignes: string[][] = [];
  for (let lundi = debut; lundi.slice(0, 7) <= mois; lundi = ajouterJours(lundi, 7)) {
    lignes.push(Array.from({ length: 7 }, (_, k) => ajouterJours(lundi, k)));
  }
  return (
    <div className="bg-white shadow-sm p-2">
      <div className="grid grid-cols-[0.375rem_repeat(7,1fr)] gap-1 mb-1">
        <span />
        {ENTETES.map((e, i) => (
          <span key={i} className="text-center text-[0.65rem] font-semibold text-indigo/45">{e}</span>
        ))}
      </div>
      {lignes.map((ligne) => {
        const semaine = semaineDeDate(plan, ligne[0]);
        return (
          <div key={ligne[0]} className="grid grid-cols-[0.375rem_repeat(7,1fr)] gap-1 mb-1">
            <span
              aria-hidden
              className="rounded-full"
              style={{ backgroundColor: semaine ? BANNIERE[semaine.type] ?? '#2F2D4E' : 'transparent' }}
              title={semaine ? `${semaine.numero} · ${semaine.type}` : undefined}
            />
            {ligne.map((iso) => {
              const jour = jourParDate(plan, iso);
              const horsMois = iso.slice(0, 7) !== mois;
              const repos = !jour || jour.famille === 'repos';
              const course = jour?.famille === 'course';
              const cellule = (
                <span
                  className={clsx(
                    'flex flex-col items-center justify-start gap-1 h-12 pt-1.5 text-xs',
                    horsMois && 'opacity-35',
                    course ? 'bg-teal text-white font-bold' : 'bg-sand/50',
                    iso === ctx.jour && 'ring-2 ring-inset ring-teal'
                  )}
                >
                  <span className={clsx(!course && (jour ? 'text-indigo' : 'text-indigo/30'))}>{jourDuMois(iso)}</span>
                  {jour && !repos && !course && (
                    <span className="w-5 h-1.5 rounded-full" style={{ backgroundColor: FAMILLES[jour.famille].filet }} />
                  )}
                  {course && <span className="text-[0.6rem] leading-none">Jour J</span>}
                </span>
              );
              return jour && !repos ? (
                <Link key={iso} href={lien(`/app/seance/${jour.id}`, ctx)} title={jour.seance}>
                  {cellule}
                </Link>
              ) : (
                <span key={iso}>{cellule}</span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
