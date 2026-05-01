import Image from 'next/image';
import Reveal from './Reveal';
import { about } from '@/lib/content';

type Coach = typeof about.juliette;

function CoachCard({ coach, delay }: { coach: Coach; delay: number }) {
  return (
    <Reveal delay={delay}>
      <article className="group">
        <div className="relative aspect-[4/5] overflow-hidden bg-indigo/5 mb-6">
          <Image
            src={coach.photo}
            alt={coach.name}
            fill
            sizes="(min-width: 1024px) 40vw, 90vw"
            className="object-cover photo-treatment transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-indigo/30 to-transparent" />
        </div>
        <span className="eyebrow text-teal block mb-2">{coach.role}</span>
        <h3 className="text-indigo text-3xl lg:text-4xl font-extrabold mb-5 tracking-tight">
          {coach.name}
        </h3>
        <ul className="space-y-3">
          {coach.points.map((p) => (
            <li key={p} className="flex gap-3 text-indigo/80 leading-relaxed">
              <span className="text-teal font-bold mt-1">·</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </article>
    </Reveal>
  );
}

export default function About() {
  return (
    <section id="about" className="relative bg-white py-24 lg:py-36 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="max-w-3xl mb-16 lg:mb-24">
          <Reveal>
            <span className="eyebrow text-teal block mb-4">{about.eyebrow}</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-indigo text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-6">
              {about.title}
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-indigo/70 text-lg lg:text-xl leading-relaxed">
              {about.subtitle}
            </p>
          </Reveal>
        </div>

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 mb-20 lg:mb-28">
          <CoachCard coach={about.juliette} delay={0.1} />
          <CoachCard coach={about.romain} delay={0.2} />
        </div>

        {/* Credential UTMB */}
        <Reveal delay={0.1}>
          <div className="relative bg-indigo text-white p-10 lg:p-16 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-teal/20 blur-3xl" />
            <div className="relative grid md:grid-cols-[1fr,2fr] gap-8 items-center">
              <div>
                <span className="eyebrow text-teal-light block mb-4">
                  Crédentiel
                </span>
                <h3 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                  {about.credential.title}
                </h3>
              </div>
              <p className="text-white/80 text-base lg:text-lg leading-relaxed">
                {about.credential.body}
              </p>
            </div>
          </div>
        </Reveal>

        {/* Stats */}
        <Reveal delay={0.2}>
          <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-16 lg:mt-20">
            {about.stats.map((stat) => (
              <div
                key={stat.label}
                className="text-center border-t-2 border-teal pt-5 sm:pt-6 min-w-0"
              >
                <div className="text-indigo text-3xl sm:text-5xl lg:text-7xl font-black leading-none mb-2 truncate">
                  {stat.value}
                </div>
                <div className="text-indigo/60 text-[10px] sm:text-xs lg:text-sm font-semibold tracking-cts uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
