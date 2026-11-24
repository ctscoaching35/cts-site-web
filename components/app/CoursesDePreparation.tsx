import { PastilleDate } from './Ui';
import { AjouterCourse, ModifierCourse, RetirerCourse } from './GestesEcriture';
import { TEXTES_PAGE_ATHLETE } from '@/lib/app/pageAthleteSimple';

// « SES COURSES DE PRÉPARATION », SOUS CHAQUE OBJECTIF DE « SES OBJECTIFS », SOUS LA 9.x SEULEMENT (décision du coach du 25/11/2026, C5 : le moteur v1 lit `courses_mineures`, la durée d'une course est son
// chrono visé, entrée 214). Elles étaient cachées sous la 9.x (lib/app/cacherSousLaV1.ts, (b)) : leur saisie revient ici, dans un repli sous l'objectif. Pour chacune : la date, le nom, la distance, le D+ et
// le chrono visé, et de quoi la modifier ou la retirer ; en dessous, « Ajouter une course de préparation » : le formulaire de toujours (date, distance, D+, chrono visé), sans « Comment tu la cours ? »
// que la v1 ne lit pas. La course part au moteur au prochain passage (lib/app/moteurV9.ts, coursesMineuresDe). Les mêmes gestes (lib/app/actionsEcriture.ts) que ceux de l'athlète dans son app.
export type CourseDePreparation = {
  nom: string; date: string; distance_km: number; dplus_m: number; chrono?: string | null; discipline?: 'trail' | 'route'; mode?: 'gestion' | 'a_fond';
};

export default function CoursesDePreparation({ planId, courses, jour }: { planId: string; courses: CourseDePreparation[]; jour: string }) {
  const t = TEXTES_PAGE_ATHLETE;
  const rangees = [...courses].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <details id={`courses-${planId}`} className="mx-3.5 mb-3.5 rounded-xl border border-indigo/[0.08] bg-[#FBFAF6] text-indigo">
      <summary className="cursor-pointer min-h-11 px-3.5 flex items-center text-[0.8125rem] font-bold text-teal">
        {t.coursesDePreparation}{rangees.length > 0 ? ` · ${rangees.length}` : ''}
      </summary>
      <div className="px-3.5 pb-3.5 space-y-3">
        {rangees.length === 0 && <p className="text-sm text-[#4A4866]">{t.aucuneCourse}</p>}
        {rangees.map((c) => (
          <div key={`${c.date}-${c.nom}`}>
            <div className="flex items-center gap-3">
              <PastilleDate iso={c.date} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">{c.nom}</span>
                <span className="block text-xs text-[#5E5C78]">{c.distance_km} km{c.discipline === 'route' ? ' sur route' : c.dplus_m ? ` · ${c.dplus_m} m D+` : ''}{c.chrono ? ` · objectif ${c.chrono}` : ''}</span>
              </span>
            </div>
            {c.date > jour && (
              <div className="pl-14 -mt-1 flex flex-wrap gap-x-5">
                <ModifierCourse planId={planId} course={c} sansMode />
                <RetirerCourse planId={planId} date={c.date} nom={c.nom} />
              </div>
            )}
          </div>
        ))}
        <details className="text-sm">
          <summary className="cursor-pointer inline-flex items-center min-h-11 px-4 rounded-xl border border-teal bg-white text-teal text-[0.8125rem] font-bold">{t.ajouterUneCourse}</summary>
          <div className="pt-3"><AjouterCourse planId={planId} sansMode /></div>
        </details>
      </div>
    </details>
  );
}
