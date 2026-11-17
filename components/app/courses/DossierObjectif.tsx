import Link from 'next/link';
import { Suspense } from 'react';
import { BoutonPartager } from './ActionsDossier';
import { EffortDuJourJ, TypeDeLaCourse } from './BlocsCourse';
import { AjouterTrace } from '../GestesEcriture';
import ProfilCourse from '../ProfilCourse';
import RepartitionPentes from '../RepartitionPentes';
import StrategieCourse from '../StrategieCourse';
import { Partie, Puces, Tableau } from '../Texte';
import { Carte, LIEN, Surtitre } from '../Ui';
import EnTeteCourse from '../EnTeteCourse';
import { lien, type Contexte } from '@/lib/app/contexte';
import type { DemandeCourseLibre, ReponseCourseLibre } from '@/lib/app/courseLibre';
import { lireCourseLibre, modeleCarteDuPlan } from '@/lib/app/coursePlan';
import { joursEntre } from '@/lib/app/plan';
import type { Strategie } from '@/lib/app/strategie';

// Le dossier de l'objectif d'un acheteur ou d'un coaché (refonte de l'app payante, étape (c) ; maquette « Dossier de course de
// l'objectif » du 16/11/2026) : la présentation du dossier du gratuit (DossierCourse : mêmes parties, mêmes composants, même
// ordre), avec ce que le plan y ajoute (la carte « Dans ta préparation », le jour J, la semaine de course).
//
// LA RÈGLE DES DONNÉES : chaque bloc que le plan a déjà (le profil fin et les pentes, les tronçons, le terrain, ce que la course
// demande, les secteurs clés, le jour J et sa nutrition) garde les données et les textes du plan, tels quels. Un bloc du dossier
// du gratuit que le plan n'a pas (le type de la course, la grille de l'effort du jour J) vient de POST /v1/course-libre, appelé
// d'ici côté serveur (lib/app/coursePlan.ts) : s'il échoue ou tarde, le bloc ne s'affiche pas et le reste s'affiche ; chaque bloc
// attend la réponse sans retenir les autres (Suspense). Rien d'inventé : un bloc sans donnée ne s'affiche pas.
const titreDeSection = 'pt-3 text-[1.25rem] font-extrabold text-indigo tracking-tight scroll-mt-20';
type Moteur = Promise<ReponseCourseLibre | null>;

async function BlocType({ moteur }: { moteur: Moteur }) {
  const r = await moteur;
  if (!r) return null;
  return <Partie titre="Le type de ta course"><TypeDeLaCourse classe={r.course.classe} libelle={r.course.classe_libelle} /></Partie>;
}

async function BlocEffort({ moteur }: { moteur: Moteur }) {
  const r = await moteur;
  if (!r) return null;
  return <Partie titre="Ton effort le jour J"><EffortDuJourJ effort={r.effort_jour_j} /></Partie>;
}

// La carte de l'objectif seule (celle du lot B) : son type vient du moteur ; sans lui, pas de bouton.
async function BlocPartager({ moteur, plan }: { moteur: Moteur; plan: Contexte['plan'] }) {
  const r = await moteur;
  if (!r) return null;
  return <BoutonPartager modele={modeleCarteDuPlan(plan, r.course.classe)} />;
}

