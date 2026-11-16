import Link from 'next/link';
import clsx from 'clsx';
import { lien, type Contexte } from '@/lib/app/contexte';

// Le sélecteur de l'onglet Plan (maquette de l'app payante, Plan.dc.html et Suivi.dc.html, 16/11/2026) : « Ta préparation »
// (/app/plan) et « Tes données » (/app/donnees), deux écrans d'un même onglet ; l'onglet Plan reste allumé sur les deux.
// Les paramètres de la démonstration suivent (lien).
export type EcranPlan = 'preparation' | 'donnees';
export default function SelecteurPlan({ actif, ctx }: { actif: EcranPlan; ctx: Contexte }) {
  const ecrans: { cle: EcranPlan; titre: string; chemin: string }[] = [
    { cle: 'preparation', titre: 'Ta préparation', chemin: '/app/plan' },
    { cle: 'donnees', titre: 'Tes données', chemin: '/app/donnees' },
  ];
  return (
    <nav aria-label="Ton plan" className="grid grid-cols-2 gap-1 bg-sand-dark rounded-xl p-1">
      {ecrans.map((e) => (
        <Link key={e.cle} href={lien(e.chemin, ctx)} aria-current={e.cle === actif ? 'page' : undefined}
          className={clsx('flex items-center justify-center min-h-11 rounded-[9px] text-[0.8125rem] text-center',
            e.cle === actif ? 'bg-white text-indigo font-extrabold shadow-sm' : 'text-[#5E5C78] font-bold')}>
          {e.titre}
        </Link>
      ))}
    </nav>
  );
}
