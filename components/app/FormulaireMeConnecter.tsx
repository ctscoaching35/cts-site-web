'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { demanderCodeGratuit, garderApresConnexion } from '@/lib/app/actionsGratuit';
import { effacerBrouillon, lireBrouillon } from '@/lib/app/brouillonGratuit';
import { aDesFc, calculer, type Saisie } from '@/lib/app/profilGratuit';
import { clientNavigateur } from '@/lib/app/supabaseNavigateur';
import { CONSENTEMENT_FC } from './ProfilGratuit';
import { BOUTON, BOUTON_SECONDAIRE, CHAMP, Carte, Surtitre, TITRE } from './Ui';

// « Me connecter » de l'app gratuite (maquette « Garder » validée le 16/11/2026, textes mot pour mot) : l'e-mail, puis le
// code à 6 chiffres ; la création du compte n'est permise que dans ce parcours. Ce que le visiteur avait sous les yeux
// (son brouillon, en mémoire de l'onglet) entre dans son compte dans la même session, puis est effacé du navigateur.
const etiquette = 'block text-xs font-semibold text-indigo mb-1.5';
const coche = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export default function FormulaireMeConnecter() {
  const router = useRouter();
  const [etape, setEtape] = useState<'email' | 'code' | 'fait'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [liste, setListe] = useState(false);
  const [consentFc, setConsentFc] = useState(false);
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [renvoye, setRenvoye] = useState(false);
  const [brouillon, setBrouillon] = useState<Saisie | null>(null);

  useEffect(() => {
    const b = lireBrouillon();
    if (b && calculer(b, '').ok) setBrouillon(b);
  }, []);
  const avecFc = Boolean(brouillon && aDesFc(brouillon));

  async function envoyerCode(): Promise<boolean> {
    const r = await demanderCodeGratuit(email);
    if (!r.ok) setMessage(r.message);
    return r.ok;
  }

  async function demander(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage('');
    const ok = await envoyerCode();
    setEnCours(false);
    if (ok) setEtape('code');
  }

  async function renvoyer() {
    setEnCours(true);
    setMessage('');
    if (await envoyerCode()) setRenvoye(true);
    setEnCours(false);
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage('');
    const { error } = await clientNavigateur().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error) {
      setEnCours(false);
      setMessage('Ce code ne fonctionne pas : vérifie-le, ou demande-en un nouveau.');
      return;
    }
    // Connecté : ce qu'il avait sous les yeux entre dans son compte, puis le navigateur l'oublie.
    const r = await garderApresConnexion({ saisie: brouillon, liste, consentementFc: consentFc });
    effacerBrouillon();
    setEnCours(false);
    if (!r.gratuit) {
      // Un compte qui n'est pas gratuit (un acheteur, un coaché) : son app de toujours.
      router.replace('/app');
      router.refresh();
      return;
    }
    if (!r.ok) setMessage(r.message);
    setEtape('fait');
  }

  if (etape === 'fait') {
    return (
      <div className="space-y-5">
        <div className="space-y-2.5">
          <span className="w-12 h-12 rounded-full bg-[#E1EFEA] text-teal flex items-center justify-center" aria-hidden>
            <svg viewBox="0 0 24 24" className="w-6 h-6"><path d="M5 12.5 10 17 19 7" {...coche} /></svg>
          </span>
          <h1 className={TITRE}>C’est gardé.</h1>
          <p className="text-sm text-[#5E5C78] leading-relaxed">Ton profil et tes courses te suivent, sur ton téléphone comme sur ton ordinateur. Le même e-mail te reconnecte, à chaque fois.</p>
          {message && <p role="alert" className="text-sm text-[#9A3B2C]">{message}</p>}
        </div>
        <div className="flex flex-col gap-2.5">
          {/* Un chargement complet : l'app relit la session toute fraîche. */}
          <a href="/app/profil" className={BOUTON}>Retour à mon profil</a>
          <a href="/app/courses" className={BOUTON_SECONDAIRE}>Mes courses</a>
        </div>
        <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">Si tu achètes un plan plus tard, c’est ce compte qui le reçoit : rien à recréer.</p>
      </div>
    );
  }

  if (etape === 'code') {
    return (
      <form onSubmit={valider} className="space-y-5">
        <div className="space-y-2.5">
          <Surtitre>Étape 2 sur 2</Surtitre>
          <h1 className={TITRE}>Le code reçu</h1>
          <p className="text-sm text-[#5E5C78] leading-relaxed">Un code à 6 chiffres vient de partir à l’adresse que tu as donnée. Il vaut quelques minutes.</p>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className={etiquette}>Code à 6 chiffres</span>
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="000000"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={`${CHAMP} !min-h-12 !text-base text-center text-2xl tracking-[0.5em] font-bold`} />
          </label>
          {message && <p role="alert" className="text-sm text-[#9A3B2C]">{message}</p>}
          <button type="submit" disabled={enCours} className={`${BOUTON} w-full`}>Valider mon code</button>
          <button type="button" onClick={renvoyer} disabled={enCours || renvoye} className="w-full min-h-11 text-sm text-teal font-semibold disabled:opacity-60">
            {renvoye ? 'Code renvoyé : regarde aussi dans tes indésirables' : 'Renvoyer le code'}
          </button>
          <button type="button" onClick={() => { setEtape('email'); setCode(''); setMessage(''); setRenvoye(false); }}
            className="w-full min-h-11 text-sm text-teal font-semibold">Changer d’e-mail</button>
          <p className="text-xs text-[#5E5C78] leading-relaxed">Pas de code ? Pense à tes indésirables.</p>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={demander} className="space-y-5">
      <div className="space-y-2.5">
        <Surtitre>Me connecter</Surtitre>
        <h1 className={TITRE}>Ton compte, sans mot de passe</h1>
        <p className="text-sm text-[#5E5C78] leading-relaxed">Ton e-mail suffit : un code à 6 chiffres, et tu retrouves ton profil et tes courses sur ton téléphone comme sur ton ordinateur.</p>
      </div>
      <div className="space-y-3">
        <label className="block">
          <span className={etiquette}>Ton e-mail</span>
          <input type="email" required autoComplete="email" placeholder="toi@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)}
            className={`${CHAMP} !min-h-12 !text-base`} />
        </label>
        {message && <p role="alert" className="text-sm text-[#9A3B2C]">{message}</p>}
        <button type="submit" disabled={enCours} className={`${BOUTON} w-full`}>Recevoir mon code</button>
        <p className="text-xs text-[#5E5C78] leading-relaxed">Ton e-mail sert au code, et à rien d’autre. Tu peux tout effacer quand tu veux.</p>
      </div>
      <Carte className="space-y-2">
        <label className="flex gap-2.5 items-start text-sm text-[#4A4866] cursor-pointer">
          <input type="checkbox" className="mt-1 w-4 h-4 accent-teal" checked={liste} onChange={(e) => setListe(e.target.checked)} />
          <span><strong className="text-indigo">Je veux aussi les e-mails de City to Summit</strong> : la méthode, les nouvelles fiches, les ouvertures de places.</span>
        </label>
        <p className="text-xs text-[#5E5C78] leading-relaxed">À part, et facultatif : le code marche sans. Tu te désinscris en un clic.</p>
      </Carte>
      {avecFc && (
        <Carte className="space-y-2">
          <label className="flex gap-2.5 items-start text-sm text-[#4A4866] cursor-pointer">
            <input type="checkbox" className="mt-1 w-4 h-4 accent-teal" checked={consentFc} onChange={(e) => setConsentFc(e.target.checked)} />
            <span>{CONSENTEMENT_FC}</span>
          </label>
          <p className="text-xs text-[#5E5C78] leading-relaxed">Sans cet accord, ta FC n’est pas gardée : le reste l’est.</p>
        </Carte>
      )}
      <Carte className="space-y-2">
        <Surtitre>Ce qui est gardé</Surtitre>
        {['Tes tests et tes zones', 'Tes courses et leur fiche', 'Ta stratégie de nutrition'].map((t) => (
          <span key={t} className="flex items-center gap-2 text-sm text-indigo">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-teal shrink-0" aria-hidden><path d="M5 12.5 10 17 19 7" {...coche} /></svg>{t}
          </span>
        ))}
      </Carte>
    </form>
  );
}
