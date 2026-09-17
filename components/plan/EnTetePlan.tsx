import Image from 'next/image';

export default function EnTetePlan() {
  return (
    <header className="bg-indigo text-white">
      <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3" aria-label="CTS Coaching — accueil">
          <Image src="/logo/cts-logo.png" alt="CTS Coaching" width={44} height={44} className="w-10 h-10 object-contain" />
          <span className="font-extrabold tracking-cts text-sm">CTS COACHING</span>
        </a>
        <a href="/" className="text-white/70 hover:text-white text-xs font-semibold tracking-cts uppercase">
          Retour au site
        </a>
      </div>
    </header>
  );
}
