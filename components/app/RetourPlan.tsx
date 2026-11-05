import Link from 'next/link';
import { lien, type Contexte } from '@/lib/app/contexte';

// Le retour des pages filles de « Ta préparation » (Q3, décision coach du 05/11/2026 au soir : un seul nom).
export default function RetourPlan({ ctx }: { ctx: Contexte }) {
  return (
    <Link href={lien('/app/plan', ctx)} className="inline-flex items-center min-h-11 text-teal font-bold text-sm">
      ‹ Ta préparation
    </Link>
  );
}
