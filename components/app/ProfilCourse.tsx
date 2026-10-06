import type { Plan } from '@/lib/app/plan';
import { COULEURS_PENTE } from '@/lib/app/charte';

// Le profil de la course (cts_pdf_slim._graphique_profil_fin) : l'altitude, chaque plage
// colorée par sa catégorie de pente, une ligne par-dessus. Sans profil fin, les secteurs en
// dénivelé cumulé (_graphique_profil). Dessiné depuis les points du moteur, jamais une image.
const L = 340;
const H = 150;
const G = 34; // marge gauche (altitudes)
const B = 18; // marge basse (kilomètres)

function graduations(total: number) {
  const pas = total > 60 ? 20 : total > 25 ? 10 : 5;
  return Array.from({ length: Math.floor(total / pas) + 1 }, (_, i) => i * pas);
}

export default function ProfilCourse({ points }: { points: NonNullable<Plan['profil']['points']> }) {
  let km: number[];
  let alt: number[];
  let plages: [number, number, string][];
  let titreAxe = 'Altitude (m)';
  if (points.altitude_m && points.plages) {
    alt = points.altitude_m;
    km = points.km ?? alt.map((_, i) => i * (points.pas_km ?? 0));
    plages = points.plages;
  } else if (points.secteurs) {
    // Repli : dénivelé cumulé depuis le départ, secteur par secteur.
    km = [0];
    alt = [0];
    plages = [];
    for (const s of points.secteurs) {
      km.push(km[km.length - 1] + s.distance_km);
      alt.push(alt[alt.length - 1] + s.dplus_m - s.dmoins_m);
      plages.push([km.length - 2, km.length - 1, s.categorie]);
    }
    titreAxe = 'Dénivelé cumulé (m)';
  } else {
    return null;
  }
  const total = km[km.length - 1] || 1;
  const bas = Math.min(...alt);
  const haut = Math.max(...alt);
  const marge = (haut - bas) * 0.08 + 1;
  const x = (k: number) => G + (k / total) * (L - G - 4);
  const y = (a: number) => 6 + (1 - (a - (bas - marge)) / (haut + marge - (bas - marge))) * (H - B - 6);
  // Assez de points pour l'œil, pas plus : un ultra en a plus de 11 000.
  const pas = Math.max(1, Math.ceil(alt.length / 700));
  const indices = (i0: number, i1: number) => {
    const r: number[] = [];
    for (let i = i0; i < i1; i += pas) r.push(i);
    r.push(i1);
    return r;
  };
  const fond = y(bas - marge);
  const ligne = indices(0, alt.length - 1).map((i) => `${x(km[i]).toFixed(1)},${y(alt[i]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label="Profil de la course">
      {plages.map(([i0, i1, cat], k) => (
        <polygon
          key={k}
          fill={COULEURS_PENTE[cat] ?? '#E3DCC4'}
          points={[
            `${x(km[i0]).toFixed(1)},${fond.toFixed(1)}`,
            ...indices(i0, i1).map((i) => `${x(km[i]).toFixed(1)},${y(alt[i]).toFixed(1)}`),
            `${x(km[i1]).toFixed(1)},${fond.toFixed(1)}`,
          ].join(' ')}
        />
      ))}
      <polyline points={ligne} fill="none" stroke="#1A1A1A" strokeWidth={1} strokeLinejoin="round" />
      <line x1={G} x2={L - 4} y1={H - B} y2={H - B} stroke="#8A8898" strokeWidth={0.5} />
      {graduations(total).map((k) => (
        <text key={k} x={x(k)} y={H - B + 10} fontSize={7} fill="#8A8898" textAnchor="middle">
          {k}
        </text>
      ))}
      <text x={L - 4} y={H - 2} fontSize={7} fill="#1A1A1A" textAnchor="end">Distance (km)</text>
      <text x={G - 3} y={y(haut) + 3} fontSize={7} fill="#8A8898" textAnchor="end">{Math.round(haut)}</text>
      <text x={G - 3} y={y(bas) + 3} fontSize={7} fill="#8A8898" textAnchor="end">{Math.round(bas)}</text>
      <text x={4} y={8} fontSize={7} fill="#1A1A1A">{titreAxe}</text>
    </svg>
  );
}
