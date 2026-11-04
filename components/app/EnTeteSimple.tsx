import Image from 'next/image';
import Link from 'next/link';

// L'en-tête de l'app sans contexte (la page « Ta séance d'origine », les pages d'erreur et introuvable) : le logo et la
// marque, qui ramènent à l'accueil. Avant, « Ta séance d'origine » portait l'en-tête « Espace coach » (B-AT-56).
export default function EnTeteSimple() {
  return (
    <header className="bg-white border-b border-indigo/[0.08]">
      <div className="mx-auto max-w-2xl h-16 px-4 flex items-center">
        <Link href="/app" className="flex items-center gap-2.5 min-w-0">
          <Image src="/logo/cts-logo-white.png" alt="CTS Coaching" width={36} height={36} className="w-9 h-9 object-contain" />
          <span className="text-[0.8125rem] font-bold tracking-[0.12em] text-indigo">CTS COACHING</span>
        </Link>
      </div>
    </header>
  );
}
