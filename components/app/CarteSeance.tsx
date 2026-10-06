import { Fragment } from 'react';
import clsx from 'clsx';
import type { Jour } from '@/lib/app/plan';
import { ENCRE_LIBELLE, FAMILLES, PASTILLES } from '@/lib/app/charte';

// La carte d'une séance en codes, celle du PDF (décision coach du 01/10/2026, forme A) : en
// tête le terrain, la durée et la cible ; dessous Échauf., Corps, Retour, À retenir, Ravito.
// Le texte arrive traduit par le moteur (cts_notation) : l'app ne fait que le mettre en page.

const PUCE = '• ';
const MOTIFS = /(RPE \d+(?:-\d+)?|[↑↓])/g;

// Dans le corps, l'intensité visée saute aux yeux : RPE 4 et plus en gras (cts_base._rpe_en_gras) ;
// les flèches de montée et de descente en teal, comme sur le PDF.
function Ligne({ texte, corps }: { texte: string; corps: boolean }) {
  return (
    <>
      {texte.split(MOTIFS).map((m, i) => {
        if (m === '↑' || m === '↓')
          return (
            <span key={i} className="text-teal font-bold">
              {m}
            </span>
          );
        const rpe = /^RPE (\d+)/.exec(m);
        if (rpe && corps && Number(rpe[1]) >= 4) return <strong key={i}>{m}</strong>;
        return m;
      })}
    </>
  );
}

function Texte({ texte, corps }: { texte: string; corps: boolean }) {
  // Une phase par ligne (décision coach du 03/10/2026), marquée d'une puce par le moteur.
  return (
    <>
      {texte.split('\n').map((ligne, i) =>
        ligne.startsWith(PUCE) ? (
          <div key={i} className="flex gap-1.5">
            <span aria-hidden className="text-indigo/50">•</span>
            <span>
              <Ligne texte={ligne.slice(PUCE.length)} corps={corps} />
            </span>
          </div>
        ) : (
          <div key={i}>
            <Ligne texte={ligne} corps={corps} />
          </div>
        )
      )}
    </>
  );
}

export default function CarteSeance({ jour, titre = true }: { jour: Jour; titre?: boolean }) {
  const carte = jour.carte;
  const reperes: [string, string][] = [
    ...(jour.terrain_detail ? [['Terrain', jour.terrain_detail] as [string, string]] : []),
    ...(['Durée', 'Cible'] as const)
      .filter((k) => carte?.entete[k])
      .map((k) => [k, carte!.entete[k]] as [string, string]),
  ];
  return (
    <article className="bg-white border-l-4 shadow-sm" style={{ borderLeftColor: FAMILLES[jour.famille].filet }}>
      <div className="px-4 pt-4 pb-3">
        {titre && <h3 className="text-lg text-indigo leading-snug">{jour.seance}</h3>}
        {reperes.length > 0 && (
          <div className={clsx('flex flex-wrap gap-1.5', titre && 'mt-2')}>
            {reperes.map(([cle, valeur]) => (
              <span
                key={cle}
                className="text-xs font-semibold px-2 py-0.5 whitespace-nowrap"
                style={{ backgroundColor: PASTILLES[cle][0], color: PASTILLES[cle][1] }}
              >
                {valeur}
              </span>
            ))}
          </div>
        )}
      </div>
      {carte && carte.parties.length > 0 && (
        <dl className="grid grid-cols-[5.25rem_1fr] gap-x-3 gap-y-2.5 px-4 pb-4 text-[0.95rem] leading-relaxed">
          {carte.parties.map(([libelle, texte], i) =>
            libelle === null ? (
              <p key={i} className="col-span-2 text-indigo">
                {texte}
              </p>
            ) : (
              <Fragment key={i}>
                <dt
                  className="text-[0.68rem] font-bold uppercase tracking-cts-tight pt-1"
                  style={{ color: ENCRE_LIBELLE[libelle] ?? '#0C6E5F' }}
                >
                  {libelle}
                </dt>
                <dd className={clsx(libelle === 'À retenir' ? 'text-indigo/70 text-sm pt-0.5' : 'text-indigo')}>
                  <Texte texte={texte} corps={libelle === 'Corps' || libelle === ''} />
                </dd>
              </Fragment>
            )
          )}
        </dl>
      )}
    </article>
  );
}
