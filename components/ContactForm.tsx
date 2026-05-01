'use client';

import { useState } from 'react';
import { contact, site } from '@/lib/content';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const form = e.currentTarget;
    const fd = new FormData(form);

    // Honeypot — un bot remplira ce champ caché, on jette
    if (fd.get('_gotcha')) {
      setStatus('success');
      return;
    }

    try {
      const res = await fetch(site.formspreeEndpoint, {
        method: 'POST',
        body: fd,
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        setStatus('success');
        form.reset();
      } else {
        const data = await res.json().catch(() => null);
        const msg =
          data?.errors?.[0]?.message ||
          'Le formulaire n’a pas pu être envoyé. Réessaie ou écris-nous directement à ' +
            site.email +
            '.';
        setErrorMsg(msg);
        setStatus('error');
      }
    } catch {
      setErrorMsg(
        'Connexion impossible. Vérifie ton réseau, ou écris-nous directement à ' +
          site.email +
          '.'
      );
      setStatus('error');
    }
  }

  // Écran de succès
  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal/20 border-2 border-teal mb-6">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M5 14L11 20L23 8"
              stroke="#138F7C"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-white text-2xl font-extrabold mb-3">Message envoyé.</h3>
        <p className="text-white/70 leading-relaxed">
          Merci pour ta confiance. Juliette ou Romain te répond personnellement
          sous 48h, à l’adresse indiquée.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-8 text-teal-light hover:text-white text-xs font-semibold tracking-cts uppercase underline underline-offset-4"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  const inputCls =
    'w-full bg-transparent border-b-2 border-white/20 focus:border-teal-light text-white placeholder:text-white/40 py-3 outline-none transition-colors';
  const labelCls =
    'block text-xs font-semibold tracking-cts uppercase text-white/60 mb-2';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Honeypot — caché, les bots le rempliront */}
      <input
        type="text"
        name="_gotcha"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {/* Sujet pré-rempli pour Formspree */}
      <input type="hidden" name="_subject" value="Nouvelle demande — CTS Coaching" />

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <label htmlFor="name" className={labelCls}>
            {contact.form.nameLabel}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="given-name"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>
            {contact.form.emailLabel}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="city" className={labelCls}>
          {contact.form.cityLabel}
        </label>
        <input
          id="city"
          name="city"
          type="text"
          required
          autoComplete="address-level2"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="objective" className={labelCls}>
          {contact.form.objectiveLabel}
        </label>
        <input
          id="objective"
          name="objective"
          type="text"
          placeholder={contact.form.objectivePlaceholder}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="message" className={labelCls}>
          {contact.form.messageLabel}
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className={inputCls + ' resize-none'}
        />
      </div>

      {status === 'error' && (
        <div
          role="alert"
          className="border-l-4 border-red-400 bg-red-400/10 px-4 py-3 text-sm text-red-100"
        >
          {errorMsg}
        </div>
      )}

      <div className="pt-4">
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="btn btn-primary w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Envoi en cours…' : `${contact.form.submit} →`}
        </button>
      </div>
    </form>
  );
}
