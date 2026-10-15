import EnTetePlan from '@/components/plan/EnTetePlan';
import { vendeur } from '@/lib/legal';

// La mise en page des pages légales (CGV, mentions légales, confidentialité) : l'en-tête du parcours du plan, le texte
// sur une colonne lisible, les liens entre les trois pages en pied.
export function PageLegale({ titre, version, plans, children }: { titre: string; version?: string; plans: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand flex flex-col">
      <EnTetePlan />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
        <div className="eyebrow text-teal mb-3">{vendeur.nomCommercial}</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-indigo leading-tight">{titre}</h1>
        {version && <p className="mt-2 text-sm text-indigo/60">Version du {version}</p>}
        <div className="mt-10 space-y-10 text-indigo/85 leading-relaxed [&_a]:text-teal [&_a]:underline [&_a]:underline-offset-2 [&_a]:break-words">
          {children}
        </div>
      </main>
      <LiensLegaux plans={plans} />
    </div>
  );
}

export function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-indigo">{titre}</h2>
      {children}
    </section>
  );
}

export function Liste({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5">{children}</ul>;
}

// Le lien vers les CGV seulement quand les plans sont visibles (lib/legal.ts, plansVisibles).
export function LiensLegaux({ plans }: { plans: boolean }) {
  return (
    <footer className="bg-indigo-dark text-white/70 text-sm">
      <div className="mx-auto max-w-3xl px-6 py-6 flex flex-wrap gap-x-6 gap-y-2">
        <a href="/mentions-legales" className="hover:text-white">Mentions légales</a>
        {plans && <a href="/cgv" className="hover:text-white">Conditions générales de vente</a>}
        <a href="/confidentialite" className="hover:text-white">Confidentialité</a>
        <a href="/" className="hover:text-white">Retour au site</a>
      </div>
    </footer>
  );
}
