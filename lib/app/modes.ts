/**
 * Le mode de chaque athlète, coaching ou plan (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur ; décision coach du
 * 23/10/2026, « bien voir si la personne est en mode coaching ou plan, et le changer avec un bouton ») : son mode est
 * sur sa fiche (athletes_coaches.mode), un acheteur sans fiche est en mode plan. Le passage se fait après la semaine en
 * cours : ce qui est déjà dans Nolio pour elle reste, la suite part.
 *   - « Passer en coaching » : sa fiche, créée ou reprise, reliée à Nolio et à son compte de l'app ; sa sortie
 *     programmée de l'équipe annulée ; ses plans achetés à venir cessent de s'écrire (nolio_statut « coaching ») et
 *     restent lisibles dans « Tes plans ».
 *   - « Passer en plan » : ses objectifs de coaching à venir quittent Nolio et ne s'écrivent plus (plansALaMain), sa
 *     série du dimanche part ; sa fiche reste pour l'historique ; un plan acheté qui l'attendait démarre le lundi qui
 *     vient.
 * Côté serveur seulement.
 */
import { retirerLesDimanches } from './dimanchesCoaches';
import { demarrerObjectif, equipeDuCoach, retirerDeNolio } from './ecriture';
import { appelNolio, athletesNolio, listeNolio, refusNolio } from './nolio';
import { ajouterJours } from './plan';
import { clientService } from './supabase';

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
// Le lundi qui vient (demain si c'est lundi demain) : la semaine en cours reste.
const lundiQuiVient = (jour: string) => ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));

// Sa sortie programmée de l'équipe (P3, posée au départ d'un plan acheté), annulée : il reste dans l'équipe.
async function annulerSortie(usr: string): Promise<string[]> {
  const equipe = await equipeDuCoach();
  if (!equipe) return ['sa sortie programmée de l’équipe : équipe Nolio introuvable'];
  const sorties = await listeNolio<{ id: string; user?: string }>(`team/teams/${equipe}/expirations/`).catch(() => null);
  if (!sorties) return ['sa sortie programmée de l’équipe : Nolio injoignable'];
  const soucis: string[] = [];
  for (const s of sorties.filter((x) => x.user === usr)) {
    const r = await appelNolio('DELETE', `team/teams/${equipe}/expirations/${s.id}/`).catch(() => null);
    if (!r || (r.statut !== 204 && r.statut !== 200 && r.statut !== 404)) soucis.push(r ? refusNolio(r, 'sa sortie programmée de l’équipe') : 'sa sortie programmée : Nolio injoignable');
  }
  return soucis;
}

// Passer en coaching, depuis un plan acheté (sa ligne dans « Chiffres de la vente ») ou depuis sa fiche en mode plan.
// L'identifiant de sa fiche, et ce qui n'a pas pu se faire dans Nolio, en phrases.
export async function passerEnCoaching(coachId: string, source: { planId: string } | { athleteId: string }): Promise<{ athleteId: string; soucis: string[] }> {
  const service = clientService();
  let usr: string | null = null;
  let compteId: string | null = null;
  let nom = '';
  let ficheId: string | null = null;
  if ('planId' in source) {
    const { data: p } = await service.from('plans').select('id, compte_id, nolio_athlete_id, nom:donnees->athlete->>nom')
      .eq('id', source.planId).not('nolio_statut', 'is', null).maybeSingle();
    if (!p) throw new Error('C’est un plan que le site ne retrouve pas.');
    usr = (p.nolio_athlete_id as string | null) ?? null;
    compteId = (p.compte_id as string | null) ?? null;
    nom = String(p.nom ?? '').trim();
    if (!usr) throw new Error('C’est trop tôt : il n’a pas encore rejoint ton équipe Nolio.');
    const { data: deja } = await service.from('athletes_coaches').select('id').eq('coach_id', coachId).eq('nolio_athlete_id', usr).maybeSingle();
    ficheId = (deja?.id as string | undefined) ?? null;
  } else {
    const { data: f } = await service.from('athletes_coaches').select('*').eq('id', source.athleteId).eq('coach_id', coachId).maybeSingle();
    if (!f) throw new Error('C’est une fiche que le site ne retrouve pas.');
    ficheId = String(f.id);
    usr = (f.nolio_athlete_id as string | null) ?? null;
    compteId = (f.compte_id as string | null) ?? null;
  }
  const maj = { mode: 'coaching', mode_le: new Date().toISOString(), ...(compteId ? { compte_id: compteId } : {}) };
  if (ficheId) {
    const { error } = await service.from('athletes_coaches').update(maj).eq('id', ficheId).eq('coach_id', coachId);
    if (error) throw new Error('C’est la migration du 23/10/2026 qui manque : lance-la dans Supabase.');
  } else {
    // Son nom tel que Nolio le donne, sinon celui de son plan.
    const membre = (await athletesNolio().catch(() => [])).find((x) => x.id === usr);
    const { data, error } = await service.from('athletes_coaches')
      .insert({ coach_id: coachId, nom: membre?.name ?? (nom || 'Athlète'), nolio_athlete_id: usr, ...maj }).select('id').single();
    if (error || !data) throw new Error('C’est la migration du 23/10/2026 qui manque : lance-la dans Supabase.');
    ficheId = String(data.id);
  }
  const soucis: string[] = [];
  // Ses plans achetés à venir : ils ne s'écrivent plus, ce qui est posé après la semaine en cours part.
  const jour = aujourdhuiParis();
  if (compteId) {
    const { data: achetes } = await service.from('plans').select('id, nolio_statut').eq('compte_id', compteId)
      .not('nolio_statut', 'is', null).neq('nolio_statut', 'coaching').gte('course_date', jour);
    for (const p of achetes ?? []) {
      await service.from('plans').update({ nolio_statut: 'coaching' }).eq('id', p.id);
      if (p.nolio_statut === 'actif') soucis.push(...await retirerDeNolio(String(p.id), { depuis: lundiQuiVient(jour) }).catch((e) => [String(e)]));
    }
  }
  if (usr) soucis.push(...await annulerSortie(usr));
  return { athleteId: ficheId, soucis };
}

