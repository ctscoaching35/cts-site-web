import ProfilCourse from './ProfilCourse';
import RepartitionPentes from './RepartitionPentes';
import StrategieCourse from './StrategieCourse';
import type { Strategie } from '@/lib/app/strategie';
import EnTeteCourse from './EnTeteCourse';
import { Partie, Puces, Tableau } from './Texte';
import type { Plan } from '@/lib/app/plan';

// La fiche d'une course de préparation (PO3), rendue par le moteur (/v1/fiche-course) : les mêmes formes que les
// sections du plan, sans les déterminants physiologiques (ceux de la préparation). Le même corps dans la fiche privée
// et dans l'app (décision coach du 19/10/2026 : tout reste dans l'app).
export type FichePrep = {
  course: { nom: string; date_lettres: string; temps_cible: string };
  ta_course: Plan['ta_course']; profil: Plan['profil'];
  determinants: { mecanique: { titre: string; puces: string[] } | null; sans_trace: string | null };
  jour_j: Plan['jour_j'];
};

export default function CorpsFichePreparation({ fiche, calculateur, cheminFiche, externe = false, strategie = null, effacer }: {
  fiche: FichePrep; calculateur: string; cheminFiche: (slug: string) => string; externe?: boolean;
  strategie?: Strategie | null; effacer?: () => Promise<void>;
}) {
  const { profil, determinants: d, jour_j: j } = fiche;
  const t = profil.troncons;
  return (
    <>
      <EnTeteCourse surtitre="Course de préparation" nom={fiche.course.nom} lignes={fiche.ta_course.lignes} />
      <Partie titre={profil.titre}>
        {profil.sans_trace ? (
          // C29 (audits du 05/11/2026) : une phrase de coureur ; « Modifier » sa course reprend la trace. BROUILLON, à
          // valider par le coach.
          <p>Sans la trace GPX de cette course, sa fiche n’a pas son profil ni ses tronçons : donne-la en modifiant ta course, dans « Ta préparation ».</p>
        ) : (
          <>
            {profil.points && <ProfilCourse points={profil.points} />}
            {profil.pentes && <RepartitionPentes pentes={profil.pentes} />}
          </>
        )}
      </Partie>
      {t && (t.homogene || t.tableau) && (
        <Partie titre={t.titre}>
          {t.homogene ? <p>{t.homogene}</p> : t.tableau && <Tableau lignes={t.tableau} />}
        </Partie>
      )}
      {d.mecanique && (
        <Partie titre={d.mecanique.titre}>
          <Puces puces={d.mecanique.puces} />
        </Partie>
      )}
      <h2 className="pt-3 text-[1.25rem] font-extrabold text-indigo tracking-tight">{j.titre}</h2>
      <Partie titre={j.nutrition.titre}>
        <StrategieCourse lignes={j.nutrition.lignes as [string, string][]} href={calculateur} fiche={cheminFiche}
          ultra={Boolean(j.fiche_ultra)} externe={externe} strategie={strategie} effacer={effacer} />
      </Partie>
    </>
  );
}
