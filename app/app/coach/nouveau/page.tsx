import Link from 'next/link';
import Questionnaire from '@/components/plan/Questionnaire';
import { exigerCoach } from '@/lib/app/nolio';
import { questionnairePrerempli } from '@/lib/app/coaching';
import { demandeDuCoach } from '@/lib/app/demandes';
import type { Recherche } from '@/lib/app/contexte';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Ajouter un athlète » (CTS_NOLIO_CADRAGE.md, N2) : le coach remplit le questionnaire à la place de son
// athlète ; le plan se génère sans paiement et rejoint son espace coach. « Nouvel objectif » (N9) : le même,
// prérempli avec les réponses du dernier objectif de l'athlète, sauf la course.
export default async function NouvelAthlete({ searchParams }: { searchParams: Recherche }) {
  const coach = await exigerCoach();
  const r = await searchParams;
  const suite = typeof r.athlete === 'string' ? await questionnairePrerempli(coach.compteId, r.athlete) : null;
  // OM1 : l'objectif demandé par le coaché, ses réponses à relire ; sa trace part avec la demande.
  const demande = suite && typeof r.demande === 'string' ? await demandeDuCoach(coach.compteId, r.demande) : null;
  return (
    <div className="min-h-screen bg-sand">
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <Link href={suite ? `/app/coach/athlete/${suite.athlete.id}` : '/app/coach'} className="text-teal font-semibold text-sm">
          ‹ {suite ? suite.athlete.nom : 'Espace coach'}
        </Link>
        <div className="my-6 px-2">
          <div className="eyebrow text-teal mb-3">Athlète coaché</div>
          <h1 className="text-3xl sm:text-4xl text-indigo leading-tight">{suite ? `Nouvel objectif pour ${suite.athlete.nom}` : 'Ajouter un athlète'}</h1>
          <p className="text-indigo/70 mt-2">
            {demande
              ? `Sa demande du ${new Date(demande.cree_le).toLocaleDateString('fr-FR')} : relis ses réponses, corrige si besoin, et lance l’objectif.${demande.gpx_chemin ? ' Sa trace part avec la demande.' : ''}`
              : suite?.nolio
              ? 'Ses réponses du dernier objectif sont reprises, et sa charge du moment est lue dans ses séances Nolio (volume et plus longue sortie des 4 dernières semaines, arrêt sur 2 mois) : relis-la, et saisis la course.'
              : suite
              ? 'Ses réponses du dernier objectif sont reprises : mets à jour sa charge du moment et saisis la course.'
              : 'Remplis le questionnaire avec ses réponses. Le plan se génère sans paiement et rejoint ton espace coach.'}
          </p>
        </div>
        <Questionnaire coach emailCoach={coach.email} athleteId={suite?.athlete.id} demandeId={demande?.id}
          initial={demande ? { ...demande.champs, nom: suite?.athlete.nom ?? '' } : suite?.initial} />
      </main>
    </div>
  );
}
