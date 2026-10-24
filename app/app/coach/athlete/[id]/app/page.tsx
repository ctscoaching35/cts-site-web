import Link from 'next/link';
import { notFound } from 'next/navigation';
import AccueilAthlete from '@/components/app/AccueilAthlete';
import { ficheAthlete } from '@/lib/app/coaching';
import { contexteDeLaFiche, prenom } from '@/lib/app/contexte';
import { exigerCoach } from '@/lib/app/nolio';
import { supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Voir son app » (maquette validée par le coach le 24/10/2026) : l'accueil d'un coaché tel qu'il le voit, depuis sa
// fiche, en lecture seule. Rien ne s'y clique (inert) : ses liens ouvriraient l'app du coach, pas la sienne ; « Pour
// bien démarrer » n'y est pas, c'est une liste à lui.
export default async function VueDuCoache({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { id } = await params;
  const a = await ficheAthlete(coach.compteId, id);
  if (!a) notFound();
  const ctx = await contexteDeLaFiche(a.id);
  // Son contexte choisit déjà son prochain objectif : passée sa dernière course, il n'en a pas d'autre.
  const aVenir = async () => false;
  return (
    <div className="min-h-screen bg-sand">
      <div className="bg-indigo text-white">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs leading-snug">
            <strong className="block text-[0.8125rem]">Vue de {prenom(a.nom) || a.nom}</strong>
            telle que son app la montre · lecture seule
          </p>
          <Link href={`/app/coach/athlete/${a.id}`} className="inline-flex items-center min-h-11 px-3 rounded-[10px] bg-white/15 text-[0.8125rem] font-bold shrink-0">
            ‹ Sa fiche
          </Link>
        </div>
      </div>
      <div inert>
        <AccueilAthlete ctx={ctx} demarrage={false} aVenir={aVenir} />
      </div>
    </div>
  );
}
