import Link from 'next/link';
import { ReessayerSemaine } from './GestesEcriture';
import { marquerRegle } from '@/lib/app/actionsCoaching';
import type { Point } from '@/lib/app/espaceParAthlete';

// Le geste et « Réglé » d'un point (venus de « Cette semaine », 04/11/2026) : dans « Urgent » (une ligne par point, Q8) et
// dans « À faire pour lui » sur la page de l'athlète.
export const BOUTON_POINT = 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl text-[0.8125rem] font-bold whitespace-nowrap';

export function Geste({ r, plein = false }: { r: Point; plein?: boolean }) {
  const style = plein ? `${BOUTON_POINT} bg-teal text-white` : `${BOUTON_POINT} bg-white text-indigo border border-indigo/20 hover:bg-sand`;
  if (r.sansGeste) return null;
  if (r.genre === 'semaine' && r.planId) return <ReessayerSemaine planId={r.planId} />;
  if (r.externe) return <a href={r.href} target="_blank" rel="noopener" className={style}>{r.action}</a>;
  return <Link href={r.href} className={style}>{r.action}</Link>;
}

// « Réglé » (décision coach du 24/10/2026) : ce point-là ne revient jamais ; un nouveau point du même genre s'affiche.
export function Regle({ cles }: { cles: string[] }) {
  return (
    <form action={marquerRegle.bind(null, cles)}>
      <button type="submit" className={`${BOUTON_POINT} text-[#5E5C78] hover:text-indigo hover:bg-sand`}>Réglé</button>
    </form>
  );
}
