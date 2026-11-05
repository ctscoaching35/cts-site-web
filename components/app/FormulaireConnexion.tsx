'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientNavigateur } from '@/lib/app/supabaseNavigateur';
import { BOUTON, CHAMP } from './Ui';

// Q4 (décision coach du 05/11/2026 au soir, « A ») : le champ et le bouton de l'app.
const champCls = `${CHAMP} !min-h-12 !text-base`;
const etiquette = 'block text-xs font-semibold text-indigo mb-1.5';

// La connexion par code (D6) : l'e-mail du compte, puis le code à 6 chiffres reçu par e-mail.
// Un code plutôt qu'un lien : sur iPhone, un lien ouvert depuis Mail se connecte dans Safari, pas
// dans l'app installée. Aucun compte ne se crée ici : il naît au paiement. Le message est le même
// qu'un compte existe ou non, pour ne pas dire à un inconnu qui a un plan CTS.
export default function FormulaireConnexion({ suite = '/app' }: { suite?: string }) {
  const router = useRouter();
  const [etape, setEtape] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [renvoye, setRenvoye] = useState(false);

  // B-PL-55 (audit du 03/11/2026) : une limite d'envoi atteinte se dit, sans dire si le compte existe (un compte
  // inconnu ne lève rien de visible ici : shouldCreateUser à faux).
  async function envoyerCode(): Promise<boolean> {
    const { error } = await clientNavigateur().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    if (error && (error.status === 429 || /rate|limit|seconds/i.test(error.message))) {
      setMessage('Trop de codes demandés d’un coup : attends une minute, puis redemande-le.');
      return false;
    }
    return true;
  }

  async function demanderCode(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage('');
    const ok = await envoyerCode();
    setEnCours(false);
    if (ok) setEtape('code');
  }

  async function renvoyerCode() {
    setEnCours(true);
    setMessage('');
    if (await envoyerCode()) setRenvoye(true);
    setEnCours(false);
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
    router.replace(suite);
    router.refresh();
  }

  return etape === 'email' ? (
    <form suppressHydrationWarning onSubmit={demanderCode} className="space-y-4">
      <label className="block">
        <span className={etiquette}>Ton e-mail</span>
        <input
          // Le remplissage automatique des navigateurs marque ses champs (Chrome sur iPhone :
          // __gcruniqueid) avant que React démarre : ce n'est pas une erreur.
          suppressHydrationWarning
          type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} className={champCls}
        />
      </label>
      {message && <p className="text-sm text-[#9A3B2C]">{message}</p>}
      <button type="submit" disabled={enCours} className={`${BOUTON} w-full`}>
        Recevoir mon code
      </button>
    </form>
  ) : (
    <form suppressHydrationWarning onSubmit={verifierCode} className="space-y-4">
      <p className="text-sm text-[#4A4866] leading-relaxed">
        Si un compte CTS est rattaché à <strong className="text-indigo">{email}</strong>, tu vas recevoir un code à
        6 chiffres.
      </p>
      <label className="block">
        <span className={etiquette}>Le code reçu</span>
        <input
          suppressHydrationWarning
          inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className={`${champCls} text-center text-2xl tracking-[0.5em] font-bold`}
        />
      </label>
      {message && <p className="text-sm text-[#9A3B2C]">{message}</p>}
      <button type="submit" disabled={enCours} className={`${BOUTON} w-full`}>
        Me connecter
      </button>
      {/* §8, point 10 (audit du 03/11/2026) : pas de code reçu. */}
      <button type="button" onClick={renvoyerCode} disabled={enCours || renvoye}
        className="w-full min-h-11 text-sm text-teal font-semibold disabled:opacity-60">
        {renvoye ? 'Code renvoyé : regarde aussi dans tes indésirables' : 'Renvoyer le code'}
      </button>
      <button type="button" onClick={() => { setEtape('email'); setCode(''); setMessage(''); setRenvoye(false); }}
        className="w-full min-h-11 text-sm text-teal font-semibold">
        Changer d’e-mail
      </button>
      {/* C44 (audits du 05/11/2026) : une phrase qui ne change plus de personne. La phrase de la synthèse. */}
      <p className="text-xs text-[#5E5C78] leading-relaxed">
        Pas de code ? Pense à tes indésirables. Utilise l’adresse de ton achat, ou celle que ton coach a utilisée pour
        t’inviter.
      </p>
    </form>
  );
}
