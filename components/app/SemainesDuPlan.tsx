import clsx from 'clsx';
import type { LigneTrame } from '@/lib/app/ecriture';
import { BANNIERE } from '@/lib/app/charte';
import { enHeures, momentDe } from '@/lib/app/tableau';
import { typeEnClair } from './TableauDeBord';
import { Carte, Surtitre } from './Ui';

// S16 (décision coach du 05/11/2026, « A » ; audit G-21, E6) : la trame promise par les CGV, dans « Mon plan » de
// l'acheteur : une liste dépliable de ses semaines, chacune avec son type, son volume, ses séances clés et son week-end
// choc. Tout vient de la trame du moteur (POST /v1/trame, gardée avec le plan) ; la semaine en cours s'ouvre d'elle-même.
// Les séances détaillées vivent dans Nolio et s'ajustent chaque dimanche : la liste le dit.
const JOUR = (j: string) => (j ? j[0].toUpperCase() + j.slice(1).toLowerCase() : j);

export default function SemainesDuPlan({ trame, jour }: { trame: LigneTrame[]; jour: string }) {
  const semaines = trame.filter((l) => l.lundi);
  if (!semaines.length) return null;
  return (
    <Carte className="!pb-2">
      <Surtitre>Tes semaines, une à une</Surtitre>
      <p className="mt-1 mb-2 text-xs text-[#5E5C78] leading-relaxed">
        Pour chaque semaine, son type, son volume et ses séances clés. Tes séances détaillées s’écrivent chaque dimanche dans
        Nolio, d’après ta semaine écoulée : elles peuvent s’en écarter un peu.
      </p>
      <ul>
        {semaines.map((l) => {
          const moment = momentDe(l.lundi, jour);
          const sl = l.seances_cles.filter((s) => s.famille === 'sl');
          const cles = l.seances_cles.filter((s) => s.famille !== 'sl');
          return (
            <li key={l.numero} className="border-t border-indigo/[0.06] first:border-t-0">
              <details open={moment === 'encours'} className="group">
                <summary className={clsx('cursor-pointer list-none min-h-11 py-2.5 flex items-center justify-between gap-3',
                  moment === 'passee' && 'opacity-60')}>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-indigo">
                      Semaine {l.numero.replace('S', '')}
                      {moment === 'encours' && <span className="ml-2 text-[0.6875rem] font-bold text-teal-dark">en cours</span>}
                    </span>
                    <span className="block text-xs text-[#5E5C78]">{l.dates}</span>
                  </span>
                  <span className="shrink-0 flex items-center gap-2 text-xs font-semibold">
                    <span style={{ color: BANNIERE[l.type] ?? '#4F6F69' }}>{typeEnClair(l.type)}</span>
                    <span className="text-indigo tabular-nums">{enHeures(Math.round(l.volume_h * 60))}</span>
                    <span aria-hidden className="text-[#5E5C78] inline-block group-open:rotate-90">›</span>
                  </span>
                </summary>
                <div className="pb-3 pl-0.5 space-y-1.5 text-[0.8125rem] text-[#3B3957] leading-snug">
                  <p className="text-xs text-[#5E5C78]">{l.bloc}</p>
                  {l.week_end_choc && (
                    <p><span className="font-bold text-indigo">Week-end choc</span> : deux sorties longues de suite
                      {sl.length >= 2 ? `, ${sl.map((s) => JOUR(s.jour).toLowerCase()).join(' et ')}` : ''}, annoncées d’avance.</p>
                  )}
                  {cles.length > 0 ? (
                    <ul className="space-y-0.5">
                      {cles.map((s, i) => (
                        <li key={`${s.jour}-${i}`}><span className="font-semibold text-indigo">{JOUR(s.jour)}</span> · {s.seance}</li>
                      ))}
                    </ul>
                  ) : <p>Pas de séance clé : une semaine d’endurance.</p>}
                  {!l.week_end_choc && sl.length > 0 && (
                    <p><span className="font-semibold text-indigo">{JOUR(sl[0].jour)}</span> · {sl[0].seance}</p>
                  )}
                  {l.sl_min ? <p className="text-xs text-[#5E5C78]">Sortie longue : {enHeures(l.sl_min)}{l.week_end_choc ? ' au plus long des deux jours' : ''}.</p> : null}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}
