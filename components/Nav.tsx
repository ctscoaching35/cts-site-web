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
          'md:hidden fixed inset-x-0 top-[72px] bottom-0 bg-indigo transition-all duration-500',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <nav className="flex flex-col items-center justify-center gap-8 h-full px-6">
          {nav.map((item, i) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="text-white text-2xl font-extrabold tracking-cts uppercase"
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              {item.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="btn btn-primary mt-4"
          >
            Commencer
          </a>
        </nav>
      </div>
    </header>
  );
}
