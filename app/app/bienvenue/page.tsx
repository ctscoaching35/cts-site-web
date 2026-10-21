import Image from 'next/image';
import { redirect } from 'next/navigation';
import Installation from '@/components/app/Installation';
import { Carte, Surtitre } from '@/components/app/Ui';
import { entrerDansLePlan } from '@/lib/app/actionsBienvenue';
import { contexte, lien, prenom, type Recherche } from '@/lib/app/contexte';

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
  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-4">
      <div className="text-center space-y-2">
        <Image src="/logo/cts-logo-rond-navy.png" alt="CTS Coaching" width={64} height={64} className="mx-auto w-16 h-16" />
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
        <p className="text-[0.9375rem] font-bold text-indigo">{c.debut}</p>
        <p className="mt-1 text-[0.8125rem] text-[#5E5C78]">{c.rendez_vous}</p>
      </Carte>

      <Carte className="text-[0.8125rem] text-[#4A4866] leading-relaxed space-y-1">
        <p><strong className="text-indigo">Nolio</strong> : tes séances, au jour le jour, jusqu’à ta montre.</p>
        <p><strong className="text-indigo">L’app CTS</strong> : ta course, ta préparation, tes données et tes fiches.</p>
      </Carte>

      <Carte className="space-y-2.5">
        <Surtitre>Installer l’app</Surtitre>
        <Installation />
      </Carte>

      <Carte className="space-y-2.5">
        <Surtitre>{plan.avertissement.surtitre}</Surtitre>
        {plan.avertissement.paragraphes.map((p, i) => (
          <p key={i} className="text-[0.8125rem] text-[#4A4866] leading-relaxed">{p}</p>
        ))}
      </Carte>

      <form action={entrer}>
        <button type="submit" className="btn btn-primary w-full">Entrer</button>
      </form>
    </main>
  );
}
