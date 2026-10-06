import Link from 'next/link';
import { lien, type Contexte } from '@/lib/app/contexte';

export default function RetourPlan({ ctx }: { ctx: Contexte }) {
  return (
    <Link href={lien('/app/plan', ctx)} className="text-teal font-semibold text-sm">
      ‹ Mon plan
    </Link>
  );
}
