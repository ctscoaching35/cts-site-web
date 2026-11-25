import { Carte, Surtitre } from './Ui';
import { TEXTES_COURSES, type Evenement } from '@/lib/app/sesCourses';
import { dateAbregee } from '@/lib/app/plan';

// LA VUE D'ENSEMBLE, EN HAUT DE LA PAGE D'UN ATHLÈTE, EN LECTURE, SOUS LA 9.x SEULEMENT (décision 241 du coach, 25/11/2026) : son profil (côte, tapis, critères, vitesse critique, repères) et ses courses sur une ligne
// de temps (objectifs, préparations, courses pendant une récupération). « Complet » ou « Il manque : … » se lit juste en dessous, en tête de la carte « Ce que j'ai besoin de savoir ».
export default function VueDEnsemble({ coureur, courses }: { coureur: [string, string][]; courses: Evenement[] }) {
  const t = TEXTES_COURSES;
  return (
    <Carte className="!p-5 space-y-3">
      <Surtitre>{t.vueDEnsemble}</Surtitre>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
        {coureur.map(([titre, valeur]) => (
          <div key={titre}>
            <dt className="text-[0.72rem] font-semibold text-[#5E5C78]">{titre}</dt>
            <dd className="text-sm font-bold text-indigo">{valeur}</dd>
          </div>
        ))}
      </dl>
      {courses.length === 0 ? <p className="pt-2 border-t border-indigo/[0.07] text-sm text-[#4A4866]">{t.sansCourse}</p> : (
        <ol className="pt-2 border-t border-indigo/[0.07] space-y-1.5">
          {courses.map((c, i) => (
            <li key={`${c.date}:${c.nom}:${i}`} className="flex items-baseline gap-3 text-sm">
              <span className="w-16 shrink-0 font-bold tabular-nums text-teal">{dateAbregee(c.date, false)}</span>
              <span className={c.genre === t.majeur ? 'font-bold text-indigo' : 'text-[#4A4866]'}>{c.nom}</span>
              <span className="ml-auto text-[0.72rem] font-semibold text-[#5E5C78]">{c.genre}</span>
            </li>
          ))}
        </ol>
      )}
    </Carte>
  );
}
