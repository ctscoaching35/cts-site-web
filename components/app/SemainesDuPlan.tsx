import clsx from 'clsx';
import type { LigneTrame } from '@/lib/app/ecriture';
import { BANNIERE } from '@/lib/app/charte';
import { nomAffiche } from '@/lib/app/nomsSeances';
import { ajouterJours } from '@/lib/app/plan';
import { enHeures, momentDe } from '@/lib/app/tableau';
import { contientLaCourse, typeEnClair } from './TableauDeBord';
import { Carte, Surtitre } from './Ui';

// S16 (décision coach du 05/11/2026, « A » ; audit G-21, E6) : la trame promise par les CGV, dans « Ta préparation » de
// l'acheteur : une liste dépliable de ses semaines, chacune avec son type, son volume, ses séances clés et son week-end
// choc. Tout vient de la trame du moteur (POST /v1/trame, gardée avec le plan) ; la semaine en cours s'ouvre d'elle-même.
// Les séances détaillées vivent dans Nolio et s'ajustent chaque dimanche : la liste le dit (C24 : seulement ici).
// Revue après les audits du 05/11/2026 :
// - Q6-c (décision coach du 05/11/2026 au soir, « A ») : les semaines passées repliées sous une ligne (« 14 semaines
//   faites › ») ; après la course, toute la liste (« Revoir tes 24 semaines › ») ;
// - C3 : une semaine passée porte une coche, au lieu d'être pâlie ;
// - C13 : la semaine de la course s'appelle « Semaine de course », « + ta course » à côté du volume ;
// - C24 : « en cours » en pastille sous le titre ; C4 : ses dates en « 22 mars – 28 mars ».
const JOUR = (j: string) => (j ? j[0].toUpperCase() + j.slice(1).toLowerCase() : j);
const jourEtMois = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(/^1 /, '1er ');

export default function SemainesDuPlan({ trame, jour, course }: { trame: LigneTrame[]; jour: string; course: string }) {
  const semaines = trame.filter((l) => l.lundi);
  if (!semaines.length) return null;
  const passees = semaines.filter((l) => momentDe(l.lundi, jour) === 'passee');
  const suite = semaines.filter((l) => momentDe(l.lundi, jour) !== 'passee');
  const apresLaCourse = course < jour;
  const ligne = (l: LigneTrame) => {
    const moment = momentDe(l.lundi, jour);
    const sl = l.seances_cles.filter((s) => s.famille === 'sl');
    const cles = l.seances_cles.filter((s) => s.famille !== 'sl');
    const deCourse = contientLaCourse(l.lundi, course);
    return (
      <li key={l.numero} className="border-t border-indigo/[0.06] first:border-t-0">
        <details open={moment === 'encours'} className="group">
          <summary className="cursor-pointer list-none min-h-11 py-2.5 flex items-center justify-between gap-3">
            <span className="min-w-0 flex items-start gap-2">
              {moment === 'passee' && (
                <svg viewBox="0 0 24 24" className="mt-0.5 w-4 h-4 shrink-0" fill="none" stroke="#0C6E5F" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5 10 17 19 7" />
                </svg>
              )}
              <span className="min-w-0">
                <span className="block text-sm font-bold text-indigo">
                  Semaine {l.numero.replace('S', '')}<span className="sr-only">{moment === 'passee' ? ', faite' : moment === 'encours' ? ', en cours' : ''}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs text-[#5E5C78]">{jourEtMois(l.lundi)} – {jourEtMois(ajouterJours(l.lundi, 6))}</span>
                  {moment === 'encours' && <span className="text-[0.6875rem] font-bold text-white bg-teal-dark rounded-full px-2 py-0.5 whitespace-nowrap">en cours</span>}
                </span>
              </span>
            </span>
            <span className="shrink-0 flex items-center gap-2 text-xs font-semibold">
              <span style={{ color: deCourse ? '#0C6E5F' : BANNIERE[l.type] ?? '#4F6F69' }}>{deCourse ? 'Semaine de course' : typeEnClair(l.type)}</span>
              <span className="text-indigo tabular-nums whitespace-nowrap">{enHeures(Math.round(l.volume_h * 60))}{deCourse ? ' + ta course' : ''}</span>
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
                  <li key={`${s.jour}-${i}`}><span className="font-semibold text-indigo">{JOUR(s.jour)}</span> · {nomAffiche(s.seance)}</li>
                ))}
              </ul>
            ) : <p>Pas de séance clé : une semaine d’endurance.</p>}
            {!l.week_end_choc && sl.length > 0 && (
              <p><span className="font-semibold text-indigo">{JOUR(sl[0].jour)}</span> · {nomAffiche(sl[0].seance)}</p>
            )}
            {l.sl_min ? <p className="text-xs text-[#5E5C78]">Sortie longue : {enHeures(l.sl_min)}{l.week_end_choc ? ' au plus long des deux jours' : ''}.</p> : null}
          </div>
        </details>
      </li>
    );
  };
  const repliees = (liste: LigneTrame[], titre: string) => (
    <li className="border-t border-indigo/[0.06] first:border-t-0">
      <details className="group/faites">
        <summary className="cursor-pointer list-none min-h-11 py-2.5 flex items-center justify-between gap-3 text-sm font-bold text-teal">
          <span>{titre}</span><span aria-hidden className="inline-block group-open/faites:rotate-90">›</span>
        </summary>
        <ul className="pb-1">{liste.map(ligne)}</ul>
      </details>
    </li>
  );
  return (
    <Carte className="!pb-2">
      <Surtitre>Tes semaines, une à une</Surtitre>
      <p className="mt-1 mb-2 text-xs text-[#5E5C78] leading-relaxed">
        Pour chaque semaine, son type, son volume et ses séances clés. Tes séances détaillées s’écrivent chaque dimanche dans
        Nolio, d’après ta semaine écoulée : elles peuvent s’en écarter un peu.
      </p>
      <ul className={clsx(apresLaCourse && 'pb-1')}>
        {/* BROUILLON, à valider par le coach (les deux lignes repliées). */}
        {apresLaCourse ? repliees(semaines, `Revoir tes ${semaines.length} semaines`) : (
          <>
            {passees.length > 0 && repliees(passees, `${passees.length} semaine${passees.length > 1 ? 's' : ''} faite${passees.length > 1 ? 's' : ''}`)}
            {suite.map(ligne)}
          </>
        )}
      </ul>
    </Carte>
  );
}
