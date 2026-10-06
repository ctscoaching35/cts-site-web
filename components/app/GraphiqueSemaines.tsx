import type { Plan } from '@/lib/app/plan';
import { COULEURS_TYPE_SEMAINE } from '@/lib/app/charte';
import { lien, type Contexte } from '@/lib/app/contexte';

// « Ton plan en un coup d'œil » (cts_pdf_slim._graphique_macro_blocs) : une barre par semaine,
// sa hauteur le volume, sa couleur le type ; un trait entre deux blocs, l'étoile marque la
// course. Chaque barre mène à sa semaine ; celle du jour est soulignée.
const L = 240;
const H = 72;
const BAS = 64;

export default function GraphiqueSemaines({ plan, ctx }: { plan: Plan; ctx: Contexte }) {
  const semaines = plan.architecture.semaines;
  const pas = L / semaines.length;
  const pic = Math.max(...semaines.map((s) => s.volume_h));
  const echelle = (v: number) => (v / (pic * 1.15)) * (BAS - 4);
  const enCours = plan.semaines.find((s) => s.jours.some((j) => j.date_iso === ctx.jour))?.numero_int;
  const derniere = semaines[semaines.length - 1];
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label={plan.architecture.titre}>
      {semaines.map((s, i) => {
        const h = echelle(s.volume_h);
        const coupure = i > 0 && (semaines[i - 1].nature !== s.nature || semaines[i - 1].bloc !== s.bloc);
        return (
          <g key={s.numero}>
            {coupure && <line x1={i * pas} x2={i * pas} y1={0} y2={BAS} stroke="#C5D5D2" strokeWidth={0.8} />}
            <a href={lien('/app/calendrier', ctx, { s: `S${s.numero}` })}>
              <title>{`S${s.numero}`}</title>
              <rect
                x={i * pas + pas * 0.07}
                y={BAS - h}
                width={pas * 0.86}
                height={h}
                fill={COULEURS_TYPE_SEMAINE[s.type] ?? '#2F2D4E'}
              />
            </a>
            {s.numero === enCours && (
              <rect x={i * pas + pas * 0.07} y={BAS + 2.5} width={pas * 0.86} height={2} fill="#0C6E5F" />
            )}
          </g>
        );
      })}
      <text
        x={(semaines.length - 0.5) * pas}
        y={BAS - echelle(derniere.volume_h) - 2}
        textAnchor="middle"
        fontSize={8}
        fill="#2F2D4E"
      >
        ★
      </text>
    </svg>
  );
}
