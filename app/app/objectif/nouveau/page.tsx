import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import ProfilAthlete from '@/components/app/ProfilAthlete';
import Questionnaire from '@/components/plan/Questionnaire';
import { questionnairePrerempli, reponsesSansLaCourse } from '@/lib/app/coaching';
import { plansDuCompte } from '@/lib/app/contexte';
import { ficheDuCompte } from '@/lib/app/demandes';
import { lignesDuProfil, profilDeLaFiche } from '@/lib/app/profilEntrainement';
import { clientServeur, supabaseConfigure } from '@/lib/app/supabase';

export const dynamic = 'force-dynamic';

// « Nouvel objectif » dans l'app (CTS_NOLIO_CADRAGE.md, OM1, décision coach du 19/10/2026) : le questionnaire,
// prérempli des dernières réponses, la course à remplir. Un acheteur paie sa nouvelle préparation ; un coaché envoie sa
// demande à son coach, qui la relit et lance l'objectif.
export default async function NouvelObjectif({ searchParams }: { searchParams: Promise<{ majeur?: string; discipline?: string }> }) {
  if (!supabaseConfigure()) notFound();
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const compteId = data?.claims?.sub as string | undefined;
  if (!compteId) redirect('/app/connexion?suite=/app/objectif/nouveau');
  const fiche = await ficheDuCompte(compteId);
  // D'abord l'aiguillage, objectif majeur ou course de préparation ; le questionnaire ensuite (?majeur=1). Un coaché
  // (décision coach du 20/10/2026 : « parle bien d'objectifs majeurs »), et un acheteur, pour qu'il n'achète pas une
  // préparation pour une course qui s'ajoute gratuitement à la sienne (décision coach du 20/10/2026, les nuances des plans).
  const recherche = await searchParams;
  // Un coaché choisit d'emblée trail ou route (décision coach du 23/10/2026, « deux entrées ») ; un acheteur, le trail.
  const route = Boolean(fiche) && recherche.discipline === 'route';
  if (recherche.majeur !== '1') {
    const aujourdhui = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    const enCours = (await plansDuCompte(compteId)).some((p) => p.course_date >= aujourdhui);
    return <Aiguillage enCours={enCours} coache={Boolean(fiche)} />;
  }
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
          <div className="eyebrow text-teal mb-3">Nouvel objectif majeur{route ? ' · route' : fiche ? ' · trail' : ''}</div>
          <h1 className="text-3xl sm:text-4xl text-indigo leading-tight">Ta prochaine course</h1>
          <p className="text-indigo/70 mt-2">
            {fiche
              ? court
                ? `Ton profil d’entraînement part avec ta demande (ci-dessous) : seules ta charge du moment${depuisNolio ? ' (lue dans tes séances Nolio : relis-la)' : ''} et ta course sont demandées. Ton coach relit ta demande et lance ta préparation.`
                : 'D’abord ton profil de coureur, une seule fois ; ta course ensuite. Ton coach relit ta demande et lance ta préparation.'
              : 'Tes réponses du dernier plan sont reprises : mets à jour ce que tu cours en ce moment et saisis ta course.'}
          </p>
          {/* OM4 : un objectif majeur à la fois ; une course avant l'objectif en cours est une course de préparation. */}
          <p className="text-sm text-indigo/60 mt-2">
            Une course avant ton objectif en cours ? Ajoute-la plutôt comme course de préparation, dans ton objectif. Un
            objectif après lui démarre le lundi qui suit ta récupération.
          </p>
        </div>
        {/* Son profil d'entraînement, montré (décision coach du 20/10/2026 : « le coureur n'a jamais de visu sur son
            profil ») et modifiable dans son onglet Profil. */}
        {fiche && court && (
          <div className="mb-6 mx-2 bg-white rounded-2xl border border-indigo/[0.08] px-4 py-3">
            <div className="text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-teal">Ton profil d’entraînement</div>
            <dl className="pt-1">
              {lignesDuProfil(await profilDeLaFiche(fiche.id)).map(([cle, valeur]) => (
                <div key={cle} className="grid grid-cols-[112px_1fr] gap-x-3 py-2 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem] text-indigo">
                  <dt className="font-semibold text-[#5E5C78]">{cle}</dt><dd>{valeur}</dd>
                </div>
              ))}
            </dl>
            <Link href="/app/profil#profil-entrainement" className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Le modifier dans ton onglet Profil ›</Link>
          </div>
        )}
        {/* Le profil d'abord (décision coach du 23/10/2026) : sans lui, son formulaire ; une fois enregistré, la page se
            recharge sur le questionnaire court. */}
        {fiche && !court ? (
          <div className="mx-2 bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-3">
            <div className="text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-teal">Ton profil de coureur, d’abord</div>
            <p className="text-sm text-[#4A4866] leading-relaxed">
              Une seule fois : ton niveau et ta semaine habituelle. Tes prochains objectifs ne demanderont plus que ta
              course et ta charge du moment. Tu le retrouves dans ton onglet Profil.
            </p>
            <ProfilAthlete profil={await profilDeLaFiche(fiche.id)} pourMoi rafraichir />
          </div>
        ) : fiche
          ? <Questionnaire coach demande court={court} athleteId={fiche.id} initial={initial} discipline={route ? 'route' : 'trail'} />
          : <Questionnaire initial={initial} />}
      </main>
    </div>
  );
}

