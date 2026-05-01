import Image from 'next/image';
import Reveal from './Reveal';
import { testimonials } from '@/lib/content';

export default function Testimonials() {
  return (
    <section id="testimonials" className="relative bg-sand py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid lg:grid-cols-[auto,1fr] gap-12 lg:gap-20 items-end mb-16 lg:mb-20">
          <div className="max-w-xl">
            <Reveal>
              <span className="eyebrow text-teal block mb-4">
                {testimonials.eyebrow}
              </span>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-indigo text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05]">
                {testimonials.title}
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <div className="hidden lg:block h-px w-full bg-indigo/15 mb-4" />
          </Reveal>
        </div>

        {/* Grille asymétrique — décalage vertical pour casser la symétrie */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.items.map((t, i) => (
            <Reveal key={t.initial + t.meta} delay={0.1 + i * 0.1}>
              <article
                className="group relative h-full flex flex-col bg-white p-8 lg:p-10 transition-transform duration-500 hover:-translate-y-2"
                style={{
                  // Décalage subtil pour briser l'alignement parfait (taste-skill rule)
                  transform: i === 1 ? 'translateY(24px)' : undefined,
                }}
              >
                {/* En-tête : avatar silhouette + meta */}
                <header className="flex items-center gap-4 mb-8 pb-6 border-b border-indigo/10">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-teal/30 flex-shrink-0">
                    <Image
                      src={t.photo}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover blur-[3px] scale-110"
                      aria-hidden="true"
                    />
                    <div className="absolute inset-0 bg-indigo/30" />
                    <div className="absolute inset-0 flex items-center justify-center text-white text-base font-extrabold tracking-wider">
                      {t.initial}
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold tracking-cts uppercase text-indigo/55 leading-tight">
                    {t.meta}
                  </div>
                </header>

                {/* Citation — guillemet aligné à la ligne, taille mesurée */}
                <blockquote className="flex-grow mb-8">
                  <span
                    aria-hidden="true"
                    className="inline-block text-teal text-2xl font-black leading-none mr-1 align-[-0.05em]"
                  >
                    “
                  </span>
                  <span className="text-indigo/85 leading-relaxed text-[15px]">
                    {t.quote}
                  </span>
                  <span
                    aria-hidden="true"
                    className="inline-block text-teal text-2xl font-black leading-none ml-1 align-[-0.05em]"
                  >
                    ”
                  </span>
                </blockquote>

                {/* Résultat */}
                <footer className="flex items-start gap-3 pt-6 border-t border-indigo/10">
                  <span className="block w-6 h-px bg-teal mt-3 flex-shrink-0" />
                  <span className="text-indigo font-extrabold text-base leading-snug">
                    {t.result}
                  </span>
                </footer>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
