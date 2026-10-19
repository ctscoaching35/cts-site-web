import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Questionnaire from '@/components/plan/Questionnaire';
import { questionnairePrerempli, reponsesSansLaCourse } from '@/lib/app/coaching';
import { plansDuCompte } from '@/lib/app/contexte';
import { ficheDuCompte } from '@/lib/app/demandes';
import { clientServeur, supabaseConfigure } from '@/lib/app/supabase';

export const dynamic = 'force-dynamic';

// « Nouvel objectif » dans l'app (CTS_NOLIO_CADRAGE.md, OM1, décision coach du 19/10/2026) : le questionnaire,
// prérempli des dernières réponses, la course à remplir. Un acheteur paie sa nouvelle préparation ; un coaché envoie sa
// demande à son coach, qui la relit et lance l'objectif.
export default async function NouvelObjectif() {
  if (!supabaseConfigure()) notFound();
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const compteId = data?.claims?.sub as string | undefined;
  if (!compteId) redirect('/app/connexion?suite=/app/objectif/nouveau');
  const fiche = await ficheDuCompte(compteId);
  let initial: Record<string, string | string[]>;
  let depuisNolio = false;
  // PO1 : un coaché qui a déjà un objectif garde son profil ; seules sa charge du moment et sa course se demandent.
  let court = false;
  if (fiche) {
    const suite = await questionnairePrerempli(fiche.coach_id, fiche.id);
    initial = suite?.initial ?? { nom: fiche.nom };
    depuisNolio = Boolean(suite?.nolio);
    court = Boolean(suite?.profilConnu);
  } else {
    const dernier = (await plansDuCompte(compteId)).filter((p) => !p.coache).pop();
    const { data: p } = dernier ? await supabase.from('plans').select('intake').eq('id', dernier.id).maybeSingle() : { data: null };
    const { data: compte } = await supabase.from('comptes').select('nom').eq('id', compteId).maybeSingle();
    initial = { ...reponsesSansLaCourse(p?.intake), nom: String(compte?.nom ?? ''), email: String(data?.claims?.email ?? '') };
  }
  return (
    <div className="min-h-screen bg-sand">
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <Link href="/app/plan" className="inline-flex items-center min-h-11 text-teal font-bold text-sm">‹ Ton objectif</Link>
        <div className="my-6 px-2">
          <div className="eyebrow text-teal mb-3">Nouvel objectif</div>
          <h1 className="text-3xl sm:text-4xl text-indigo leading-tight">Ta prochaine course</h1>
          <p className="text-indigo/70 mt-2">
            {fiche
              ? court
                ? `Ton profil est déjà rempli : seules ta charge du moment${depuisNolio ? ' (lue dans tes séances Nolio : relis-la)' : ''} et ta course sont demandées. Ton coach relit ta demande et lance ta préparation.`
                : 'Remplis tes réponses et saisis ta course. Ton coach relit ta demande et lance ta préparation.'
              : 'Tes réponses du dernier plan sont reprises : mets à jour ce que tu cours en ce moment et saisis ta course.'}
          </p>
          {/* OM4 : un objectif majeur à la fois ; une course avant l'objectif en cours est une course de préparation. */}
          <p className="text-sm text-indigo/60 mt-2">
            Une course avant ton objectif en cours ? Ajoute-la plutôt comme course de préparation, dans ton objectif. Un
            objectif après lui démarre le lundi qui suit ta récupération.
          </p>
        </div>
        {fiche
          ? <Questionnaire coach demande court={court} athleteId={fiche.id} initial={initial} />
          : <Questionnaire initial={initial} />}
      </main>
    </div>
  );
}
