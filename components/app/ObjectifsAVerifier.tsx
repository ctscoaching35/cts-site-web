import Link from 'next/link';
import clsx from 'clsx';
import { Carte, PastilleDate, Surtitre } from './Ui';
import CoursesDePreparation, { type CourseDePreparation } from './CoursesDePreparation';
import { gestesDeLObjectif, repereDeLObjectif, TEXTES_PAGE_ATHLETE, type VerifObjectif } from '@/lib/app/pageAthleteSimple';

// « SES OBJECTIFS », SUR LA PAGE D'UN ATHLÈTE, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : seulement ce qui sert à vérifier que tout est rempli). Pour chaque objectif à
// venir : la course, sa date, un repère (« Complet » ou « Il manque : … ») et ce que le moteur lit : sa côte en minutes, ses deux critères, son tapis, la trace de sa course
// (lib/app/pageAthleteSimple.ts, verifierObjectif). Le lien vers la page de l'objectif reste ; les deux boutons « + Objectif » aussi. Ses courses de préparation et ses objectifs passés
// sont dans « Réglages ». Sous la 8.x, la page garde sa carte d'avant. verif : null pour un objectif envoyé en entier (il n'a pas de réponses à vérifier).
// Ce qui manque a son geste, juste dessous (inventaire du 25/11/2026) : « Modifier son profil » pour la côte, les critères et le tapis (il ouvre le formulaire de sa carte de coureur :
// la page suit l'ancre, components/app/OuvrirLeReglage.tsx) ; « Ajouter la trace » et « Modifier l'objectif » mènent au questionnaire de l'objectif. La ligne « Semaine » dit ce que le moteur lit
// pour ses jours, sa sortie longue et son nombre de séances : ceux de l'objectif, pas ceux de sa fiche.
// Sans la saison de fond (troisième simplification, lib/app/cacherSousLaV1.ts) : le moteur v1 n'en écrit pas, son lien « en cours » n'est plus ici.
// courses : ses courses de préparation (`parametres.courses_secondaires`), quand l'objectif s'écrit semaine par semaine (sinon `null` : rien à ajouter) ; jour : aujourd'hui, pour ce qui se modifie encore.
export type LigneObjectif = { planId: string; nom: string; date: string; principal: boolean; verif: VerifObjectif | null; courses?: CourseDePreparation[] | null };

const GESTE = 'inline-flex items-center min-h-10 px-3.5 rounded-xl border border-teal bg-white text-teal text-[0.8125rem] font-bold';

export default function ObjectifsAVerifier({ athleteId, lignes, jour }: { athleteId: string; lignes: LigneObjectif[]; jour: string }) {
  const t = TEXTES_PAGE_ATHLETE;
  return (
    <Carte id="ses-objectifs" className="!p-5 space-y-3 scroll-mt-6">
      <div className="flex justify-between items-center gap-3">
        <Surtitre>{t.objectifs}</Surtitre>
        {/* Deux entrées (décision coach du 23/10/2026) : le trail ou la route (10 km, semi, marathon). */}
        <Link href={`/app/coach/nouveau?athlete=${athleteId}&discipline=route`} className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">
          + Objectif route
        </Link>
        <Link href={`/app/coach/nouveau?athlete=${athleteId}`} className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] bg-teal text-white text-[0.8125rem] font-bold">
          + Objectif trail
        </Link>
      </div>
      {lignes.length === 0 && <p className="text-sm text-[#4A4866]">{t.aucunObjectif}</p>}
      {lignes.map((o) => (
        <div key={o.planId} className="rounded-xl border border-indigo/[0.12] text-indigo">
        <Link href={`/app/coach/plan/${o.planId}`} className="block p-3.5 space-y-2">
          <span className="flex items-center gap-3.5">
            <PastilleDate iso={o.date} />
            <span className="flex-1 min-w-0">
              <span className="block text-[0.9375rem] font-bold">{o.nom}{o.principal ? ' · objectif principal' : ''}</span>
              {o.verif ? (
                <span className={clsx('mt-1 inline-flex items-start gap-1.5 text-[0.78rem] font-bold px-2.5 py-1 rounded-xl',
                  o.verif.complet ? 'bg-[#E3EFE9] text-[#22604F]' : 'bg-[#FFF6E5] text-[#7A520D]')}>
                  <span aria-hidden>{o.verif.complet ? '✓' : '!'}</span>{repereDeLObjectif(o.verif)}
                </span>
              ) : <span className="block text-[0.78rem] text-[#5E5C78]">{t.envoyeEnEntier}</span>}
            </span>
            <span aria-hidden>›</span>
          </span>
          {o.verif && (
            <span className="block text-[0.78rem] text-[#5E5C78] leading-relaxed">
              {o.verif.items.map((i, k) => (
                <span key={i.cle}>
                  {k > 0 && ' · '}
                  <span className={i.valeur === null ? 'font-bold text-[#7A520D]' : undefined}>{i.titre} : {i.valeur ?? t.sansValeur}</span>
                </span>
              ))}
            </span>
          )}
        </Link>
        {o.verif && gestesDeLObjectif(o.verif).length > 0 && (
          <div className="flex flex-wrap gap-2 px-3.5 pb-3.5">
            {gestesDeLObjectif(o.verif).map((g) => g === 'profil'
              ? <a key={g} href="#geste-profil" className={GESTE}>{t.modifierProfil}</a>
              : <Link key={g} href={`/app/coach/nouveau?athlete=${athleteId}&modifier=${o.planId}`} className={GESTE}>{g === 'trace' ? t.gesteTrace : t.gesteObjectif}</Link>)}
          </div>
        )}
        {o.courses && <CoursesDePreparation planId={o.planId} courses={o.courses} jour={jour} />}
        </div>
      ))}
    </Carte>
  );
}
