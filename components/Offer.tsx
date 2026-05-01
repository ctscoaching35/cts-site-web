import Reveal from './Reveal';
import { offer } from '@/lib/content';

export default function Offer() {
  return (
    <section
      id="offre"
      className="relative bg-indigo text-white py-24 lg:py-36 overflow-hidden"
    >
      {/* Décoration de fond */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-teal/10 blur-3xl -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-teal/5 blur-3xl translate-y-1/3 -translate-x-1/3" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Reveal>
            <span className="eyebrow text-teal-light block mb-4">{offer.eyebrow}</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-6">
              {offer.title}
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-white/70 text-lg leading-relaxed">{offer.subtitle}</p>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="relative bg-gradient-to-br from-indigo-soft/40 to-indigo-dark border border-white/10 max-w-2xl mx-auto backdrop-blur-sm">
            {/* Ribbon */}
            <div className="absolute -top-4 left-10 bg-teal text-white text-[11px] font-bold tracking-cts uppercase px-4 py-2">
              Formule unique
            </div>

            <div className="p-10 lg:p-14">
              <div className="text-center mb-10 pb-10 border-b border-white/10">
                <h3 className="eyebrow text-white/70 mb-6">{offer.card.label}</h3>
                <div className="flex items-baseline justify-center gap-2 mb-3">
                  <span className="text-7xl lg:text-8xl font-black text-teal-light">
                    {offer.card.price}
                  </span>
                  <span className="text-white/60 text-xl font-medium">
                    {offer.card.pricePeriod}
                  </span>
                </div>
                <span className="inline-block text-xs tracking-cts uppercase font-semibold text-white/60 px-4 py-1 border border-white/20">
                  {offer.card.commitment}
                </span>
              </div>

              <ul className="space-y-4 mb-10">
                {offer.card.features.map((feat, i) => (
                  <li
                    key={feat}
                    className="flex items-start gap-4 text-white/90"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal/20 border border-teal flex items-center justify-center mt-0.5">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="#138F7C"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>

              <a
                href={offer.card.cta.href}
                className="btn btn-primary w-full !text-sm"
              >
                {offer.card.cta.label} →
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
