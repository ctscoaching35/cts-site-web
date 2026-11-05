import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import EnTeteSimple from '@/components/app/EnTeteSimple';
import { BOUTON, Carte, LIEN, TITRE } from '@/components/app/Ui';
import { nomAffiche } from '@/lib/app/nomsSeances';
import type { Plan, Semaine } from '@/lib/app/plan';
import { clientService } from '@/lib/app/supabase';
import { garderSeanceOrigine } from '@/lib/app/ecriture';
import { clientServeur, supabaseConfigure } from '@/lib/app/supabase';
import { demonstrationOuverte, estPlanDeDemonstration } from '@/lib/app/demonstrationPorte';

// Le veto (CTS_NOLIO_CADRAGE.md, décision du 19/10/2026 : « Garder ma séance d'origine ») : le lien de la note Nolio d'une
// séance allégée par la fatigue mène ici ; un geste, et la séance d'origine revient dans Nolio.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ta séance d’origine' };

type Recherche = Promise<{ plan?: string; seance?: string; fait?: string }>;

async function garder(planId: string, seance: string) {
  'use server';
  // La démonstration (développement seulement) : rien ne revient dans Nolio, l'écran qui suit seulement.
  if (estPlanDeDemonstration(planId)) redirect(`/app/garder?plan=${planId}&seance=${encodeURIComponent(seance)}&fait=1`);
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const compte = data?.claims?.sub;
  if (!compte) redirect('/app/connexion');
  const ok = await garderSeanceOrigine(planId, seance, compte);
  redirect(`/app/garder?plan=${planId}&seance=${encodeURIComponent(seance)}&fait=${ok ? '1' : '0'}`);
}

// C45 (audits du 05/11/2026) : la séance d'origine, par son nom : celle que garde la semaine écrite (jours[].origine),
// sinon celle du plan ; en démonstration, celle du plan de démonstration.
async function seanceDOrigine(planId: string, seance: string, demonstration: boolean): Promise<string | null> {
  const numero = seance.split('-')[0];
  try {
    if (demonstration) {
      const { planDemo } = await import('@/lib/app/demonstration');
      return (await planDemo(planId)).plan.semaines.find((s) => s.numero === numero)?.jours.find((j) => j.id === seance)?.seance ?? null;
    }
    const service = clientService();
    const { data: ecrite } = await service.from('semaines_ecrites').select('donnees').eq('plan_id', planId).eq('numero', numero).maybeSingle();
    const jour = (ecrite?.donnees as Semaine | null)?.jours.find((j) => j.id === seance) as (Semaine['jours'][number] & { origine?: { seance?: string } }) | undefined;
    if (jour?.origine?.seance) return jour.origine.seance;
    const { data: plan } = await service.from('plans').select('donnees').eq('id', planId).maybeSingle();
    return (plan?.donnees as Plan | null)?.semaines.find((s) => s.numero === numero)?.jours.find((j) => j.id === seance)?.seance ?? null;
  } catch {
    return null;
  }
}

export default async function Garder({ searchParams }: { searchParams: Recherche }) {
  // En démonstration (développement seulement, sans Supabase) : un plan de la démonstration, sans session.
  const demonstration = !supabaseConfigure() && demonstrationOuverte();
  if (!supabaseConfigure() && !demonstration) redirect('/app');
  const { plan, seance, fait } = await searchParams;
  if (!demonstration) {
    const supabase = await clientServeur();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) redirect(`/app/connexion?suite=${encodeURIComponent(`/app/garder?plan=${plan ?? ''}&seance=${seance ?? ''}`)}`);
  }
  const valide = plan && seance && (demonstration ? estPlanDeDemonstration(plan) : /^[0-9a-f-]{36}$/.test(plan)) && /^S\d+-[a-z]+$/.test(seance);
  const nom = valide ? await seanceDOrigine(plan, seance, demonstration) : null;
  const jour = seance?.split('-')[1] ?? '';
  return (
    <>
      <EnTeteSimple />
      {/* Q4 (audits du 05/11/2026) : au style de l'app ; C1 : « ‹ Retour à l'app » à 44 px. */}
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <h1 className={TITRE}>Ta séance d’origine</h1>
        <Carte className="space-y-3">
          {!valide && <p className="text-sm text-[#4A4866]">Ce lien ne correspond à aucune séance.</p>}
          {valide && fait === '1' && <p className="text-sm text-teal font-semibold">C’est fait : ta séance d’origine est de retour dans Nolio.</p>}
          {valide && fait === '0' && (
            <p className="text-sm text-[#4A4866]">Cette séance n’a pas pu revenir : elle a peut-être déjà été retouchée dans Nolio.</p>
          )}
          {valide && !fait && (
            <>
              {/* C45 : la séance nommée. Validé par le coach le 05/11/2026 (1A). */}
              <p className="text-sm text-[#4A4866] leading-relaxed">
                {nom ? <>Ta séance de {jour}, <strong className="text-indigo">{nomAffiche(nom)}</strong>, a été allégée</> : `Ta séance de ${jour} a été allégée`} en
                endurance fondamentale à cause de signaux de fatigue. Si tu te sens bien, tu peux la remettre telle qu’elle
                était prévue.
              </p>
              <form action={garder.bind(null, plan, seance)}>
                <button type="submit" className={BOUTON}>Garder ma séance d’origine</button>
              </form>
            </>
          )}
        </Carte>
        <Link href="/app" className={LIEN}>‹ Retour à l’app</Link>
      </main>
    </>
  );
}
