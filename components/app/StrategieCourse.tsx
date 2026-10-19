import Link from 'next/link';
import { Lignes } from './Texte';

// La stratégie nutritionnelle de course (décision coach du 20/10/2026 : pour la course, le calculateur fait foi) :
// la durée d'effort visée, puis le calculateur « Ta nutrition en course », prérempli avec cette durée et le niveau ; il
// tient compte de l'intestin, de la chaleur, de la sueur. Les repères du moteur restent ceux des sorties longues, pour
// l'entraînement : la fiche ne donne plus de g/h. externe : un lien de page (la fiche privée, hors de l'app).
export default function StrategieCourse({ lignes, href, externe = false }: { lignes: [string, string][]; href: string; externe?: boolean }) {
  const duree = lignes.find(([cle]) => cle.startsWith('Durée'));
  const bouton = 'inline-flex items-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold';
  return (
    <>
      {duree && <Lignes lignes={[duree]} />}
      <p className="text-sm text-indigo/75 leading-relaxed">
        Ta stratégie de course se construit avec le calculateur : il part de ta durée et de ton niveau, et tient compte de
        ton intestin, de la chaleur et de ta sueur. Glucides, boisson, sodium et caféine, heure par heure.
      </p>
      {externe ? <a href={href} className={bouton}>Construis ta stratégie de course</a>
        : <Link href={href} className={bouton}>Construis ta stratégie de course</Link>}
    </>
  );
}
