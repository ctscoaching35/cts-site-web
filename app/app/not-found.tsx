import Link from 'next/link';
import EnTeteSimple from '@/components/app/EnTeteSimple';

// La page introuvable de l'app (§8, point 1, audit du 03/11/2026) : en français, dans l'app.
export default function Introuvable() {
  return (
    <>
      <EnTeteSimple />
      <main className="mx-auto max-w-2xl px-4 pt-8 pb-6 space-y-4">
        <h1 className="text-[1.5rem] font-extrabold text-indigo tracking-tight">Cette page n’existe pas</h1>
        <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">Le lien est peut-être ancien. Ton accueil, lui, est toujours là.</p>
        <Link href="/app" className="inline-flex items-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold">
          Retour à l’accueil
        </Link>
      </main>
    </>
  );
}
