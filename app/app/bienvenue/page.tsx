import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import Installation from '@/components/app/Installation';
import { BOUTON, Carte, Surtitre } from '@/components/app/Ui';
import { entrerDansLePlan } from '@/lib/app/actionsBienvenue';
import { confirmationAVenir } from '@/lib/app/confirmation';
import { confirmationDemandee, invitationAVenir } from '@/lib/app/invitation';
import { contexte, lien, prenom, type Recherche } from '@/lib/app/contexte';
import { dateLongue } from '@/lib/app/plan';
import { donneesTableau } from '@/lib/app/tableauDuPlan';

export const metadata: Metadata = { title: 'Bienvenue' };

// L'écran de bienvenue (cadrage, 2.6), à la première ouverture sur un appareil : la course et
// la date de départ, sur quoi le plan se construit (la couverture du PDF), l'installation sur
// l'écran d'accueil, l'avertissement santé à lire avant d'entrer (un acheteur seulement : les CGV, article 4, y
// renvoient ; un coaché entre directement, décision coach du 20/10/2026).
export default async function Bienvenue({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const { plan } = ctx;
  const entrer = entrerDansLePlan.bind(null, lien('/app', ctx));
  // Un coaché entre directement dans l'app (décision coach du 20/10/2026 : « cette partie n'apporte rien ») ; son
  // installation est dans son Compte.
  if (ctx.coache) redirect(lien('/app', ctx));
  // Un acheteur (décision coach du 20/10/2026, les nuances des plans, point 3 : « l'essentiel », au format de l'app) : sa
  // course et ses chiffres, le début de sa préparation, ce que font Nolio et l'app (décision coach du 21/10/2026),
  // l'installation, l'avertissement santé à lire, « Entrer ». Plus de « fondements » à la première ouverture.
  const nom = prenom(plan.athlete.nom);
  const c = plan.couverture;
  // L'invitation le lundi de la semaine qui précède le départ (décision coach du 04/11/2026 au soir) ; confirmer : ce
  // jour-là, l'app lui demandera si sa charge a changé (un achat fait plus de 3 semaines avant).
  const inviteLe = invitationAVenir(plan.course.date_debut_plan, ctx.jour);
  const confirmer = Boolean(inviteLe && (ctx.demo ? confirmationDemandee(plan.course.date_debut_plan, ctx.demo.achat)
    : await confirmationAVenir(ctx.cle).catch(() => false)));
  // C10 (audits du 05/11/2026) : l'écran revient une fois par appareil (sur iPhone, l'app installée a ses propres cookies :
  // il y redit les consignes d'installation, cadrage 2.6) ; ses deux phrases suivent le moment. La préparation « a
  // commencé » une fois partie ; plus de « Nolio t'écrit dans quelques minutes » une fois l'invitation partie, rien une
  // fois l'athlète dans l'équipe.
  const nolio = (await donneesTableau(ctx).catch(() => null))?.nolio ?? null;
  const commencee = ctx.jour >= plan.course.date_debut_plan;
  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-4">
      <div className="text-center space-y-2">
        {/* C11 : le logo de l'en-tête, sans le disque gris qui n'est pas de la charte. */}
        <Image src="/logo/cts-logo-white.png" alt="CTS Coaching" width={64} height={64} className="mx-auto w-16 h-16 object-contain" />
        {/* Le nom de l'offre (O1 ; décision coach du 20/10/2026, point 5). */}
        <div className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal">Préparation CTS</div>
        <h1 className="text-[1.75rem] font-extrabold text-indigo tracking-tight leading-tight">{nom ? `Bienvenue ${nom}` : 'Bienvenue'}</h1>
        <p className="text-[0.8125rem] text-[#5E5C78]">{plan.course.nom} · {plan.course.format_clair}</p>
      </div>

      <dl className="grid grid-cols-2 gap-2.5">
        {c.reperes.map(([cle, valeur]) => (
          <div key={cle} className="bg-white rounded-2xl border border-indigo/[0.08] px-3.5 py-3">
            <dt className="text-[0.625rem] font-bold tracking-[0.1em] uppercase text-[#5E5C78]">{cle}</dt>
            <dd className="mt-1 text-[1rem] font-extrabold text-indigo leading-snug">{valeur}</dd>
          </div>
        ))}
      </dl>

      <Carte className="text-center">
        {/* BROUILLON, à valider par le coach (« Ta préparation a commencé le … »). */}
        <p className="text-[0.9375rem] font-bold text-indigo">{commencee ? `Ta préparation a commencé le ${dateLongue(plan.course.date_debut_plan, true).replace(/^\S+ /, '')}.` : c.debut}</p>
        <p className="mt-1 text-[0.8125rem] text-[#5E5C78]">{c.rendez_vous}</p>
      </Carte>

      <Carte className="text-[0.8125rem] text-[#4A4866] leading-relaxed space-y-1">
        <p><strong className="text-indigo">Nolio</strong> : tes séances, au jour le jour, jusqu’à ta montre.</p>
        <p><strong className="text-indigo">L’app CTS</strong> : ta course, ta préparation, tes données et tes fiches.</p>
        {/* B-PL-45 : l'invitation à accepter, dite dès la première ouverture ; une semaine avant le départ pour une
            préparation lointaine. */}
        {nolio !== 'actif' && nolio !== 'sorti' && nolio !== 'arrete' && nolio !== 'coaching' && (
          <p className="pt-1">
            {/* BROUILLON, à valider par le coach (« Nolio t'a écrit »). */}
            {inviteLe ? `Nolio t’écrira le ${dateLongue(inviteLe)}, une semaine avant ta première semaine`
              : nolio === 'invite' || nolio === 'refuse' ? 'Nolio t’a écrit' : 'Nolio t’écrit dans quelques minutes'} :
            accepte son invitation dans l’équipe CTS, ou connecte-toi avec les identifiants reçus. Pense à regarder dans tes indésirables.
            {confirmer && ' Ce jour-là, ton app te demande aussi si ce que tu cours a changé depuis ton achat.'}
          </p>
        )}
      </Carte>

      {/* C11 : sans le titre « Installer l'app », qui redisait le bouton. */}
      <Carte className="space-y-2.5">
        <Installation />
      </Carte>

      <Carte className="space-y-2.5">
        <Surtitre>{plan.avertissement.surtitre}</Surtitre>
        {plan.avertissement.paragraphes.map((p, i) => (
          <p key={i} className="text-[0.8125rem] text-[#4A4866] leading-relaxed">{p}</p>
        ))}
      </Carte>

      <form action={entrer}>
        {/* Q4 : le bouton de l'app ; « Entrer » reste après l'avertissement santé, qui doit être lu (CGV). */}
        <button type="submit" className={`${BOUTON} w-full`}>Entrer</button>
      </form>
    </main>
  );
}
