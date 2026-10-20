import Link from 'next/link';
import CadreCoach from '@/components/app/CadreCoach';
import Questionnaire from '@/components/plan/Questionnaire';
import { exigerCoach } from '@/lib/app/nolio';
import { questionnairePrerempli } from '@/lib/app/coaching';
import { demandeDuCoach } from '@/lib/app/demandes';
import type { Recherche } from '@/lib/app/contexte';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Ajouter un athlète » (CTS_NOLIO_CADRAGE.md, N2) : le coach remplit le questionnaire à la place de son
// athlète ; le plan se génère sans paiement et rejoint son espace coach. « Nouvel objectif » (N9, PO1, PO2) : le
// questionnaire court, son profil repris du dernier objectif ; seules sa charge du moment (préremplie depuis Nolio) et
// la course se demandent. Une course de préparation s'ajoute à son objectif en cours.
export default async function NouvelAthlete({ searchParams }: { searchParams: Recherche }) {
  const coach = await exigerCoach();
  const r = await searchParams;
  const suite = typeof r.athlete === 'string' ? await questionnairePrerempli(coach.compteId, r.athlete) : null;
  // OM1 : l'objectif demandé par le coaché, ses réponses à relire ; sa trace part avec la demande.
  const demande = suite && typeof r.demande === 'string' ? await demandeDuCoach(coach.compteId, r.demande) : null;
  const court = Boolean(suite?.profilConnu && !demande);
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const enCours = suite?.athlete.objectifs.find((o) => o.course_date >= jour) ?? null;
  return (
    <CadreCoach actif="athletes">
      <div className="max-w-3xl">
        <Link href={suite ? `/app/coach/athlete/${suite.athlete.id}` : '/app/coach'} className="inline-flex items-center min-h-9 text-[0.8125rem] font-bold text-teal">
          ‹ {suite ? suite.athlete.nom : 'Tes athlètes'}
        </Link>
        <div className="my-6 px-2">
          <div className="eyebrow text-teal mb-3">Athlète coaché</div>
          <h1 className="text-3xl sm:text-4xl text-indigo leading-tight">{suite ? `Nouvel objectif pour ${suite.athlete.nom}` : 'Ajouter un athlète'}</h1>
          <p className="text-indigo/70 mt-2">
            {demande
              ? `Sa demande du ${new Date(demande.cree_le).toLocaleDateString('fr-FR')} : relis ses réponses, corrige si besoin, et lance l’objectif.${demande.gpx_chemin ? ' Sa trace part avec la demande.' : ''}`
              : court && suite?.nolio
              ? 'Son profil est déjà rempli : seules sa charge du moment et la course sont demandées. Sa charge est préremplie depuis Nolio, sur ses 4 dernières semaines : relis et corrige si besoin.'
              : court
              ? 'Son profil est déjà rempli : seules sa charge du moment et la course sont demandées.'
              : suite
              ? 'Son profil n’est pas encore connu : remplis le questionnaire avec ses réponses. L’objectif rejoint sa fiche.'
              : 'Remplis le questionnaire avec ses réponses. L’objectif se crée sans paiement et rejoint ton espace coach.'}
          </p>
        </div>
        {court && (
          <div role="group" aria-label="Genre d’objectif" className="inline-flex mb-6 p-1 rounded-xl bg-sand-dark gap-1">
            <span aria-current="true" className="inline-flex items-center min-h-11 px-4 rounded-[9px] bg-white text-indigo text-sm font-bold shadow-sm">Objectif principal</span>
            {enCours ? (
              <Link href={`/app/coach/plan/${enCours.plan_id}#ajouter-course`} className="inline-flex items-center min-h-11 px-4 rounded-[9px] text-[#4A4866] text-sm font-semibold">
                Course de préparation
              </Link>
            ) : (
              <span className="inline-flex items-center min-h-11 px-4 text-[#8B89A3] text-sm font-semibold" title="Sans objectif principal en cours">Course de préparation</span>
            )}
          </div>
        )}
        <Questionnaire coach court={court} emailCoach={coach.email} athleteId={suite?.athlete.id} demandeId={demande?.id}
          initial={demande ? { ...demande.champs, nom: suite?.athlete.nom ?? '' } : suite?.initial} />
      </div>
    </CadreCoach>
  );
}
