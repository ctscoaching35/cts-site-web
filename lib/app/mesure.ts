/**
 * La mesure du tunnel de vente (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L4, décision coach du
 * 13/10/2026) : des compteurs anonymes par jour (table mesures) — la page des plans vue, le questionnaire
 * commencé, le récapitulatif atteint, le paiement lancé — et les achats (table achats), relus semaine par
 * semaine dans l'espace coach. Les visites et leur provenance : Vercel Analytics. Côté serveur seulement.
 */
import { clientService } from './supabase';

export const ETAPES = ['offre', 'questionnaire', 'recap', 'paiement'] as const;
export type Etape = (typeof ETAPES)[number];

export async function compter(etape: Etape) {
  const { error } = await clientService().rpc('compter_mesure', { e: etape });
  if (error) throw new Error(`mesures : ${error.message}`);
}

export type Semaine = { lundi: string } & Record<Etape, number> & { achats: number; euros: number; rappels: number };

// Le lundi de la semaine d'une date (AAAA-MM-JJ).
const lundiDe = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

// Les semaines, de la plus récente à la plus ancienne, sur les 12 dernières.
export async function chiffresParSemaine(): Promise<Semaine[]> {
  const service = clientService();
  const depuis = new Date(Date.now() - 12 * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [{ data: mesures }, { data: achats }, { data: rappels }] = await Promise.all([
    service.from('mesures').select('jour, etape, n').gte('jour', depuis),
    // Sans les achats simulés par le coach (décision coach du 24/10/2026).
    service.from('achats').select('paye_le, montant_centimes').gte('paye_le', depuis).not('stripe_session', 'like', 'coach\\_%'),
    service.from('relances').select('accord_le').gte('accord_le', depuis),
  ]);
  const semaines = new Map<string, Semaine>();
  const semaine = (iso: string) => {
    const lundi = lundiDe(iso);
    if (!semaines.has(lundi)) semaines.set(lundi, { lundi, offre: 0, questionnaire: 0, recap: 0, paiement: 0, achats: 0, euros: 0, rappels: 0 });
    return semaines.get(lundi)!;
  };
  for (const m of mesures ?? []) semaine(m.jour)[m.etape as Etape] += m.n;
  for (const a of achats ?? []) {
    const s = semaine(a.paye_le);
    s.achats += 1;
    s.euros += (a.montant_centimes ?? 0) / 100;
  }
  for (const r of rappels ?? []) semaine(r.accord_le).rappels += 1;
  return [...semaines.values()].sort((x, y) => y.lundi.localeCompare(x.lundi));
}
