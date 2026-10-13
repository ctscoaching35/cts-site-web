import { compter, ETAPES, type Etape } from '@/lib/app/mesure';
import { supabaseConfigure } from '@/lib/app/supabase';

// Un « +1 » anonyme du tunnel de vente (lib/app/mesure.ts) : l'étape seule, rien d'autre.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const corps = (await request.json().catch(() => null)) as { etape?: unknown } | null;
  const etape = String(corps?.etape ?? '') as Etape;
  if (!ETAPES.includes(etape)) return new Response(null, { status: 400 });
  if (supabaseConfigure()) await compter(etape).catch((e) => console.error('Mesure :', e));
  return new Response(null, { status: 204 });
}
