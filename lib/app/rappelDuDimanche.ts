/**
 * LE RAPPEL DU DIMANCHE, la lecture et l'envoi (décision 5 du coach du 16/11/2026, lot 0 ; le calcul, l'interrupteur et le
 * textes validés sont dans lib/app/rappelDimanche.ts). Un message Nolio programmé (`POST planned/messages/`, droit
 * `planned:write`) pour chaque athlète dont la semaine s'écrit ce soir et qui n'a pas répondu au questionnaire du samedi, ou
 * dont une séance de la semaine n'est pas remontée. Un seul par athlète et par dimanche (sa clé « rappel:<dimanche> » dans
 * nolio_envois : une table qui existe, rien de nouveau). Coupé par défaut ; côté serveur seulement.
 */
import { destinataire } from './coaching';
import { lectureDuRappel, plansActifs, type Compte } from './ecriture';
import { appelNolio, refusNolio } from './nolio';
import { heureDuRappel, rappelActif, texteDuRappel, TEXTE_RAPPEL_VALIDE } from './rappelDimanche';
import { clientService } from './supabase';


export async function rappelerLeDimanche(budgetMs = 240_000, maintenant = new Date()): Promise<{ actif: boolean; texteValide: boolean; comptes: Compte[] }> {
  // Coupé : aucune lecture, aucun appel à Nolio.
  if (!rappelActif()) return { actif: false, texteValide: TEXTE_RAPPEL_VALIDE, comptes: [] };
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(maintenant);
  const comptes: Compte[] = [];
  // Le dimanche seulement.
  if (new Date(`${jour}T12:00:00Z`).getUTCDay() !== 0) return { actif: true, texteValide: TEXTE_RAPPEL_VALIDE, comptes };
  const heure = heureDuRappel(maintenant);
  if (!heure) return { actif: true, texteValide: TEXTE_RAPPEL_VALIDE, comptes: [{ plan: '', quoi: 'rappel non envoyé : trop tard dans l’après-midi' }] };
  const service = clientService();
  const debut = Date.now();
  for (const planId of await plansActifs()) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: planId, quoi: 'rappel remis : temps épuisé' });
      continue;
    }
    let cle: string | null = null;
    let coache: boolean | undefined;
    try {
      const lu = await lectureDuRappel(planId, jour);
      if (!lu) continue;
      coache = lu.o.coache;
      const texte = texteDuRappel({ sansReponse: lu.sansReponse, nonRemontee: lu.nonRemontees.length > 0 });
      if (!texte) continue;
      // Un seul par dimanche : la clé se prend avant l'envoi.
      cle = `rappel:${jour}`;
      const { data: prise } = await service.from('nolio_envois')
        .upsert({ plan_id: planId, semaine: cle, coach_id: lu.o.coachId, seances: [] }, { onConflict: 'plan_id,semaine', ignoreDuplicates: true }).select('plan_id');
      if (!prise?.length) { cle = null; continue; }
      const d = await destinataire(lu.o.nolioAthlete);
      const r = await appelNolio('POST', 'planned/messages/', {
        description: texte, date_start: jour, hour_start: heure, show_to_the_athlete: false, ...(d.moi ? {} : { athletes: [d.usr] }),
      });
      if (r.statut !== 201 && r.statut !== 200) throw new Error(refusNolio(r, 'le rappel du dimanche'));
      cle = null;
      comptes.push({ plan: planId, quoi: `rappel programmé à ${heure}`, coache: lu.o.coache });
    } catch (e) {
      // Rien d'envoyé : la clé se libère, un nouvel appel peut le refaire.
      if (cle) await service.from('nolio_envois').delete().eq('plan_id', planId).eq('semaine', cle);
      comptes.push({ plan: planId, quoi: 'rappel non programmé', erreur: e instanceof Error ? e.message : String(e), coache });
    }
  }
  return { actif: true, texteValide: TEXTE_RAPPEL_VALIDE, comptes };
}
