import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { Deconnexion } from './BoutonsCompte';
import LienDemandes from './LienDemandes';
import { demonstrationCoachOuverte, jourSimuleEnClair, MOMENTS } from '@/lib/app/demonstrationCoach';
import { moteurEstV9 } from '@/lib/app/moteurEnLigne';
import { liensDuMenu, rubriqueActive, rubriqueDeLaPastille, type RubriqueCoach } from '@/lib/app/espaceCoachSimple';

// Le cadre de l'espace coach (maquettes validées par le coach le 19/10/2026, puis le 24/10/2026) : un menu à gauche sur
// ordinateur, au-dessus du contenu sur téléphone. L'espace réorganisé par athlète (décision « 1A » du coach et maquette
// validée le 08/11/2026, « tout A ») : trois entrées, Mes athlètes (l'accueil : la liste, puis la page de chacun),
// Urgent (la seule vue transversale, regardée chaque jour, avec sa pastille) et Chiffres (sa comptabilité). « Cette
// semaine » et « Dimanche » ne sont plus dans le menu : fondues dans la liste, la page de chaque athlète et « Urgent ».
// Plus de Bibliothèque (décision coach du 20/10/2026) ni de lien « Voir l'app d'un athlète » : chaque version se voit par
// son propre compte (coach, coaché, acheteur).
// Lot A2 de l'app gratuite : « Demandes », les demandes de coaching (le premier coach de CTS_COACHS, app gratuite ouverte seulement).
// SOUS LA 9.x (décision 220 du coach, 24/11/2026 : « un seul endroit pour ce qui est à faire ») : plus d'entrée « Urgent », ses points sont dans
// « Mes athlètes » et la pastille y passe (lib/app/espaceCoachSimple.ts). Sous la 8.x, le menu est celui d'avant.
export type { RubriqueCoach };

// urgents : le nombre d'athlètes qui ont au moins une ligne dans « Urgent », le même sur chaque page qui le donne. Plus de
// nom du coach ni de « Nolio relié » en bas du menu (décision coach du 04/11/2026).
export default async function CadreCoach({ actif: demande, urgents = 0, children }: {
  actif: RubriqueCoach; urgents?: number; children: React.ReactNode;
}) {
  const v9 = await moteurEstV9().catch(() => false);
  const liens = liensDuMenu(v9);
  const actif = rubriqueActive(demande, v9);
  const pastille = rubriqueDeLaPastille(v9);
  return (
    <div className="min-h-screen flex flex-wrap bg-sand text-indigo">
      <aside className="flex-[1_1_220px] lg:max-w-[260px] bg-indigo text-white px-4 py-5 lg:py-6 flex flex-col gap-5">
        <Link href="/app/coach" className="flex items-center gap-2.5 px-2">
          <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
            <Image src="/logo/cts-logo-rond-blanc.png" alt="CTS Coaching" width={32} height={32} className="w-8 h-8 object-contain" />
          </span>
          <span>
            <span className="block text-xs font-bold tracking-[0.12em]">CTS COACHING</span>
            <span className="block text-[0.6875rem] text-[#B9B8CC]">Espace coach</span>
          </span>
        </Link>
        <nav aria-label="Espace coach" className="flex flex-row flex-wrap lg:flex-col gap-1">
          {liens.map(([cle, titre, href]) => (
            <Link key={cle} href={href} aria-current={cle === actif ? 'page' : undefined}
              className={clsx('flex items-center justify-between gap-2 min-h-11 px-3 rounded-[10px] text-sm',
                cle === actif ? 'bg-white/10 text-white font-bold' : 'text-[#D6D5E6] font-semibold hover:bg-white/5')}>
              <span>{titre}</span>
              {cle === pastille && urgents > 0 && (
                <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-[#2BB39B] text-[#10302B] text-xs font-extrabold inline-flex items-center justify-center">{urgents}</span>
              )}
            </Link>
          ))}
          <LienDemandes actif={actif === 'demandes'} />
        </nav>
        {/* Changer de compte : coach, coaché ou acheteur, chacun voit sa version par son compte. */}
        <div className="-mt-3"><Deconnexion menu /></div>
      </aside>
      <main className="flex-[999_1_560px] min-w-0 px-4 py-5 sm:px-8 sm:py-8">
        <div className="max-w-5xl space-y-6">{children}</div>
      </main>
      {demonstrationCoachOuverte() && <Demonstration />}
    </div>
  );
}

// La démonstration (lib/app/demonstrationCoach.ts, développement seulement) : posée par-dessus la page, repliée, pour ne
// rien changer à sa mise en page ; le jour simulé et ses moments.
function Demonstration() {
  return (
    <details className="fixed bottom-3 left-3 z-50 max-w-[calc(100vw-1.5rem)] w-[14.5rem] rounded-xl bg-[#1F1D3A] text-white text-xs shadow-lg ring-1 ring-white/15">
      <summary className="cursor-pointer list-none px-3 py-2 font-bold">Démonstration · {jourSimuleEnClair()}</summary>
      <div className="px-3 pb-3 space-y-2 text-[#D6D5E6]">
        <p>Dix coachés fictifs ; rien ne s’enregistre, rien ne part dans Nolio. Le jour simulé :</p>
        <ul className="space-y-1">
          {MOMENTS.map(([jour, texte]) => <li key={jour}><a href={`?jour=${jour}`} className="font-semibold text-[#8FD1C3] underline">{texte}</a></li>)}
        </ul>
      </div>
    </details>
  );
}
