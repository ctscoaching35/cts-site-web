import Reveal from './Reveal';
import ContactForm from './ContactForm';
import { contact, site } from '@/lib/content';

export default function Contact() {
  return (
    <section
      id="contact"
      className="relative bg-indigo text-white py-24 lg:py-36 overflow-hidden"
    >
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-teal/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-teal/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid lg:grid-cols-[1fr,1.2fr] gap-16 lg:gap-24">
          {/* Colonne gauche : intro + infos */}
          <div>
            <Reveal>
              <span className="eyebrow text-teal-light block mb-4">
                {contact.eyebrow}
              </span>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-8">
                {contact.title}
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-white/70 text-lg leading-relaxed mb-12">
                {contact.subtitle}
              </p>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="space-y-6 border-t border-white/10 pt-10">
                <div>
                  <div className="eyebrow text-white/50 mb-2">Email</div>
                  <a
                    href={`mailto:${site.email}`}
                    className="text-white text-lg lg:text-xl font-bold hover:text-teal-light transition-colors break-all"
                  >
                    {site.email}
                  </a>
                </div>
                <div>
                  <div className="eyebrow text-white/50 mb-2">Site</div>
                  <a
                    href={site.url}
                    className="text-white text-lg lg:text-xl font-bold hover:text-teal-light transition-colors"
                  >
                    {site.url.replace('https://', '')}
                  </a>
                </div>
                <div>
                  <div className="eyebrow text-white/50 mb-2">Instagram</div>
                  <a
                    href={site.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white text-lg lg:text-xl font-bold hover:text-teal-light transition-colors"
                  >
                    @{site.instagram}
                  </a>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Colonne droite : formulaire */}
          <Reveal delay={0.2}>
            <div className="bg-indigo-dark/40 border border-white/10 p-8 lg:p-12 backdrop-blur-sm">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
