import { COULEURS_PENTE } from '@/lib/app/charte';

// La répartition des pentes (cts_pdf_slim._barres_distribution_pentes) : de la descente raide
// à la montée raide, une barre par catégorie, le pourcentage après la barre.
export default function RepartitionPentes({ pentes }: { pentes: [string, string, number][] }) {
  return (
    <ul className="space-y-1.5">
      {pentes.map(([cle, libelle, pct]) => (
        <li key={cle} className="grid grid-cols-[9.5rem_1fr] items-center gap-2 text-xs text-indigo/80">
          <span>{libelle}</span>
          <span className="flex items-center gap-1.5">
            <span className="h-3" style={{ width: `${Math.max(pct, 0.5) * 0.85}%`, backgroundColor: COULEURS_PENTE[cle] }} />
            <span className="tabular-nums">{Math.round(pct)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
