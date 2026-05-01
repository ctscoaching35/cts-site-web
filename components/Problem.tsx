import Reveal from './Reveal';
import { problem } from '@/lib/content';

export default function Problem() {
  return (
    <section id="problem" className="relative bg-sand py-24 lg:py-36 overflow-hidden">
      {/* Décoration discrète : trait vertical décalé */}
      <div className="absolute left-6 lg:left-10 top-24 bottom-24 w-px bg-indigo/10 hidden lg:block" />

      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Titre asymétrique : pas de centrage, alignement à gauche, casse à 70% de largeur */}
        <div className="grid lg:grid-cols-12 gap-8 mb-20">
          <div className="lg:col-span-1 flex items-start pt-3">
            <Reveal>
              <span className="block w-12 h-px bg-teal" />
            </Reveal>
          </div>
          <div className="lg:col-span-8">
            <Reveal>
              <span className="eyebrow text-teal block mb-4">{problem.eyebrow}</span>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-indigo text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05]">
                {problem.title}
              </h2>
            </Reveal>
          </div>
        </div>

        {/* Items en zig-zag — décalage vertical alterné, pas de cards lourdes */}
        <div className="grid md:grid-cols-3 gap-x-6 lg:gap-x-12 gap-y-12 mb-20">
          {problem.items.map((item, i) => {
            const offsetClass = i === 0 ? '' : i === 1 ? 'md:translate-y-12' : 'md:translate-y-6';
            return (
              <Reveal key={item.title} delay={0.15 + i * 0.1}>
                <div className={`relative ${offsetClass}`}>
                  {/* Numéro en filigrane, pas dans une box */}
                  <div className="text-teal/20 font-black text-7xl leading-none mb-4 tracking-tighter">
                    0{i + 1}
                  </div>
                  {/* Trait + contenu, séparation par border, pas par card */}
                  <div className="border-t-2 border-indigo pt-6">
                    <h3 className="text-indigo text-xl font-extrabold mb-4 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-indigo/70 leading-relaxed text-[15px]">
                      {item.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Résolution — full width, gros impact */}
        <Reveal delay={0.4}>
          <div className="grid lg:grid-cols-12 gap-8 border-t border-indigo/15 pt-12">
            <div className="lg:col-span-1 flex items-start pt-3">
              <span className="block w-12 h-0.5 bg-teal" />
            </div>
            <div className="lg:col-span-10">
              <p className="text-indigo text-2xl lg:text-4xl font-extrabold leading-tight">
                {problem.resolution}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
