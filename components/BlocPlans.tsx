import Reveal from './Reveal';
import { plansOffre } from '@/lib/content';

// Le bloc de l'accueil qui mène à la page des plans (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L2). Il
// n'apparaît qu'une fois les plans ouverts à tous (CTS_PLAN_OUVERT=1, le jour du lancement) : avant, la page
// des plans répond 404 sans le lien d'invitation.
export default function BlocPlans() {
  if (process.env.CTS_PLAN_OUVERT !== '1') return null;
  const b = plansOffre.blocAccueil;
  return (
    <section className="bg-sand py-16 lg:py-20">
      <Reveal>
        <div className="mx-auto max-w-4xl px-6 lg:px-10 flex flex-col sm:flex-row sm:items-center gap-8 justify-between">
          <div>
            <div className="eyebrow text-teal mb-3">{b.eyebrow}</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-indigo mb-3">{b.title}</h2>
            <p className="text-indigo/70 leading-relaxed max-w-xl">{b.texte}</p>
          </div>
          <a href={b.href} className="flex-shrink-0 inline-block bg-teal hover:bg-teal-light text-white font-bold px-8 py-4 tracking-cts uppercase text-sm">
            {b.cta}
          </a>
        </div>
      </Reveal>
    </section>
  );
}
