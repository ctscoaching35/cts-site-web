import Image from 'next/image';
import { footer, nav, site } from '@/lib/content';

export default function Footer() {
  return (
    <footer className="bg-indigo-dark text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-16 lg:py-20">
        <div className="grid md:grid-cols-[1.5fr,1fr,1fr] gap-12 mb-12">
          {/* Logo + tagline */}
          <div>
            <a href="#hero" className="inline-flex items-center gap-3 mb-6">
              <Image
                src="/logo/cts-logo.png"
                alt="CTS Coaching"
                width={56}
                height={56}
                className="w-14 h-14 object-contain"
              />
              <span className="text-white font-extrabold tracking-cts text-base">
                CTS COACHING
              </span>
            </a>
            <p className="text-white/60 leading-relaxed text-sm max-w-sm">
              On accompagne des personnes, pas des kilomètres. Coaching trail
              scientifique par des kinésithérapeutes du sport, depuis Rennes.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <div className="eyebrow text-white/50 mb-5">Navigation</div>
            <ul className="space-y-3">
              {nav.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-white/80 hover:text-teal-light transition-colors text-sm"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <div className="eyebrow text-white/50 mb-5">Contact</div>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="text-white/80 hover:text-teal-light transition-colors break-all"
                >
                  {site.email}
                </a>
              </li>
              <li>
                <a
                  href={site.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-teal-light transition-colors"
                >
                  @{site.instagram}
                </a>
              </li>
              <li className="text-white/60">{site.city}, France</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-white/50 text-xs tracking-wider uppercase">
            {footer.tagline}
          </p>
          <p className="text-white/40 text-xs">{footer.legal}</p>
        </div>
      </div>
    </footer>
  );
}
