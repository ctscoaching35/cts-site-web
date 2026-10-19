import Link from 'next/link';
import { Lignes } from './Texte';
import { ficheParSlug, lireBibliotheque } from '@/lib/app/bibliotheque';

// La stratégie de course (décisions coach du 19/10/2026) : la durée d'effort visée, puis le calculateur « Ta
// nutrition en course », prérempli avec cette durée et le niveau (pour la course, le calculateur fait foi : la fiche ne
// donne plus de g/h ; les repères du moteur restent ceux des sorties longues). Dessous, les fiches de la bibliothèque
// qui préparent la course, de la check-list à la récupération : elles remplacent les conseils génériques de la semaine
// de course, du matin, de pendant et d'après, trop vagues (retour du coach du 19/10/2026). Titres et résumés lus dans
// l'index de la bibliothèque, jamais recopiés. fiche : l'adresse d'une fiche par son slug ; externe : des liens de page
// (la fiche privée, hors de l'app) ; ultra : au-delà de 8h d'effort (jour_j.fiche_ultra).
const FICHES_DE_COURSE = ['checklist', 'nutrition-avant-course', 'nutrition', 'ultra', 'recuperation'];

export default function StrategieCourse({ lignes, href, fiche, ultra, externe = false }: {
  lignes: [string, string][]; href: string; fiche: (slug: string) => string; ultra: boolean; externe?: boolean;
}) {
  const duree = lignes.find(([cle]) => cle.startsWith('Durée'));
  const bouton = 'inline-flex items-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold';
  const familles = lireBibliotheque();
  const fiches = FICHES_DE_COURSE.filter((s) => ultra || s !== 'ultra')
    .map((slug) => ({ slug, f: ficheParSlug(familles, slug) }))
    .filter((x): x is { slug: string; f: NonNullable<typeof x.f> } => Boolean(x.f));
  const ligne = 'flex items-center justify-between gap-3 min-h-[52px] py-2';
  return (
    <>
      {duree && <Lignes lignes={[duree]} />}
      <p className="text-sm text-indigo/75 leading-relaxed">
        Ta stratégie de course se construit avec le calculateur : il part de ta durée et de ton niveau, et tient compte de
        ton intestin, de la chaleur et de ta sueur. Glucides, boisson, sodium et caféine, heure par heure.
      </p>
      {externe ? <a href={href} className={bouton}>Construis ta stratégie de course</a>
        : <Link href={href} className={bouton}>Construis ta stratégie de course</Link>}
      {fiches.length > 0 && (
        <div className="pt-3">
          <h3 className="text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#5E5C78]">À lire avant ta course</h3>
          <ul className="mt-1">
            {fiches.map(({ slug, f }) => {
              const contenu = (
                <>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-indigo">{f.titre}</span>
                    <span className="block text-[0.75rem] text-[#5E5C78] mt-0.5 leading-snug">{f.texte}</span>
                  </span>
                  <span aria-hidden className="text-[#5E5C78]">›</span>
                </>
              );
              return (
                <li key={slug} className="border-b last:border-b-0 border-indigo/[0.06]">
                  {externe ? <a href={fiche(slug)} className={ligne}>{contenu}</a>
                    : <Link href={fiche(slug)} className={ligne}>{contenu}</Link>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
