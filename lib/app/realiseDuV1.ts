/**
 * LA NUIT, LE RÉALISÉ DES SEMAINES DU MOTEUR v1 (décisions du coach 198 et 199 ; lib/app/realiseV9.ts) : les deux dernières semaines finies que la v1 a écrites et envoyées dans Nolio se résument depuis Nolio et
 * se rangent avec elles (`semaines_ecrites.realise`), pour les graphiques et la jauge ; la suivante reprend les retours tardifs (RPE, Hooper). Avec l'accord de lecture seulement, comme les autres résumés ; son
 * retrait efface la colonne. Rien n'est réécrit dans Nolio et rien ne part au moteur. Sous la 8.x : rien. Côté serveur seulement.
 */
import { destinataire } from './coaching';
import { indiceHooper, objectifEcrit, type Compte } from './ecriture';
import { moteurEstV9 } from './moteurEnLigne';
import { listeNolio, nolioConfigure, sansVitesseImpossible, SPORTS_COURSE } from './nolio';
import { ajouterJours } from './plan';
import { realiseDeLaSemaineV9 } from './realiseV9';
import type { Prevue, Reelle } from './resumeSemaine';
import { typeDeLaSemaineV9 } from './semaineLue';
import { MOTEUR_ECRIT } from './stockageV9';
import { clientService } from './supabase';

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const lundiDe = (jour: string) => ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
const course = (x: { sport?: string | null }) => SPORTS_COURSE.includes(String(x.sport));

type Ligne = {
  numero: string;
  donnees: { lundi?: string; type?: string; legere?: boolean; jours?: { seance?: { id?: string; famille?: string } | null }[] } | null;
  reponses_lues: { cles_pas_faites?: string[] } | null;
};

export async function resumerLesSemainesDuV1(budgetMs = 120_000): Promise<Compte[]> {
  if (!(await moteurEstV9()) || !nolioConfigure()) return [];
  const debut = Date.now();
  const lundi = lundiDe(aujourdhuiParis());
  const voulus = [ajouterJours(lundi, -7), ajouterJours(lundi, -14)];
  const service = clientService();
  const { data, error } = await service.from('semaines_ecrites').select('plan_id').eq('moteur', MOTEUR_ECRIT).in('donnees->>lundi', voulus);
  if (error) throw new Error(`semaines écrites : ${error.message}`);
  const comptes: Compte[] = [];
  for (const planId of [...new Set(((data ?? []) as { plan_id: string }[]).map((l) => l.plan_id))]) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: planId, quoi: 'remis à la nuit suivante' });
      continue;
    }
    try {
      const o = await objectifEcrit(planId);
      if (!o?.nolioAthlete || !o.accordLecture) continue;
      // Toutes les semaines v1 du plan : ce qu'il a coché « pas faite » arrive avec la réponse du dimanche, gardée sur la semaine suivante.
      const { data: lues, error: e } = await service.from('semaines_ecrites').select('numero, donnees, reponses_lues').eq('plan_id', planId).eq('moteur', MOTEUR_ECRIT);
      if (e) throw new Error(e.message);
      const lignes = (lues ?? []) as Ligne[];
      const pasFaites = new Set(lignes.flatMap((l) => l.reponses_lues?.cles_pas_faites ?? []));
      const idDuMoteur = new Map(o.envois.flatMap((x) => x.seances)
        .filter((s) => s.nolio_id && (s.genre ?? 'seance') === 'seance' && !s.jour_id.includes(':'))
        .map((s) => [String(s.nolio_id), s.jour_id]));
      const d = await destinataire(o.nolioAthlete);
      const qui = d.moi ? '' : `&athlete=${d.usr}`;
      const item = await indiceHooper();
      let resumees = 0;
      for (const l of lignes) {
        const du = String(l.donnees?.lundi ?? '');
        // Une semaine qui n'est pas partie dans Nolio n'a rien à comparer.
        if (!voulus.includes(du) || !o.envois.some((x) => x.semaine === l.numero)) continue;
        const au = ajouterJours(du, 6);
        const prevues = (await listeNolio<Prevue>(`planned/trainings/?date_from=${du}&date_to=${au}${qui}`)).filter(course);
        const reelles = (await listeNolio<Reelle>(`real/trainings/?date_from=${du}&date_to=${au}`
          + `&fields=id,date_start,sport,duration,distance,elevation_gain,planned,debrief${qui}`)).filter(course).map(sansVitesseImpossible);
        const valeurs = item
          ? await listeNolio<{ id: string; date_start: string; value: number | null }>(`metrics/values/?item=${item}&date_from=${du}&date_to=${au}${qui}`)
          : [];
        const hooper = valeurs.filter((v) => typeof v.value === 'number').sort((x, y) => x.date_start.localeCompare(y.date_start)).at(-1)?.value ?? null;
        const familleDe = new Map((l.donnees?.jours ?? []).flatMap((j) => (j.seance?.id && j.seance.famille ? [[j.seance.id, j.seance.famille] as const] : [])));
        const realise = realiseDeLaSemaineV9({ numero: l.numero, lundi: du, type: typeDeLaSemaineV9(l.donnees ?? {}) || null, prevues, reelles, idDuMoteur, familleDe, pasFaites, hooper });
        const { error: ecriture } = await service.from('semaines_ecrites').update({ realise }).eq('plan_id', planId).eq('numero', l.numero);
        if (ecriture) throw new Error(ecriture.message);
        resumees += 1;
      }
      if (resumees) comptes.push({ plan: planId, quoi: `${resumees} semaine${resumees > 1 ? 's' : ''} résumée${resumees > 1 ? 's' : ''}`, coache: o.coache });
    } catch (e) {
      comptes.push({ plan: planId, quoi: 'non résumé', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}