// Passer en plan, depuis sa fiche. Ce qui n'a pas pu se faire, en phrases.
export async function passerEnPlan(coachId: string, athleteId: string): Promise<string[]> {
  const service = clientService();
  const { data: f } = await service.from('athletes_coaches').select('*').eq('id', athleteId).eq('coach_id', coachId).maybeSingle();
  if (!f) throw new Error('C’est une fiche que le site ne retrouve pas.');
  const { error } = await service.from('athletes_coaches').update({ mode: 'plan', mode_le: new Date().toISOString() }).eq('id', athleteId);
  if (error) throw new Error('C’est la migration du 23/10/2026 qui manque : lance-la dans Supabase.');
  const jour = aujourdhuiParis();
  const soucis: string[] = [];
  // Ses objectifs de coaching à venir : ce qui est posé après la semaine en cours part ; plansALaMain ne les écrit plus.
  const { data: lignes } = await service.from('coaching').select('plan_id, plans(course_date, demarre_le)').eq('athlete_id', athleteId);
  for (const l of lignes ?? []) {
    const p = (Array.isArray(l.plans) ? l.plans[0] : l.plans) as { course_date: string; demarre_le: string | null } | null;
    if (p?.demarre_le && p.course_date >= jour) {
      soucis.push(...await retirerDeNolio(String(l.plan_id), { depuis: lundiQuiVient(jour) }).catch((e) => [String(e)]));
    }
  }
  soucis.push(...await retirerLesDimanches(athleteId).catch((e) => [String(e)]));
  // Un plan acheté qui l'attendait : il démarre le lundi qui vient, avec son compte Nolio et sa sortie de l'équipe.
  if (f.compte_id) {
    const { data: enAttente } = await service.from('plans').select('id').eq('compte_id', f.compte_id).eq('nolio_statut', 'coaching')
      .gte('course_date', jour);
    for (const p of enAttente ?? []) {
      await service.from('plans').update({ nolio_statut: 'actif', nolio_athlete_id: f.nolio_athlete_id }).eq('id', p.id);
      await demarrerObjectif(String(p.id), { lundi: lundiQuiVient(jour) })
        .catch((e) => soucis.push(`son plan acheté n’a pas démarré : ${e instanceof Error ? e.message : String(e)}`));
    }
  }
  return soucis;
}

// Les plans achetés pendant son coaching, qui attendent « Passer en plan » (« À regarder ») : par fiche, leurs courses.
export async function achatsEnAttente(fiches: { id: string; compte_id: string | null; mode: string; mode_le: string | null }[]): Promise<Map<string, string[]>> {
  const enCoaching = fiches.filter((f) => f.mode !== 'plan' && f.compte_id);
  const parFiche = new Map<string, string[]>();
  if (!enCoaching.length) return parFiche;
  const { data } = await clientService().from('plans').select('compte_id, course_nom, cree_le').eq('nolio_statut', 'coaching')
    .gte('course_date', aujourdhuiParis()).in('compte_id', enCoaching.map((f) => f.compte_id as string));
  for (const f of enCoaching) {
    const courses = (data ?? []).filter((p) => p.compte_id === f.compte_id && (!f.mode_le || String(p.cree_le) > f.mode_le))
      .map((p) => String(p.course_nom ?? ''));
    if (courses.length) parFiche.set(f.id, courses);
  }
  return parFiche;
}
