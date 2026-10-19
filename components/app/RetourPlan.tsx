import Link from 'next/link';
import { lien, type Contexte } from '@/lib/app/contexte';

export default function RetourPlan({ ctx }: { ctx: Contexte }) {
  return (
    <Link href={lien('/app/plan', ctx)} className="inline-flex items-center min-h-11 text-teal font-bold text-sm">
      ‹ Ton objectif
    </Link>
  );
}
