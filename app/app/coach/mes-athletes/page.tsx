import { redirect } from 'next/navigation';

// « Mes athlètes » est l'accueil de l'espace coach (l'espace par athlète, maquette validée par le coach le 08/11/2026) :
// son ancienne adresse y renvoie, son filtre avec elle.
export default async function MesAthletes({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre } = await searchParams;
  redirect(filtre ? `/app/coach?filtre=${encodeURIComponent(filtre)}` : '/app/coach');
}
