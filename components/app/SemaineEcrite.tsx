import type { Semaine } from '@/lib/app/plan';
import { Surtitre } from './Ui';

// La semaine telle que le moteur l'a écrite et sa note « Ta semaine », rendues ici une seule fois : chez l'acheteur
// (SemaineQuiArrive) et dans l'aperçu avant paiement (components/plan/ApercuPlan.tsx), pour qu'ils se lisent pareil.

// La semaine telle que le moteur l'a écrite (l'aperçu, ou Nolio pas lu).
export function JoursEcrits({ semaine }: { semaine: Semaine }) {
  return (
    <ul className="divide-y divide-indigo/10 text-sm">
      {semaine.jours.map((j) => (
        <li key={j.id} className="flex gap-3 px-1 py-2">
          <span className="w-[4.6rem] shrink-0 text-xs text-indigo/55 pt-0.5">{j.date}</span>
          <span className={j.famille === 'repos' ? 'text-indigo/40' : 'text-indigo font-semibold'}>
            {j.nom ?? j.seance}
            {j.famille !== 'repos' && j.duree !== '—' && <span className="font-normal text-indigo/55"> · {j.duree}{j.rpe !== '—' ? ` · RPE ${j.rpe}` : ''}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function NoteDeLaSemaine({ titre, textes }: { titre: string; textes: string[] }) {
  if (!textes.length) return null;
  return (
    <details className="group bg-white rounded-2xl border border-indigo/[0.08] p-5">
      <summary className="cursor-pointer list-none min-h-8 flex items-center justify-between gap-3">
        <Surtitre as="div">{titre}</Surtitre>
        <span className="text-xs text-[#5E5C78] whitespace-nowrap">Ouvrir <span aria-hidden className="inline-block group-open:rotate-90">›</span></span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-[#3B3957] whitespace-pre-line">{textes.join(' ')}</p>
    </details>
  );
}