export default function DossierObjectif({ ctx, demande, strategie, calculateur, effacer, place }: {
  ctx: Contexte;
  // Ce qui part au moteur (lib/app/coursePlan.ts, demandeDuPlan) ; null : rien à lui demander, les blocs du moteur ne s'affichent pas.
  demande: DemandeCourseLibre | null;
  strategie: Strategie | null; calculateur: string; effacer: () => Promise<void>;
  // Le bloc en cours et la semaine en cours sur le total, pour la carte « Dans ta préparation » (null : rien à en dire).
  place: { bloc: string | null; numero: number; total: number } | null;
}) {
  const { plan, jour } = ctx;
  const { profil, terrain, determinants: d, jour_j: j } = plan;
  const t = profil.troncons;
  const restants = joursEntre(jour, plan.course.date);
  const aVenir = restants >= 0;
  const semaineDeCourse = aVenir && restants <= 7;
  // L'appel part tout de suite, en même temps que le reste de la page.
  const moteur: Moteur = demande ? lireCourseLibre(demande) : Promise.resolve(null);
  const fiche = (slug: string) => lien(`/app/bibliotheque/${slug}`, ctx);

  const jourJ = (
    <section id="jour-j" className="space-y-5 scroll-mt-20">
      {semaineDeCourse ? (
        // La carte de l'accueil (« Semaine de course » et le titre du jour J), mise en avant ici.
        <div className="bg-teal text-white rounded-2xl p-[18px]">
          <span className="block text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-white/80 mb-1">Semaine de course</span>
          <h2 className="font-bold text-lg">{j.titre}</h2>
        </div>
      ) : <h2 className={titreDeSection}>{j.titre}</h2>}
      <Suspense fallback={null}><BlocEffort moteur={moteur} /></Suspense>
      <Partie titre={j.nutrition.titre}>
        <StrategieCourse lignes={j.nutrition.lignes as [string, string][]} href={calculateur} fiche={fiche} ultra={Boolean(j.fiche_ultra)}
          strategie={strategie} effacer={effacer} />
      </Partie>
    </section>
  );

  return (
    <div className="space-y-5">
      <Link href={lien('/app/courses', ctx)} className="inline-flex items-center min-h-11 text-sm font-bold text-teal">‹ Tes courses</Link>
      <EnTeteCourse surtitre={aVenir ? 'Ton dossier de course · objectif majeur' : 'Ton dossier de course'} nom={plan.course.nom} lignes={plan.ta_course.lignes} />

      {/* Ce que le plan ajoute : sa place dans la préparation, et le chemin vers le jour J. */}
      {aVenir && (
        <Carte className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Surtitre as="div">Dans ta préparation</Surtitre>
            <span className="text-xs font-extrabold text-indigo bg-[#8FD1C3] rounded-full px-2.5 py-1 whitespace-nowrap">{restants > 0 ? `J-${restants}` : 'Jour J'}</span>
          </div>
          <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">
            {place ? `${place.bloc ? `${place.bloc} · semaine` : 'Semaine'} ${place.numero} sur ${place.total}. ` : ''}Ta préparation est construite pour cette course.
          </p>
          <div className="flex flex-col">
            <Link href={lien('/app/plan', ctx)} className={`${LIEN} justify-between`}>Voir ma préparation<span aria-hidden>›</span></Link>
            <a href="#jour-j" className={`${LIEN} justify-between`}>Ton jour J et ta semaine de course<span aria-hidden>›</span></a>
          </div>
        </Carte>
      )}

      {semaineDeCourse && jourJ}

      <Suspense fallback={null}><BlocType moteur={moteur} /></Suspense>

      {/* C29 et Q11 (audits du 05/11/2026 ; décision coach du 05/11/2026 au soir, « A ») : sans trace, une phrase de
          coureur à la place des phrases de fichier, et de quoi la donner. Validé par le coach le 05/11/2026 (1A). */}
      <Partie titre={profil.titre}>
        {profil.sans_trace ? (
          <>
            <p>Sans la trace GPX de ta course, sa fiche n’a pas encore son profil ni ses tronçons : ta préparation part de son dénivelé total.</p>
            {/* En démonstration, le geste répond que rien ne s'enregistre. */}
            <AjouterTrace planId={ctx.cle} />
          </>
        ) : (
          <>
            {profil.points && <ProfilCourse points={profil.points} />}
            {profil.pentes && <RepartitionPentes pentes={profil.pentes} />}
          </>
        )}
      </Partie>

      {terrain && (
        <Partie titre={terrain.titre}>
          <p>{terrain.texte}</p>
        </Partie>
      )}

      {t && (t.homogene || t.tableau) && (
        <Partie titre={t.titre}>
          {t.homogene ? <p>{t.homogene}</p> : t.tableau && <Tableau lignes={t.tableau} />}
        </Partie>
      )}

      <h2 className={titreDeSection}>{d.titre}</h2>
      <Partie titre={d.physio.titre}>
        <Puces puces={d.physio.puces.map(enMotsDeCoureur)} />
      </Partie>
      {d.mecanique && (
        <Partie titre={d.mecanique.titre}>
          <Puces puces={d.mecanique.puces} />
        </Partie>
      )}
      {d.secteurs_cles && (
        <Partie titre={d.secteurs_cles.titre}>
          <Puces puces={d.secteurs_cles.puces} />
        </Partie>
      )}

      {!semaineDeCourse && jourJ}

      <Suspense fallback={null}><BlocPartager moteur={moteur} plan={plan} /></Suspense>
    </div>
  );
}

// Q1 (décision coach du 05/11/2026 au soir, « A ») : des mots de coureur hors des noms de séance.
const enMotsDeCoureur = (t: string) => t.replace(/le déterminant physiologique central de ta préparation/g, 'ce qui compte le plus pour ta course');
