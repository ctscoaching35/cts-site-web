import clsx from 'clsx';
import { Carte } from './Ui';
import { lienNolioAthlete } from '@/lib/app/liensNolio';
import type { PointLu } from '@/lib/app/pointALaMain';
import { dateLongue } from '@/lib/app/plan';

// SON POINT DU DIMANCHE, SUR LA PAGE D'UN COACHÉ PROGRAMMÉ À LA MAIN (demande du coach du 26/11/2026 : « je m'appuie dessus pour leur programmation ») : sa dernière réponse des 10 derniers jours, lue dans Nolio à
// l'ouverture de la page. Un arrêt se voit en premier. Textes lus par le coach seul.
const CAUSE = { blessure: 'blessure', maladie: 'maladie', autre: 'autre raison' } as const;

export default function PointDuDimancheALaMain({ point, usr }: { point: PointLu | null | 'illisible'; usr: string }) {
  const titre = <h2 className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-teal">Son point du dimanche</h2>;
  if (point === 'illisible') return <Carte className="!p-5 space-y-1">{titre}<p className="text-sm text-[#4A4866]">Nolio ne répond pas : recharge la page dans un instant.</p></Carte>;
  if (!point) return <Carte className="!p-5 space-y-1">{titre}<p className="text-sm text-[#4A4866]">Pas de réponse ces 10 derniers jours.</p></Carte>;
  const r = point.reponses;
  const semaines = r.semaines_arret ? (r.semaines_arret === 5 ? 'plus de 4 semaines' : `${r.semaines_arret} semaine${r.semaines_arret > 1 ? 's' : ''}`) : null;
  const arret = r.arret === 'semaine' ? `toute la semaine${semaines ? `, depuis ${semaines}` : ''}` : r.arret === 'quelques_jours' ? 'quelques jours' : r.arret === 'non' ? 'aucun' : null;
  const lignes: [string, string | null][] = [
    ['Jours', r.jours?.length ? r.jours.join(', ') : null],
    ['Séances', r.nb_seances ? String(r.nb_seances) : null],
    ['Sortie longue', r.jour_sl ?? null],
  ];
  return (
    <Carte className="!p-5 space-y-2">
      {titre}
      <p className="text-xs text-[#5E5C78]">Répondu le {dateLongue(point.date)}.</p>
      {arret && (
        <p className={clsx('text-sm font-semibold', r.arret === 'non' ? 'text-[#4A4866]' : 'text-[#8A3326]')}>
          Arrêt : {arret}{r.cause ? ` · ${CAUSE[r.cause]}` : ''}
        </p>
      )}
      <dl className="text-sm text-indigo">
        {lignes.filter(([, v]) => v).map(([t, v]) => (
          <div key={t} className="grid grid-cols-[112px_1fr] gap-x-3 py-1"><dt className="font-semibold text-[#5E5C78]">{t}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {point.mot && <a href={lienNolioAthlete(usr)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 text-sm font-bold text-teal">Un mot pour toi, à lire dans Nolio ›</a>}
    </Carte>
  );
}
