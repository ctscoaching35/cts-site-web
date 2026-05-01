import Image from 'next/image';
import Reveal from './Reveal';
import { instagram, site } from '@/lib/content';

export default function Instagram() {
  return (
    <section id="instagram" className="relative bg-white py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid md:grid-cols-2 gap-10 mb-12 lg:mb-16 items-end">
          <div>
            <Reveal>
              <span className="eyebrow text-teal block mb-4">
                {instagram.eyebrow}
              </span>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-indigo text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05]">
                {instagram.title}
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <p className="text-indigo/70 text-lg leading-relaxed md:max-w-md">
              {instagram.subtitle}
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-4 mb-12">
          {instagram.posts.map((src, i) => (
            <Reveal key={src} delay={0.05 * i}>
              <a
                href={site.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square block overflow-hidden bg-indigo/5"
              >
                <Image
                  src={src}
                  alt={`Post Instagram CTS Coaching ${i + 1}`}
                  fill
                  sizes="(min-width: 1024px) 30vw, 50vw"
                  className="object-cover photo-treatment transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-indigo/0 group-hover:bg-indigo/60 transition-colors duration-300 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
              </a>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <a
            href={site.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-dark"
          >
            {instagram.cta} →
          </a>
        </Reveal>
      </div>
    </section>
  );
}
