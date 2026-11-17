import Link from 'next/link';
import { Carte, PastilleDate, Surtitre } from '../Ui';
import { CLASSE_COURTE } from '@/lib/app/carteStory';
import type { LigneDossier } from '@/lib/app/dossiersGratuit';
import { lien, type Contexte } from '@/lib/app/contexte';
import { dateLongue, joursEntre } from '@/lib/app/plan';
import type { CourseSecondaire } from '@/lib/app/tableauDuPlan';

// L'onglet Courses d'un acheteur ou d'un coaché (refonte de l'app payante, étape (c) ; maquette « Courses de l'acheteur » du
// 16/11/2026) : son objectif (qui ouvre son dossier), ses courses de préparation (qui ouvrent leur fiche), ses dossiers de course
// faits dans l'app gratuite (lisibles, supprimables), et « Ajouter », qui mène au nouvel objectif. Ne lit rien : la page lui donne
// tout. Aucun texte n'invite à écrire au coach.
const virgule = (n: number) => String(n).replace('.', ',');

const BOUTON_AJOUTER = 'inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-xl border-[1.5px] border-indigo bg-white text-indigo text-[0.8125rem] font-bold';
const PLUS = <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>;

export default function CoursesPayant({ ctx, preparation, avecFiche, dossiers }: {
  ctx: Contexte;
  // Les courses de préparation à venir, et les dates de celles qui ont leur fiche.
  preparation: CourseSecondaire[]; avecFiche: Set<string>;
  // Les dossiers du gratuit : vide en mode « coupe » (la page ne les lit pas).
  dossiers: LigneDossier[];
}) {
  const { plan, jour } = ctx;
  // Une saison de fond n'est pas un objectif : ni carte, ni dossier (ses blocs sont dans Ta préparation).
  const objectif = !ctx.sansObjectif && !plan.fond;
  const aVenir = objectif && plan.course.date >= jour;
  const restants = joursEntre(jour, plan.course.date);
  const ajouter = lien('/app/objectif/nouveau', ctx);
  const vide = !objectif && preparation.length === 0 && dossiers.length === 0;
  return (
    <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight leading-tight">Tes courses</h1>
        <Link href={ajouter} className={BOUTON_AJOUTER}>{PLUS}Ajouter</Link>
      </div>

      {objectif && (
        <Link href={lien('/app/plan/course', ctx)} className="block bg-indigo text-white rounded-2xl p-[18px] space-y-2.5">
          <span className="flex items-center justify-between gap-2">
            <Surtitre ton="clair" as="div">{aVenir ? 'Ton objectif majeur' : 'Ta dernière course'}</Surtitre>
            {aVenir && (
              <span className="text-xs font-extrabold text-indigo bg-[#8FD1C3] rounded-full px-2.5 py-1 whitespace-nowrap">
                {restants > 0 ? `J-${restants}` : 'Jour J'}
              </span>
            )}
          </span>
          <span className="block text-[1.375rem] leading-tight font-extrabold">{plan.course.nom}</span>
          <span className="block text-[0.8125rem] text-sand-dark">
            {dateLongue(plan.course.date, plan.course.date.slice(0, 4) !== jour.slice(0, 4))}
            {plan.course.dplus_m ? ` · ${virgule(Math.round(plan.course.distance_km * 10) / 10)} km · ${plan.course.dplus_m.toLocaleString('fr-FR')} m D+` : ' · sur route'}
          </span>
          <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold pt-0.5">Ouvrir son dossier de course <span aria-hidden>›</span></span>
        </Link>
      )}

      {preparation.length > 0 && (
        <Carte className="!pb-1.5">
          <Surtitre>Tes courses de préparation</Surtitre>
          <ul className="mt-1">
            {preparation.map((c) => (
              <li key={`${c.date}-${c.nom}`} className="flex items-center gap-3 min-h-16 py-2 border-b border-indigo/[0.06]">
                <PastilleDate iso={c.date} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-indigo">{c.nom}</span>
                  <span className="block text-xs text-[#5E5C78] leading-snug">
                    {virgule(c.distance_km)} km{c.dplus_m ? ` · ${c.dplus_m} m D+` : ''}{c.chrono ? ` · objectif ${c.chrono}` : ''}
                  </span>
                </span>
                {avecFiche.has(c.date) && (
                  <Link href={lien('/app/plan/course', ctx, { course: c.date })} className="shrink-0 inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal whitespace-nowrap">Sa fiche ›</Link>
                )}
              </li>
            ))}
          </ul>
          <Link href={ajouter} className="flex items-center gap-2 min-h-12 text-[0.8125rem] font-bold text-teal">{PLUS}Ajouter une course</Link>
        </Carte>
      )}

      {dossiers.length > 0 && (
        <Carte className="!pb-3">
          <Surtitre>Tes dossiers de course</Surtitre>
          <ul className="mt-1">
            {dossiers.map((d) => (
              <li key={d.id} className="border-b last:border-b-0 border-indigo/[0.06]">
                <Link href={`/app/courses/${d.id}`} className="flex items-center gap-3 min-h-16 py-2">
                  {d.date ? <PastilleDate iso={d.date} /> : null}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-indigo truncate">{d.nom}</span>
                    <span className="block text-xs text-[#5E5C78] leading-snug">
                      {d.distance_km != null ? `${virgule(d.distance_km)} km` : ''}{d.dplus_m != null ? ` · ${d.dplus_m} m D+` : ''}
                      {d.classe ? ` · course ${CLASSE_COURTE[d.classe]}` : ''}
                    </span>
                  </span>
                  <span aria-hidden className="text-[#5E5C78]">›</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="pt-2.5 border-t border-indigo/[0.06] text-[0.71875rem] leading-relaxed text-[#5E5C78]">Ces dossiers viennent de l’app gratuite : ils restent lisibles ici.</p>
        </Carte>
      )}

      {vide && (
        <Carte className="space-y-1.5">
          <p className="text-sm font-bold text-indigo">Pas encore de course ici.</p>
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">Ajoute ton prochain objectif : sa course s’affichera ici, avec son dossier.</p>
        </Carte>
      )}
    </main>
  );
}
