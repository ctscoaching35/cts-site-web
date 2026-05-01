'use client';

import Image from 'next/image';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { hero } from '@/lib/content';

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', prefersReduced ? '0%' : '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  return (
    <section
      id="hero"
      ref={ref}
      className="relative min-h-[100dvh] w-full overflow-hidden flex items-center"
    >
      {/* Photo de fond avec parallaxe */}
      <motion.div className="absolute inset-0 -z-10" style={{ y }}>
        <Image
          src={hero.background}
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover photo-treatment"
        />
      </motion.div>

      {/* Overlay indigo 65% */}
      <div className="absolute inset-0 bg-indigo/65 -z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-indigo/40 via-transparent to-indigo/80 -z-10" />

      {/* Contenu */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 py-32 lg:py-40 w-full"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 px-4 py-2 border border-white/30 backdrop-blur-sm mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-teal animate-pulse" />
          <span className="text-white text-xs font-semibold tracking-cts uppercase">
            {hero.badge}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-white text-5xl sm:text-6xl lg:text-8xl font-extrabold leading-[0.95] mb-6 max-w-4xl"
        >
          {hero.title}
          <br />
          <span className="text-teal-light">{hero.titleAccent}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-white/85 text-lg lg:text-xl max-w-2xl leading-relaxed mb-10 font-light"
        >
          {hero.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <a href={hero.ctaPrimary.href} className="btn btn-primary">
            {hero.ctaPrimary.label} →
          </a>
          <a href={hero.ctaSecondary.href} className="btn btn-outline">
            {hero.ctaSecondary.label}
          </a>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-white/60"
      >
        <span className="text-[10px] tracking-cts uppercase">Scroll</span>
        <div className="w-px h-12 bg-white/40 relative overflow-hidden">
          <motion.div
            animate={{ y: [-48, 48] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-x-0 top-0 h-12 bg-white"
          />
        </div>
      </motion.div>
    </section>
  );
}
