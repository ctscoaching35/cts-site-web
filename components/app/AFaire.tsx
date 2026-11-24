import Link from 'next/link';
import { Carte } from './Ui';
import { BOUTON_POINT, Geste, Regle } from './PointsCoach';
import type { LigneUrgente } from '@/lib/app/espaceParAthlete';
import { nombreAFaire, TEXTES_A_FAIRE, texteDesSeries } from '@/lib/app/espaceCoachSimple';

// « À FAIRE », EN HAUT DE « MES ATHLÈTES », SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : « un seul endroit pour ce qui est à faire ») :
// « Urgent » est fondu ici. Les mêmes points (espace.urgent), les mêmes gestes (Geste) et le même « Réglé » (Regle) qu'avant, une ligne par point,
// à la suite, sans les quatre groupes ; le nom ouvre la page de l'athlète. La ligne des séries du samedi à retirer de Nolio (entrée 198, lues par
// lib/app/espaceCoachSimple.ts) est la première quand il y en a : elle n'a pas de « Réglé », elle s'en va d'elle-même le week-end passé. Rien à faire : une ligne qui le dit.
// Un point n'est dit qu'ici : la colonne « Ce qui l'attend » du tableau, le bandeau du dimanche et le menu ne le redisent pas. Pour le téléphone d'abord.
export default function AFaire({ lignes, series }: { lignes: LigneUrgente[]; series: number }) {
  const n = nombreAFaire(lignes, series);
  if (n === 0) return <Carte id="a-faire" className="!p-5"><p className="text-sm text-teal font-semibold">{TEXTES_A_FAIRE.rien}</p></Carte>;
  const ligne = 'flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-3 border-t first:border-t-0 border-indigo/[0.07]';
  return (
    <Carte id="a-faire" className="!p-5 scroll-mt-6">
      <h2 className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-[#8A3326]">{TEXTES_A_FAIRE.titre} · {n}</h2>
      <ul className="mt-1">
        {series > 0 && (
          <li className={ligne}>
            <p className="min-w-0 flex-[1_1_300px] text-sm text-[#4A4866] leading-snug"><strong>{texteDesSeries(series)}</strong></p>
            <Link href="/app/coach/series-du-samedi" className={`${BOUTON_POINT} bg-white text-indigo border border-indigo/20 hover:bg-sand`}>Voir ›</Link>
          </li>
        )}
        {lignes.map(({ athleteId, nom, point }) => (
          <li key={point.cle} className={ligne}>
            <p className="min-w-0 flex-[1_1_300px] text-sm text-[#4A4866] leading-snug">
              <Link href={`/app/coach/athlete/${athleteId}`} className="font-bold text-indigo hover:underline">{nom}</Link>
              {' · '}{point.texte.charAt(0).toUpperCase()}{point.texte.slice(1)}
              {point.sous && <span className="block mt-0.5 text-xs text-[#5E5C78]">{point.sous}</span>}
            </p>
            {!point.sansGeste && (
              <div className="flex items-center gap-2">
                <Geste r={point} />
                <Regle cles={[point.cle]} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Carte>
  );
}