// Objectif majeur ou course de préparation : une définition, puis deux chemins. Sans objectif majeur à venir, une course
// de préparation n'a pas encore où s'ajouter. Un acheteur : ce que chaque chemin lui apporte (une nouvelle préparation,
// ou une course ajoutée gratuitement) ; un coaché : son coach relit.
function Aiguillage({ enCours, coache }: { enCours: boolean; coache: boolean }) {
  const bouton = 'flex items-center justify-center min-h-12 px-5 rounded-xl text-sm font-bold';
  return (
    <div className="min-h-screen bg-sand">
      <main className="mx-auto max-w-xl px-4 sm:px-6 py-8 sm:py-12 space-y-5">
        <Link href="/app/plan" className="inline-flex items-center min-h-11 text-teal font-bold text-sm">‹ Ton objectif</Link>
        <div className="px-2">
          <div className="eyebrow text-teal mb-3">Nouvel objectif majeur</div>
          <h1 className="text-3xl sm:text-4xl text-indigo leading-tight">Ta prochaine course</h1>
          <p className="text-indigo/80 mt-3 leading-relaxed">
            Un objectif majeur, c’est la course que toute ta préparation vise : une à trois par saison. Les autres courses
            de ta saison sont des courses de préparation : elles se glissent dans ta préparation, sans la changer.
          </p>
        </div>
        <div className="space-y-2.5 px-2">
          {coache ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/app/objectif/nouveau?majeur=1" className={`${bouton} bg-teal text-white`}>Un trail</Link>
              <Link href="/app/objectif/nouveau?majeur=1&discipline=route" className={`${bouton} bg-teal text-white`}>Une course sur route</Link>
            </div>
          ) : (
            <Link href="/app/objectif/nouveau?majeur=1" className={`${bouton} bg-teal text-white`}>C’est mon objectif majeur</Link>
          )}
          {coache && <p className="text-[0.8125rem] text-indigo/60 text-center">C’est mon objectif majeur : un trail, ou un 10 km, un semi ou un marathon.</p>}
          {!coache && <p className="text-[0.8125rem] text-indigo/60 text-center">Une nouvelle préparation, construite pour cette course.</p>}
          {enCours ? (
            <>
              <Link href="/app/plan#ajouter-course" className={`${bouton} border border-teal text-teal`}>C’est une course de préparation ›</Link>
              {!coache && <p className="text-[0.8125rem] text-indigo/60 text-center">Elle s’ajoute gratuitement à ta préparation en cours.</p>}
            </>
          ) : (
            <p className="text-sm text-indigo/70 leading-relaxed">
              {coache ? 'Une course de préparation s’ajoute à ton objectif majeur : propose-le d’abord.'
                : 'Une course de préparation s’ajoute à une préparation : choisis d’abord ton objectif majeur.'}
            </p>
          )}
        </div>
        {coache && <p className="px-2 text-sm text-indigo/60">Ton coach relit chaque objectif majeur avant de le lancer.</p>}
      </main>
    </div>
  );
}
