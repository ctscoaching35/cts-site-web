import Image from 'next/image';
import Installation from '@/components/app/Installation';
import { Avertissement } from '@/components/app/Texte';
import { entrerDansLePlan } from '@/lib/app/actionsBienvenue';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';

// L'écran de bienvenue (cadrage, 2.6), à la première ouverture sur un appareil : la course et
// la date de départ, sur quoi le plan se construit (la couverture du PDF), l'installation sur
// l'écran d'accueil, l'avertissement santé à lire avant d'entrer.
export default async function Bienvenue({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const entrer = entrerDansLePlan.bind(null, lien('/app', ctx));
  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <Image src="/logo/cts-logo-rond-navy.png" alt="CTS Coaching" width={64} height={64} className="mx-auto w-16 h-16" />
        <div className="eyebrow text-teal">{plan.couverture.surtitre}</div>
        <h1 className="text-3xl text-indigo">Bienvenue</h1>
        <p className="text-indigo/70">
          {plan.course.nom} · {plan.course.format_clair}
        </p>
      </div>

      <dl className="grid grid-cols-4 bg-white shadow-sm border-t-2 border-teal">
        {plan.couverture.reperes.map(([cle, valeur]) => (
          <div key={cle} className="text-center px-1 py-3">
            <dt className="text-[0.58rem] font-bold tracking-cts-tight uppercase text-teal">{cle}</dt>
            <dd className="font-extrabold text-indigo text-sm leading-tight mt-0.5">{valeur}</dd>
          </div>
        ))}
      </dl>
      <div className="text-center px-2">
        <p className="font-semibold text-indigo">{plan.couverture.debut}</p>
        <p className="text-sm text-indigo/60">{plan.couverture.rendez_vous}</p>
      </div>

      <section>
        <h2 className="eyebrow text-indigo text-center mb-3">{plan.demarche.titre}</h2>
        <div className="grid grid-cols-2 gap-2">
          {plan.demarche.piliers.map(([titre, texte]) => (
            <div key={titre} className="bg-white shadow-sm p-3 text-center">
              <div className="text-[0.62rem] font-bold tracking-cts-tight uppercase text-teal mb-1">{titre}</div>
              <p className="text-xs text-indigo/75 leading-relaxed">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white shadow-sm p-4 space-y-2">
        <h2 className="font-bold text-indigo">Ton plan sur ton écran d’accueil</h2>
        <Installation />
      </section>

      <Avertissement avertissement={plan.avertissement} />

      <form action={entrer}>
        <button type="submit" className="btn btn-primary w-full">Entrer dans mon plan</button>
      </form>
    </main>
  );
}
