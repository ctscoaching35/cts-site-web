import Link from 'next/link';
import { formatRouteDe } from '@/lib/app/route';
import CadreCoach from '@/components/app/CadreCoach';
import ProfilAthlete from '@/components/app/ProfilAthlete';
import Questionnaire from '@/components/plan/Questionnaire';
import { exigerCoach } from '@/lib/app/nolio';
import { questionnairePrerempli, reponsesDe } from '@/lib/app/coaching';
import { demandeDuCoach } from '@/lib/app/demandes';
import { courseNolio } from '@/lib/app/coursesNolio';
import { lignesDuProfil, profilDeLaFiche } from '@/lib/app/profilEntrainement';
import { clientService } from '@/lib/app/supabase';
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
  // Le questionnaire court pour tout athlète connu, sa demande comprise ; sans profil, son profil d'abord (décision coach
  // du 23/10/2026), prérempli de sa demande s'il en a fait une.
  const court = Boolean(suite?.profilConnu);
  // « Modifier l'objectif » (décision coach du 22/10/2026) : ses réponses à lui, sa course comprise ; celles que le moteur
  // tient à jour (parametres.champs : sa charge relue au départ) l'emportent sur celles de la création.
  const aModifier = suite && !demande && typeof r.modifier === 'string' && suite.athlete.objectifs.some((o) => o.plan_id === r.modifier)
    ? (await clientService().from('plans').select('id, intake, parametres, demarre_le, course_nom').eq('id', r.modifier)
      .eq('compte_id', coach.compteId).maybeSingle()).data
    : null;
  const pm = (aModifier?.parametres ?? null) as Record<string, unknown> | null;
  // Son profil de coureur, modifiable ici (décision coach du 23/10/2026) ; « Modifier l'objectif » le donne à sa
  // préparation en cours, dès la semaine suivante.
  const profilFiche = suite ? await profilDeLaFiche(suite.athlete.id) : {};
  const traceDonnee = Boolean(pm?.plage_dominante || pm?.bande_majeure);
  // Une course de Nolio, depuis sa fiche (« Créer l'objectif », décision coach du 22/10/2026) : la course déjà remplie.
  const usr = suite?.athlete.nolio_athlete_id;
  const c = usr && !demande && typeof r.course === 'string' ? await courseNolio(usr, r.course).catch(() => null) : null;
  const deNolio = c ? {
    course_nom: c.nom, date_course: c.date, ...(c.distance_km ? { distance_km: String(c.distance_km) } : {}),
    ...(c.dplus_m ? { dplus_m: String(c.dplus_m) } : {}), ...(c.dmoins_m ? { dmoins_m: String(c.dmoins_m) } : {}),
    ...(c.chrono ? { temps_cible: c.chrono } : {}),
  } : null;
  // La discipline (décision coach du 23/10/2026, « deux entrées ») : demandée (?discipline=route), ou celle de l'objectif
  // modifié, de la demande, de la course de Nolio (10, 21 ou 42 km presque sans dénivelé).
  const formatConnu = String((aModifier ? { ...(aModifier.intake as Record<string, unknown>), ...((pm?.champs as Record<string, unknown>) ?? {}) }
    : demande?.champs ?? {})?.format ?? '');
  const routeNolio = c ? formatRouteDe(c.distance_km, c.dplus_m) : null;
  const route = r.discipline === 'route' || formatConnu.startsWith('R') || Boolean(routeNolio);
  const discipline: 'trail' | 'route' = route ? 'route' : 'trail';
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const enCours = suite?.athlete.objectifs.find((o) => o.course_date >= jour) ?? null;
  return (
    <CadreCoach actif="athletes">
      <div className="max-w-3xl">
        <Link href={aModifier ? `/app/coach/plan/${aModifier.id}` : suite ? `/app/coach/athlete/${suite.athlete.id}` : '/app/coach'} className="inline-flex items-center min-h-9 text-[0.8125rem] font-bold text-teal">
          ‹ {aModifier ? String(aModifier.course_nom) : suite ? suite.athlete.nom : 'Tes athlètes'}
        </Link>
        <div className="my-6 px-2">
          <div className="eyebrow text-teal mb-3">Athlète coaché</div>
          <h1 className="text-3xl sm:text-4xl text-indigo leading-tight">{aModifier ? `Modifier ${aModifier.course_nom}` : suite ? `Nouvel objectif ${route ? 'route' : 'trail'} pour ${suite.athlete.nom}` : 'Ajouter un athlète'}</h1>
          <p className="text-indigo/70 mt-2">
            {aModifier
              ? !aModifier.parametres
                ? 'Ancien format, envoyé en entier : à l’enregistrement, il passe au format semaine par semaine, et tout se modifie comme pour les autres. Ses semaines déjà dans Nolio restent ; démarre-le ensuite dans Nolio.'
              : `${aModifier.demarre_le
                ? 'Il est en route : les semaines déjà écrites restent, les suivantes suivront tes réponses. Sa date, sa distance et son format ne changent plus. Sa charge est celle de son départ : corrige-la seulement si elle était fausse, la suite s’ajuste déjà chaque dimanche sur ce qu’il fait.'
                : 'Tout se modifie. Un départ déjà programmé s’annule : tu redémarreras l’objectif après.'}${traceDonnee ? ' Sa trace est gardée si tu n’en donnes pas d’autre.' : ''}`
              : ''}
            {!aModifier && deNolio ? `${c?.nom} vient de Nolio : la course est remplie, relis ${routeNolio ? 'sa date et le chrono visé' : 'sa distance, son dénivelé et le temps visé'}. ` : ''}
            {aModifier ? '' : demande
              ? `Sa demande du ${new Date(demande.cree_le).toLocaleDateString('fr-FR')} : ${court ? 'relis ses réponses, corrige si besoin, et lance l’objectif' : 'son profil de coureur d’abord, prérempli de sa demande ; sa course ensuite'}.${demande.gpx_chemin ? ' Sa trace part avec la demande.' : ''}`
              : court && suite?.nolio
              ? 'Son profil est déjà rempli : seules sa charge du moment et la course sont demandées. Sa charge est préremplie depuis Nolio, sur ses 4 dernières semaines (après une course, les 4 d’avant son affûtage, sans la course) : relis et corrige si besoin.'
              : court
              ? 'Son profil est déjà rempli : seules sa charge du moment et la course sont demandées.'
              : suite
              ? 'Son profil de coureur d’abord, une seule fois : son niveau et sa semaine habituelle. Sa course ensuite.'
              : 'Remplis le questionnaire avec ses réponses. L’objectif se crée sans paiement et rejoint ton espace coach.'}
          </p>
        </div>
        {court && !aModifier && !demande && (
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
        {suite && court && (
          <div className="mb-6 mx-2 bg-white rounded-2xl border border-indigo/[0.08] px-4 py-3">
            <div className="text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-teal">Son profil de coureur</div>
            <dl className="pt-1">
              {lignesDuProfil(profilFiche, true).map(([cle, valeur]) => (
                <div key={cle} className="grid grid-cols-[112px_1fr] gap-x-3 py-2 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem] text-indigo">
                  <dt className="font-semibold text-[#5E5C78]">{cle}</dt><dd>{valeur}</dd>
                </div>
              ))}
            </dl>
            {aModifier && <p className="pt-1 text-[0.72rem] leading-relaxed text-[#5E5C78]">À l’enregistrement de l’objectif, sa préparation reprend ce profil dès la semaine suivante.</p>}
            <details className="pt-1">
              <summary className="cursor-pointer min-h-11 flex items-center text-[0.8125rem] font-bold text-teal">Modifier son profil</summary>
              <div className="pt-2 pb-2"><ProfilAthlete athleteId={suite.athlete.id} profil={profilFiche} rafraichir /></div>
            </details>
          </div>
        )}
        {suite && !court && !aModifier ? (
          <div className="mx-2 bg-white rounded-2xl border border-indigo/[0.08] p-5">
            <ProfilAthlete athleteId={suite.athlete.id} rafraichir
              profil={demande ? Object.fromEntries(Object.entries(demande.champs).filter(([k]) => ['terrain', 'jours_disponibles', 'jour_sl', 'freq_hebdo'].includes(k))) as Record<string, string | string[]> : {}} />
          </div>
        ) : <Questionnaire key={JSON.stringify(suite?.profil ?? {})} coach court={court} emailCoach={coach.email} athleteId={suite?.athlete.id} demandeId={demande?.id}
          modification={aModifier ? { planId: String(aModifier.id), trace: traceDonnee } : undefined}
          vcMs={suite?.athlete.vc_ms ?? null} discipline={discipline} noteCharge={aModifier ? null : suite?.noteCharge ?? null}
          initial={aModifier ? { ...reponsesDe(aModifier.intake), ...reponsesDe(pm?.champs), ...suite?.profil, nom: suite?.athlete.nom ?? '' }
            : demande ? { ...demande.champs, ...suite?.profil, nom: suite?.athlete.nom ?? '' }
              : deNolio ? { ...suite?.initial, ...deNolio, ...(routeNolio ? { format: routeNolio } : {}) } : suite?.initial} />}
      </div>
    </CadreCoach>
  );
}
