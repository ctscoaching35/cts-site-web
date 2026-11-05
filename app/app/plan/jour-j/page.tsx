import { redirect } from 'next/navigation';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';

// Q10 (décision coach du 05/11/2026 au soir, « A ») : la page « Ton jour J » redisait mot pour mot la fin de la fiche de
// course ; elle est retirée. Son adresse (un lien gardé, une note) mène à la fiche, à sa partie « Ton jour J ».
export default async function JourJ({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  redirect(`${lien('/app/plan/course', ctx)}#jour-j`);
}
