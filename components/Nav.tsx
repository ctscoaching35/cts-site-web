'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { nav, site } from '@/lib/content';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Empêche le scroll quand le menu mobile est ouvert
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled || open
          ? 'bg-indigo/95 backdrop-blur-md py-4 shadow-lg shadow-indigo/10'
          : 'bg-transparent py-6'
      )}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 flex items-center justify-between">
        <a
          href="#hero"
          className="flex items-center gap-3 group"
          aria-label={site.name}
        >
          <Image
            src="/logo/cts-logo.png"
            alt="CTS Coaching"
            width={48}
            height={48}
            className="w-10 h-10 lg:w-12 lg:h-12 object-contain transition-transform group-hover:scale-105"
            priority
          />
          <span className="text-white font-extrabold tracking-cts text-sm lg:text-base hidden sm:inline">
            CTS COACHING
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-white/90 hover:text-white text-sm font-medium tracking-cts-tight uppercase transition-colors"
            >
              {item.label}
            </a>
          ))}
          <a href="#contact" className="btn btn-primary !py-3 !px-5 text-xs">
            Commencer
          </a>
        </nav>

        {/* Mobile burger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-white p-2 -mr-2"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
        >
          <div className="w-6 h-5 relative flex flex-col justify-between">
            <span
              className={clsx(
                'block h-0.5 bg-white transition-all duration-300',
                open ? 'rotate-45 translate-y-2' : ''
              )}
            />
            <span
              className={clsx(
                'block h-0.5 bg-white transition-all duration-300',
                open ? 'opacity-0' : ''
              )}
            />
            <span
              className={clsx(
                'block h-0.5 bg-white transition-all duration-300',
                open ? '-rotate-45 -translate-y-2' : ''
              )}
            />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={clsx(
          'md:hidden fixed inset-x-0 top-[72px] bottom-0 z-40 transition-all duration-500',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Fond plein indigo + dégradé pour démarcation claire */}
        <div className="absolute inset-0 bg-indigo-dark" />
        <div className="absolute inset-0 bg-gradient-to-b from-indigo to-indigo-dark" />

        <nav className="relative flex flex-col items-stretch h-full px-6 pt-10 pb-12 overflow-y-auto">
          <div className="flex flex-col gap-3">
            {nav.map((item, i) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] border-l-4 border-teal text-white text-lg font-extrabold tracking-cts uppercase py-5 px-5 transition-all"
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <span>{item.label}</span>
                <span aria-hidden="true" className="text-teal-light text-xl leading-none">
                  →
                </span>
              </a>
            ))}
          </div>

          {/* CTA Commencer — pleine largeur, bg teal plein */}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="btn btn-primary w-full mt-6 !py-5 text-sm"
          >
            Commencer mon coaching →
          </a>

          <p className="text-white/50 text-xs tracking-cts uppercase mt-auto pt-10 text-center">
            CTS Coaching · Annecy · Rennes
          </p>
        </nav>
      </div>
    </header>
  );
}
