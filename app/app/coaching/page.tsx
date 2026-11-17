import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import EnTeteGratuit from '@/components/app/EnTeteGratuit';
import FormulaireCoaching, { type CourseDuCompte } from '@/components/app/FormulaireCoaching';
import { pageGratuite } from '@/lib/app/accesGratuit';
import { reponsesSures } from '@/lib/app/coachingRegles';
import { clientServeur } from '@/lib/app/supabase';
import { gratuitOuvert } from '@/lib/app/gratuit';

// Le titre seulement quand l'app gratuite est ouverte pour cette visite : en mode « coupe », la page est introuvable et
// son titre ne transparaît pas (le titre par défaut, comme toute adresse inexistante).
export async function generateMetadata(): Promise<Metadata> {
  return (await gratuitOuvert()) ? { title: 'Demander le coaching' } : {};
}
export const dynamic = 'force-dynamic';

// « Demander le coaching » (app gratuite, lot A2 ; maquette du 16/11/2026, décisions du coach du même jour) : passe par un compte,
// dont le code par e-mail prouve l'adresse. Un visiteur est envoyé vers « Me connecter », puis revient ici. Un compte déjà
// coaché (ou un acheteur) est renvoyé à son accueil par pageGratuite : il ne voit pas ce formulaire. Ce que l'app sait déjà
// (expérience, tests, courses) n'est pas redemandé.
const jourCourt = (iso: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(`${iso}T12:00:00Z`)).replace(/^1 /, '1er ');

export default async function Coaching() {
  const acces = await pageGratuite();
  if (acces.cas === 'visiteur' || !acces.compteId) redirect('/app/me-connecter?suite=/app/coaching');
  const supabase = await clientServeur();
  const { data: lignes } = await supabase.from('courses_gratuites').select('id, nom, course_date, distance_km, dplus_m')
    .eq('compte_id', acces.compteId).order('course_date', { ascending: true, nullsFirst: false });
  const courses: CourseDuCompte[] = (lignes ?? []).map((c) => ({
    id: String(c.id), nom: String(c.nom),
    resume: [c.course_date ? jourCourt(c.course_date) : null, c.distance_km != null ? `${Number(c.distance_km).toLocaleString('fr-FR')} km` : null,
      c.dplus_m != null ? `${Number(c.dplus_m).toLocaleString('fr-FR')} m D+` : null].filter(Boolean).join(' · '),
  }));
  const { data: d } = await supabase.from('demandes_coaching').select('reponses, sante, consentement_sante_le, telephone, moments, envoyee_le, statut')
    .eq('compte_id', acces.compteId).maybeSingle();
  return (
    <>
      <EnTeteGratuit acces={acces} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6">
        <FormulaireCoaching
          experienceConnue={null}
          courses={courses}
          envoyeeLe={d ? String(d.envoyee_le) : null}
          demande={d ? {
            reponses: reponsesSures(d.reponses), sante: d.sante ?? null, consentementSante: Boolean(d.consentement_sante_le),
            telephone: String(d.telephone ?? ''), moments: Array.isArray(d.moments) ? d.moments.filter((m: unknown): m is string => typeof m === 'string') : [],
          } : null} />
      </main>
    </>
  );
}
