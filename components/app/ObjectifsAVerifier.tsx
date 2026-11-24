import Link from 'next/link';
import clsx from 'clsx';
import { Carte, PastilleDate, Surtitre } from './Ui';
import { repereDeLObjectif, TEXTES_PAGE_ATHLETE, type VerifObjectif } from '@/lib/app/pageAthleteSimple';

// « SES OBJECTIFS », SUR LA PAGE D'UN ATHLÈTE, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : seulement ce qui sert à vérifier que tout est rempli). Pour chaque objectif à
// venir : la course, sa date, un repère (« Complet » ou « Il manque : … ») et ce que le moteur lit : sa côte en minutes, ses deux critères, son tapis, la trace de sa course
// (lib/app/pageAthleteSimple.ts, verifierObjectif). Le lien vers la page de l'objectif reste ; les deux boutons « + Objectif » aussi. Ses courses de préparation et ses objectifs passés
// sont dans « Réglages ». Sous la 8.x, la page garde sa carte d'avant. verif : null pour un objectif envoyé en entier (il n'a pas de réponses à vérifier).
export type LigneObjectif = { planId: string; nom: string; date: string; principal: boolean; verif: VerifObjectif | null };
// jusquau : sa date de fin, écrite par la page (« 12 déc. »).
export type SaisonEnCours = { planId: string; nom: string; jusquau: string };

export default function ObjectifsAVerifier({ athleteId, lignes, saison }: { athleteId: string; lignes: LigneObjectif[]; saison: SaisonEnCours | null }) {
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
      {saison && (
        <Link href={`/app/coach/plan/${saison.planId}`} className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#E1EFEA] text-[#0B4A40]">
          <span className="flex-1 min-w-0">
            <span className="block text-[0.9375rem] font-bold">{saison.nom} · en cours</span>
            <span className="block text-[0.78rem]">Jusqu’au {saison.jusquau} · le moteur écrit ses semaines ; un objectif qui arrive prend la suite.</span>
          </span>
          <span aria-hidden>›</span>
        </Link>
      )}
      {lignes.length === 0 && <p className="text-sm text-[#4A4866]">{t.aucunObjectif}</p>}
      {lignes.map((o) => (
        <Link key={o.planId} href={`/app/coach/plan/${o.planId}`} className="block p-3.5 rounded-xl border border-indigo/[0.12] text-indigo space-y-2">
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
      ))}
    </Carte>
  );
}
