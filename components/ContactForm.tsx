'use client';

import { useState } from 'react';
import { contact, site } from '@/lib/content';

export default function ContactForm() {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name')?.toString() ?? '';
    const email = fd.get('email')?.toString() ?? '';
    const city = fd.get('city')?.toString() ?? '';
    const objective = fd.get('objective')?.toString() ?? '';
    const message = fd.get('message')?.toString() ?? '';

    const subject = `[CTS Coaching] Demande de ${name}`;
    const body = [
      `Prénom : ${name}`,
      `Email : ${email}`,
      `Ville : ${city}`,
      `Objectif : ${objective}`,
      ``,
      `Message :`,
      message,
    ].join('\n');

    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    setTimeout(() => setSubmitting(false), 1500);
  }

  const inputCls =
    'w-full bg-transparent border-b-2 border-white/20 focus:border-teal-light text-white placeholder:text-white/40 py-3 outline-none transition-colors';
  const labelCls =
    'block text-xs font-semibold tracking-cts uppercase text-white/60 mb-2';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
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

      <div className="pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary w-full sm:w-auto disabled:opacity-60"
        >
          {submitting ? 'Envoi en cours…' : `${contact.form.submit} →`}
        </button>
      </div>
    </form>
  );
}
