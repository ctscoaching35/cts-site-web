import EnTeteApp from '../EnTeteApp';
import EnTeteGratuit from '../EnTeteGratuit';
import type { Acces } from '@/lib/app/acces';
import { contexte } from '@/lib/app/contexte';
import type { GenreCourses } from '@/lib/app/accesCourses';

// L'en-tête des pages des dossiers : celui de l'app gratuite, ou celui de l'app payante pour un compte qui y a ses dossiers.
export default async function EnTeteDesCourses({ acces, genre }: { acces: Acces; genre: GenreCourses }) {
  if (genre !== 'ancien') return <EnTeteGratuit acces={acces} />;
  return <EnTeteApp ctx={await contexte(Promise.resolve({}), { sansObjectif: true })} />;
}
