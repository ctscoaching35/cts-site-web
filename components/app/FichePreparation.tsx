import ProfilCourse from './ProfilCourse';
import RepartitionPentes from './RepartitionPentes';
import StrategieCourse from './StrategieCourse';
import type { Strategie } from '@/lib/app/strategie';
import { Lignes, Partie, Puces, Tableau } from './Texte';
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
      <h1 className="text-2xl text-indigo leading-tight">{fiche.course.nom}</h1>
      <div className="bg-white shadow-sm px-4 py-1">
        <Lignes lignes={fiche.ta_course.lignes} />
      </div>
      <Partie titre={profil.titre}>
        {profil.sans_trace ? (
          <p>{profil.sans_trace}</p>
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
      {d.sans_trace && <p className="text-sm text-indigo/75 px-1">{d.sans_trace}</p>}
      <h2 className="text-2xl text-indigo leading-tight pt-4">{j.titre}</h2>
      <Partie titre={j.nutrition.titre}>
        <StrategieCourse lignes={j.nutrition.lignes as [string, string][]} href={calculateur} fiche={cheminFiche}
          ultra={Boolean(j.fiche_ultra)} externe={externe} strategie={strategie} effacer={effacer} />
      </Partie>
    </>
  );
}
