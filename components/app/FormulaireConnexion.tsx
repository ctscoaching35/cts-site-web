'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientNavigateur } from '@/lib/app/supabaseNavigateur';

const champCls =
  'w-full bg-white border border-indigo/20 focus:border-teal px-4 py-3 text-indigo outline-none transition-colors';

// La connexion par code (D6) : l'e-mail du compte, puis le code à 6 chiffres reçu par e-mail.
// Un code plutôt qu'un lien : sur iPhone, un lien ouvert depuis Mail se connecte dans Safari, pas
// dans l'app installée. Aucun compte ne se crée ici : il naît au paiement. Le message est le même
// qu'un compte existe ou non, pour ne pas dire à un inconnu qui a un plan CTS.
export default function FormulaireConnexion() {
  const router = useRouter();
  const [etape, setEtape] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function demanderCode(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage('');
    await clientNavigateur().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    setEnCours(false);
    setEtape('code');
  }

  async function verifierCode(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage('');
    const { error } = await clientNavigateur().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setEnCours(false);
    if (error) {
      setMessage('Ce code ne fonctionne pas : vérifie-le, ou demande-en un nouveau.');
      return;
    }
    router.replace('/app');
    router.refresh();
  }

  return etape === 'email' ? (
    <form suppressHydrationWarning onSubmit={demanderCode} className="space-y-4">
      <label className="block">
        <span className="block text-xs font-semibold tracking-cts uppercase text-indigo/70 mb-2">Ton e-mail</span>
        <input
          // Le remplissage automatique des navigateurs marque ses champs (Chrome sur iPhone :
          // __gcruniqueid) avant que React démarre : ce n'est pas une erreur.
          suppressHydrationWarning
          type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} className={champCls}
        />
      </label>
      <button type="submit" disabled={enCours} className="btn btn-primary w-full disabled:opacity-60">
        Recevoir mon code
      </button>
    </form>
  ) : (
    <form suppressHydrationWarning onSubmit={verifierCode} className="space-y-4">
      <p className="text-sm text-indigo/70 leading-relaxed">
        Si un plan CTS est rattaché à <strong className="text-indigo">{email}</strong>, tu vas recevoir un code à
        6 chiffres.
      </p>
      <label className="block">
        <span className="block text-xs font-semibold tracking-cts uppercase text-indigo/70 mb-2">Le code reçu</span>
        <input
          suppressHydrationWarning
          inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className={`${champCls} text-center text-2xl tracking-[0.5em] font-bold`}
        />
      </label>
      {message && <p className="text-sm text-[#9A3B2C]">{message}</p>}
      <button type="submit" disabled={enCours} className="btn btn-primary w-full disabled:opacity-60">
        Me connecter
      </button>
      <button type="button" onClick={() => { setEtape('email'); setCode(''); setMessage(''); }}
        className="w-full text-sm text-teal font-semibold">
        Changer d’e-mail
      </button>
    </form>
  );
}
