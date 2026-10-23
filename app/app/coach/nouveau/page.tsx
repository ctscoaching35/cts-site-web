import Link from 'next/link';
import { formatRouteDe } from '@/lib/app/route';
import CadreCoach from '@/components/app/CadreCoach';
import Questionnaire from '@/components/plan/Questionnaire';
import { exigerCoach } from '@/lib/app/nolio';
import { questionnairePrerempli, reponsesDe } from '@/lib/app/coaching';
import { demandeDuCoach } from '@/lib/app/demandes';
import { courseNolio } from '@/lib/app/coursesNolio';
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
  const court = Boolean(suite?.profilConnu && !demande);
  // « Modifier l'objectif » (décision coach du 22/10/2026) : ses réponses à lui, sa course comprise ; celles que le moteur
  // tient à jour (parametres.champs : sa charge relue au départ) l'emportent sur celles de la création.
  const aModifier = suite && !demande && typeof r.modifier === 'string' && suite.athlete.objectifs.some((o) => o.plan_id === r.modifier)
    ? (await clientService().from('plans').select('id, intake, parametres, demarre_le, course_nom').eq('id', r.modifier)
      .eq('compte_id', coach.compteId).not('parametres', 'is', null).maybeSingle()).data
    : null;
  const pm = (aModifier?.parametres ?? null) as Record<string, unknown> | null;
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
              ? `${aModifier.demarre_le
                ? 'Il est en route : les semaines déjà écrites restent, les suivantes suivront tes réponses. Sa date, sa distance et son format ne changent plus. Sa charge est celle de son départ : corrige-la seulement si elle était fausse, la suite s’ajuste déjà chaque dimanche sur ce qu’il fait.'
                : 'Tout se modifie. Un départ déjà programmé s’annule : tu redémarreras l’objectif après.'}${traceDonnee ? ' Sa trace est gardée si tu n’en donnes pas d’autre.' : ''}`
              : ''}
            {!aModifier && deNolio ? `${c?.nom} vient de Nolio : la course est remplie, relis ${routeNolio ? 'sa date et le chrono visé' : 'sa distance, son dénivelé et le temps visé'}. ` : ''}
            {aModifier ? '' : demande
              ? `Sa demande du ${new Date(demande.cree_le).toLocaleDateString('fr-FR')} : relis ses réponses, corrige si besoin, et lance l’objectif.${demande.gpx_chemin ? ' Sa trace part avec la demande.' : ''}`
              : court && suite?.nolio
              ? 'Son profil est déjà rempli : seules sa charge du moment et la course sont demandées. Sa charge est préremplie depuis Nolio, sur ses 4 dernières semaines (après une course, les 4 d’avant son affûtage, sans la course) : relis et corrige si besoin.'
              : court
              ? 'Son profil est déjà rempli : seules sa charge du moment et la course sont demandées.'
              : suite
              ? 'Son profil n’est pas encore connu : remplis le questionnaire avec ses réponses. L’objectif rejoint sa fiche.'
              : 'Remplis le questionnaire avec ses réponses. L’objectif se crée sans paiement et rejoint ton espace coach.'}
          </p>
        </div>
        {court && !aModifier && (
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
        <Questionnaire coach court={court && !aModifier} emailCoach={coach.email} athleteId={suite?.athlete.id} demandeId={demande?.id}
          modification={aModifier ? { planId: String(aModifier.id), trace: traceDonnee } : undefined}
          vcMs={suite?.athlete.vc_ms ?? null} discipline={discipline}
          initial={aModifier ? { ...reponsesDe(aModifier.intake), ...reponsesDe(pm?.champs), nom: suite?.athlete.nom ?? '' }
            : demande ? { ...demande.champs, nom: suite?.athlete.nom ?? '' }
              : deNolio ? { ...suite?.initial, ...deNolio, ...(routeNolio ? { format: routeNolio } : {}) } : suite?.initial} />
      </div>
    </CadreCoach>
  );
}
