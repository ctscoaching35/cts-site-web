import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CompterOffre from '@/components/CompterOffre';
import EnTetePlan from '@/components/plan/EnTetePlan';
import { plansOffre as t } from '@/lib/content';
import { API_URL } from '@/lib/plan';
import { planOuvert } from '@/lib/planAcces';

// La page des plans clé en main (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L2, décision coach du
// 13/10/2026). Fermée comme le questionnaire jusqu'au lancement (lib/planAcces.ts) ; les prix viennent de l'API.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Plan d’entraînement trail sur mesure — CTS Coaching',
  description:
    'Un plan trail construit sur ta course, ton niveau, ton terrain et tes disponibilités, dans une app, par la méthode de deux kinésithérapeutes du sport. Achat unique.',
};

async function prixParMois(): Promise<Record<string, number> | null> {
  try {
    const r = await fetch(`${API_URL}/v1/config`, { next: { revalidate: 3600 } });
    return r.ok ? (await r.json()).prix_eur_par_mois ?? null : null;
  } catch {
    return null;
  }
}

const BOUTON = 'inline-block bg-teal hover:bg-teal-light text-white font-bold px-8 py-4 tracking-cts uppercase text-sm';

function Coche() {
  return (
    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal/15 border border-teal flex items-center justify-center mt-0.5">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 6L5 9L10 3" stroke="#138F7C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function EnTeteSection({ eyebrow, title, clair = false }: { eyebrow: string; title: string; clair?: boolean }) {
  return (
    <div className="mb-10">
      <div className={`eyebrow mb-3 ${clair ? 'text-teal-light' : 'text-teal'}`}>{eyebrow}</div>
      <h2 className={`text-3xl sm:text-4xl font-extrabold leading-tight ${clair ? 'text-white' : 'text-indigo'}`}>{title}</h2>
    </div>
  );
}

export default async function PagePlans() {
  if (!(await planOuvert())) notFound();
  const prix = await prixParMois();
  const des = prix ? Math.min(...Object.values(prix)) : null;
  return (
    <div className="min-h-screen bg-sand">
      <CompterOffre />
      <EnTetePlan />
      <main>
        <section className="bg-indigo text-white">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
            <div className="eyebrow text-teal-light mb-4">{t.hero.eyebrow}</div>
            <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.05] mb-6">{t.hero.title}</h1>
            <p className="text-white/75 text-lg leading-relaxed max-w-2xl mb-10">{t.hero.subtitle}</p>
            <div className="flex flex-wrap items-center gap-6">
              <a href="/plan" className={BOUTON}>{t.hero.cta}</a>
              <span className="text-white/70 text-sm">
                {des !== null && <strong className="text-white text-base">Dès {des} €. </strong>}
                {t.hero.note}
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <EnTeteSection eyebrow={t.etapes.eyebrow} title={t.etapes.title} />
          <ol className="grid gap-6 sm:grid-cols-3">
            {t.etapes.items.map((e, i) => (
              <li key={e.titre} className="bg-white shadow-sm p-6">
                <div className="text-4xl font-black text-teal mb-3">{i + 1}</div>
                <h3 className="text-lg font-bold text-indigo mb-2">{e.titre}</h3>
                <p className="text-indigo/70 leading-relaxed text-sm">{e.texte}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
            <EnTeteSection eyebrow={t.contenu.eyebrow} title={t.contenu.title} />
            <ul className="space-y-4">
              {t.contenu.items.map((x) => (
                <li key={x} className="flex items-start gap-4 text-indigo/85 leading-relaxed">
                  <Coche />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20 grid gap-12 sm:grid-cols-2">
          <div>
            <EnTeteSection eyebrow={t.exemple.eyebrow} title={t.exemple.title} />
            <p className="text-indigo/75 leading-relaxed mb-6">{t.exemple.texte}</p>
            <a href={t.exemple.lien.href} target="_blank" rel="noopener" className="font-bold text-teal underline underline-offset-4">
              {t.exemple.lien.label} →
            </a>
          </div>
          <div>
            <EnTeteSection eyebrow={t.coachs.eyebrow} title={t.coachs.title} />
            <p className="text-indigo/75 leading-relaxed">{t.coachs.texte}</p>
          </div>
        </section>

        <section className="bg-indigo text-white">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
            <EnTeteSection eyebrow={t.prix.eyebrow} title={t.prix.title} clair />
            {prix && (
              <div className="grid gap-4 sm:grid-cols-3 mb-8">
                {t.prix.durees.map((d) => (
                  <div key={d.mois} className="border border-white/15 bg-white/5 p-6 text-center">
                    <div className="eyebrow text-white/60 mb-3">{d.mois} mois · {d.semaines} semaines</div>
                    <div className="text-5xl font-black text-teal-light">{prix[String(d.mois)]} €</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-white/70 leading-relaxed mb-8">{t.prix.note}</p>
            <a href="/plan" className={BOUTON}>{t.hero.cta}</a>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <EnTeteSection eyebrow={t.limites.eyebrow} title={t.limites.title} />
          <ul className="space-y-3 mb-6 list-disc pl-5 text-indigo/80 leading-relaxed">
            {t.limites.items.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <a href={t.limites.lienCoaching.href} className="font-bold text-teal underline underline-offset-4">
            {t.limites.lienCoaching.label} →
          </a>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
            <EnTeteSection eyebrow={t.faq.eyebrow} title={t.faq.title} />
            <div className="divide-y divide-indigo/10">
              {t.faq.items.map((f) => (
                <details key={f.q} className="py-4 group">
                  <summary className="cursor-pointer font-bold text-indigo list-none flex justify-between gap-4">
                    {f.q}
                    <span className="text-teal group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 text-indigo/75 leading-relaxed">{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-indigo mb-8">{t.fin.title}</h2>
          <a href="/plan" className={BOUTON}>{t.fin.cta}</a>
        </section>
      </main>
    </div>
  );
}
