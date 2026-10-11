import Link from 'next/link';
import Questionnaire from '@/components/plan/Questionnaire';
import { exigerCoach } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Ajouter un athlète » (CTS_NOLIO_CADRAGE.md, N2) : le coach remplit le questionnaire à la place de son
// athlète ; le plan se génère sans paiement et rejoint son espace coach.
export default async function NouvelAthlete() {
  await exigerCoach();
  return (
    <div className="min-h-screen bg-sand">
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <Link href="/app/coach" className="text-teal font-semibold text-sm">‹ Espace coach</Link>
        <div className="my-6 px-2">
          <div className="eyebrow text-teal mb-3">Athlète coaché</div>
          <h1 className="text-3xl sm:text-4xl text-indigo leading-tight">Ajouter un athlète</h1>
          <p className="text-indigo/70 mt-2">Remplis le questionnaire avec ses réponses. Le plan se génère sans paiement et rejoint ton espace coach.</p>
        </div>
        <Questionnaire coach />
      </main>
    </div>
  );
}
