import clsx from 'clsx';
import type { LigneTrame, Realise } from '@/lib/app/ecriture';
import { BANNIERE } from '@/lib/app/charte';
import { nomAffiche } from '@/lib/app/nomsSeances';
import { ajouterJours } from '@/lib/app/plan';
import { detailDeLaSemaine, enHeures, environ } from '@/lib/app/tableau';
import type { SemaineDetaillee } from '@/lib/app/tableauDuPlan';
import { contientLaCourse, typeEnClair } from './TableauDeBord';
import { Carte, Surtitre } from './Ui';

// S16 (décision coach du 05/11/2026, « A » ; audit G-21, E6) : la trame promise par les CGV, dans « Ta préparation » : une
// liste de ses semaines. Revue après les audits du 05/11/2026 :
// - Q6-c (décision coach du 05/11/2026 au soir, « A ») : les semaines passées repliées sous une ligne (« 14 semaines
//   faites › ») ; après la course, toute la liste (« Revoir tes 24 semaines › ») ;
// - C3 : une semaine passée porte une coche, au lieu d'être pâlie ;
// - C13 : la semaine de la course s'appelle « Semaine de course », « + ta course » à côté du volume ;
// - C24 : « en cours » en pastille sous le titre ; C4 : ses dates en « 22 mars – 28 mars ».
// Le 07/11/2026 (décision coach), pour les deux versions :
// - une semaine faite, telle qu'elle a été faite (realises : ses séances faites, sa durée, sa sortie longue, lues dans
//   Nolio et rangées chaque dimanche) ; sans rien de lu, son type seul ;
// - la semaine en cours, telle qu'elle est dans Nolio (lib/app/tableauDuPlan.ts, semainesDetaillees : la lecture de
//   « Ta semaine » de l'accueil) ; la suivante aussi une fois écrite le dimanche soir, sinon prévue (la trame : ses
//   séances clés et son week-end choc), avec sa mention ;
// - au-delà, son type et son volume à la demi-heure près, sans séances ni détail ;
// - « week-end choc » sur les semaines à venir qui en ont un ; une phrase sous la liste.
// depuis : un coaché qui a rejoint la préparation en route, son lundi d'arrivée, comme ses blocs.
const JOUR = (j: string) => (j ? j[0].toUpperCase() + j.slice(1).toLowerCase() : j);
const jourEtMois = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(/^1 /, '1er ');
const jourDeLaDate = (iso: string) => JOUR(new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' }));
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export default function SemainesDuPlan({ trame, jour, course, realises = [], encours = null, suivante = null, depuis = null }: {
  trame: LigneTrame[]; jour: string; course: string; realises?: Realise[]; encours?: SemaineDetaillee; suivante?: SemaineDetaillee;
  depuis?: string | null;
}) {
  const semaines = trame.filter((l) => l.lundi && (!depuis || l.lundi >= depuis));
  if (!semaines.length) return null;
  const faites = new Map(realises.map((r) => [r.lundi, r]));
  const passees = semaines.filter((l) => detailDeLaSemaine(l.lundi, jour) === 'faite');
  const suite = semaines.filter((l) => detailDeLaSemaine(l.lundi, jour) !== 'faite');
  const apresLaCourse = course < jour;

  // Les séances d'une semaine détaillée (Nolio, ou la semaine écrite par le moteur).
  const seances = (s: SemaineDetaillee) => (s === 'dans_nolio' ? <p>Tes séances de la semaine sont dans Nolio.</p>
    : s && !s.seances.length ? <p>Rien de prévu dans Nolio cette semaine.</p>
    : s ? (
      <ul className="space-y-0.5">
        {s.seances.map((x) => (
          <li key={x.cle}>
            <span className="font-semibold text-indigo">{x.date ? jourDeLaDate(x.date) : JOUR(x.jour)}</span> · {nomAffiche(x.nom)}
            {x.minutes ? <span className="text-[#5E5C78]"> · {enHeures(x.minutes)}</span> : null}
          </li>
        ))}
      </ul>
    ) : null);
  // Une semaine prévue : ce que la trame en dit (son week-end choc, ses séances clés, sa sortie longue).
  const prevue = (l: LigneTrame) => {
    const sl = l.seances_cles.filter((s) => s.famille === 'sl');
    const cles = l.seances_cles.filter((s) => s.famille !== 'sl');
    return (
      <>
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
      </>
    );
  };
  // Une semaine faite : ce qui en a été lu dans Nolio.
  const faite = (r: Realise) => (
    <>
      <p>
        {r.seances_prevues > 0 ? `${pluriel(r.seances_faites, 'séance')} faite${r.seances_faites > 1 ? 's' : ''} sur ${r.seances_prevues}`
          : `${pluriel(r.seances_faites, 'séance')} faite${r.seances_faites > 1 ? 's' : ''}`}
        {r.duree_faite_min > 0 ? ` · ${enHeures(r.duree_faite_min)} de course` : ''}
      </p>
      {r.sl_faite_min ? <p className="text-xs text-[#5E5C78]">Sortie longue : {enHeures(r.sl_faite_min)}.</p> : null}
    </>
  );

  const ligne = (l: LigneTrame) => {
    const detail = detailDeLaSemaine(l.lundi, jour);
    const r = detail === 'faite' ? faites.get(l.lundi) ?? null : null;
    const deCourse = contientLaCourse(l.lundi, course);
    const lue = detail === 'encours' ? encours : detail === 'suivante' ? suivante : null;
    // Le volume : fait, pour une semaine faite ; à la demi-heure près, au-delà de la semaine suivante.
    const volume = detail === 'faite' ? (r ? enHeures(r.duree_faite_min) : null)
      : detail === 'resumee' ? environ(Math.round(l.volume_h * 60)) : enHeures(Math.round(l.volume_h * 60));
    const corps = detail === 'faite' ? (r ? faite(r) : null)
      : detail === 'resumee' ? null
      : (
        <>
          {detail === 'suivante' && !lue && (
            // La mention de la semaine suivante, mot pour mot celle de la décision coach du 07/11/2026 (à valider).
            <p className="text-xs font-semibold text-[#8A5E10]">Prévue : elle s’écrit dimanche d’après ton questionnaire.</p>
          )}
          <p className="text-xs text-[#5E5C78]">{l.bloc}</p>
          {lue ? seances(lue) : prevue(l)}
        </>
      );
    const titre = (
      <span className="min-w-0 flex-1 flex items-start gap-2">
        {detail === 'faite' && (
          <svg viewBox="0 0 24 24" className="mt-0.5 w-4 h-4 shrink-0" fill="none" stroke="#0C6E5F" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5 10 17 19 7" />
          </svg>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-indigo whitespace-nowrap">
            Semaine {l.numero.replace('S', '')}<span className="sr-only">{detail === 'faite' ? ', faite' : detail === 'encours' ? ', en cours' : ''}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs text-[#5E5C78]">{jourEtMois(l.lundi)} – {jourEtMois(ajouterJours(l.lundi, 6))}</span>
            {detail === 'encours' && <span className="text-[0.6875rem] font-bold text-white bg-teal-dark rounded-full px-2 py-0.5 whitespace-nowrap">en cours</span>}
          </span>
        </span>
      </span>
    );
    const droite = (
      <span className="shrink-0 max-w-[52%] flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-right text-xs font-semibold">
        <span style={{ color: deCourse ? '#0C6E5F' : BANNIERE[l.type] ?? '#4F6F69' }}>{deCourse ? 'Semaine de course' : typeEnClair(l.type)}</span>
        {l.week_end_choc && detail !== 'faite' && detail !== 'encours' && <span className="text-indigo whitespace-nowrap">· week-end choc</span>}
        {volume && (
          <span className="text-indigo tabular-nums whitespace-nowrap">
            · {volume}{deCourse && detail !== 'faite' ? ' + ta course' : ''}
          </span>
        )}
        {corps && <span aria-hidden className="text-[#5E5C78] inline-block group-open:rotate-90">›</span>}
      </span>
    );
    return (
      <li key={l.numero} className="border-t border-indigo/[0.06] first:border-t-0">
        {corps ? (
          <details open={detail === 'encours'} className="group">
            <summary className="cursor-pointer list-none min-h-11 py-2.5 flex items-center justify-between gap-3">{titre}{droite}</summary>
            <div className="pb-3 pl-0.5 space-y-1.5 text-[0.8125rem] text-[#3B3957] leading-snug">{corps}</div>
          </details>
        ) : (
          <div className="min-h-11 py-2.5 flex items-center justify-between gap-3">{titre}{droite}</div>
        )}
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
      <ul className={clsx('mt-1', apresLaCourse && 'pb-1')}>
        {/* Validé par le coach le 05/11/2026 (1A ; les deux lignes repliées). */}
        {apresLaCourse ? repliees(semaines, `Revoir tes ${semaines.length} semaines`) : (
          <>
            {passees.length > 0 && repliees(passees, `${passees.length} semaine${passees.length > 1 ? 's' : ''} faite${passees.length > 1 ? 's' : ''}`)}
            {suite.map(ligne)}
          </>
        )}
      </ul>
      {/* La phrase sous la liste, mot pour mot celle de la décision coach du 07/11/2026 (à valider). */}
      {suite.some((l) => detailDeLaSemaine(l.lundi, jour) !== 'encours') && (
        <p className="mt-1 mb-1 text-xs text-[#5E5C78] leading-relaxed">
          Les semaines à venir s’écrivent chaque dimanche d’après tes réponses : leur contenu peut changer.
        </p>
      )}
    </Carte>
  );
}
