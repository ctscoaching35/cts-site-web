import Link from 'next/link';
import { texteDeLaSuite } from '@/lib/app/jonction';

// La suite d'un objectif couru, sa récupération finie (la continuité entre deux objectifs, décisions coach du
// 08/11/2026) : la page de l'objectif et son aperçu du dimanche. Le nom de l'objectif suivant mène à sa page ; sans
// objectif suivant (null), plus rien ne s'écrit.
export default function SuiteDeLObjectif({ suite }: { suite: { id: string; course_nom: string; depart: string } | null }) {
  const t = texteDeLaSuite(suite);
  return (
    <>
      {t.avant}
      {suite && t.course ? <Link href={`/app/coach/plan/${suite.id}`} className="font-bold underline">{t.course}</Link> : null}
      {t.apres}
    </>
  );
}
