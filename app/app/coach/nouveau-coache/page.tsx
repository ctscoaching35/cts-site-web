import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import NouveauCoache from '@/components/app/NouveauCoache';
import { equipeNolio } from '@/lib/app/espaceCoach';
import { moteurEstV9 } from '@/lib/app/moteurEnLigne';
import { messageDAccord } from '@/lib/app/messageAccord';
import { usrAcheteurs } from '@/lib/app/acheteurs';
import { exigerCoach } from '@/lib/app/nolio';
import { clientService, espaceCoachOuvert } from '@/lib/app/supabase';

export const dynamic = 'force-dynamic';

// « Nouveau coaché » (décision 241 du coach, 25/11/2026, moment 1), sous la 9.x seulement : sous la 8.x, « Ajouter un athlète » reste le questionnaire (/app/coach/nouveau).
export default async function NouveauCoachePage() {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  if (!(await moteurEstV9().catch(() => false))) notFound();
  const { nolio } = await equipeNolio();
  const acheteurs = await usrAcheteurs(coach.compteId).catch(() => new Set<string>());
  // Les athlètes de son équipe Nolio sans les acheteurs de plans (une fiche déjà créée d'elle-même est reprise, pas doublée) ; « (toi) » compris, pour sa fiche de test.
  const choix = (nolio ?? []).filter((a) => !acheteurs.has(a.id)).map((a) => ({ id: a.id, nom: a.name })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const { data: compte } = await clientService().from('comptes').select('nom').eq('id', coach.compteId).maybeSingle();
  const prenom = String(compte?.nom ?? '').trim().split(/\s+/)[0];
  return (
    <CadreCoach actif="athletes">
      <div className="max-w-2xl space-y-5">
        <Link href="/app/coach" className="inline-flex items-center min-h-9 text-[0.8125rem] font-bold text-teal">‹ Mes athlètes</Link>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Nouveau coaché</h1>
        <NouveauCoache nolio={choix} message={messageDAccord(prenom)} />
      </div>
    </CadreCoach>
  );
}
