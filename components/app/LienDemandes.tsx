import Link from 'next/link';
import clsx from 'clsx';
import { coachDesDemandes, nombreDeDemandesOuvertes } from '@/lib/app/demandesCoaching';
import { demonstrationCoachOuverte } from '@/lib/app/demonstrationCoach';
import { modeAppGratuite } from '@/lib/app/gratuitRegles';
import { coachConnecte } from '@/lib/app/nolio';

// Les demandes de coaching dans l'espace du coach (app gratuite, lot A2) : l'entrée du menu et sa pastille, et la carte de
// l'accueil. Rien du tout tant que l'app gratuite est coupée, en démonstration, et pour un coach qui n'est pas le premier de
// CTS_COACHS (Juliette ne les voit pas).
async function nombrePourCeCoach(): Promise<number | null> {
  if (modeAppGratuite() === 'coupe' || demonstrationCoachOuverte()) return null;
  const coach = await coachConnecte();
  if (!coach || !coachDesDemandes(coach)) return null;
  return nombreDeDemandesOuvertes();
}

export default async function LienDemandes({ actif }: { actif: boolean }) {
  const n = await nombrePourCeCoach();
  if (n === null) return null;
  return (
    <Link href="/app/coach/demandes" aria-current={actif ? 'page' : undefined}
      className={clsx('flex items-center justify-between gap-2 min-h-11 px-3 rounded-[10px] text-sm',
        actif ? 'bg-white/10 text-white font-bold' : 'text-[#D6D5E6] font-semibold hover:bg-white/5')}>
      <span>Demandes</span>
      {n > 0 && <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-[#2BB39B] text-[#10302B] text-xs font-extrabold inline-flex items-center justify-center">{n}</span>}
    </Link>
  );
}

// Sur l'accueil du coach : une carte quand au moins une demande attend.
export async function CarteDemandes() {
  const n = await nombrePourCeCoach();
  if (!n) return null;
  return (
    <Link href="/app/coach/demandes" className="flex items-center justify-between gap-3 min-h-12 px-5 py-3 rounded-2xl bg-white border border-teal/40 text-sm font-bold text-indigo">
      <span className="flex items-center gap-2.5">
        <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-[#2BB39B] text-[#10302B] text-xs font-extrabold inline-flex items-center justify-center">{n}</span>
        {n > 1 ? 'demandes de coaching à lire' : 'demande de coaching à lire'}
      </span>
      <span aria-hidden className="text-teal">›</span>
    </Link>
  );
}
