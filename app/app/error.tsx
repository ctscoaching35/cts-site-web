'use client';

import Link from 'next/link';
import EnTeteSimple from '@/components/app/EnTeteSimple';

// La page d'erreur de l'app (B-AT-65, audit du 03/11/2026) : en français, dans l'app, avec « Réessayer » et le retour à
// l'accueil. Avant, la page par défaut de Next, en anglais, sans rien pour revenir.
export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <EnTeteSimple />
      <main className="mx-auto max-w-2xl px-4 pt-8 pb-6 space-y-4">
        <h1 className="text-[1.5rem] font-extrabold text-indigo tracking-tight">Cette page n’a pas pu s’afficher</h1>
        <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">
          Un service ne répond pas pour l’instant. Réessaie dans un moment ; tes séances, elles, sont toujours dans Nolio.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => reset()} className="min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold">
            Réessayer
          </button>
          <Link href="/app" className="inline-flex items-center min-h-12 px-5 rounded-xl border border-indigo/20 text-indigo text-sm font-bold">
            Retour à l’accueil
          </Link>
        </div>
      </main>
    </>
  );
}
