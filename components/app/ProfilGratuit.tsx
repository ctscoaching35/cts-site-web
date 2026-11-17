'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { enregistrerProfilGratuit } from '@/lib/app/actionsGratuit';
import { brouillonVide, garderBrouillon, lireBrouillon } from '@/lib/app/brouillonGratuit';
import {
  CONSEILS_GRATUITS, SAISIE_VIDE, aDesFc, aDesTests, calculer, saisieDepuis,
  type Calcul, type Saisie, type TestsGratuits,
} from '@/lib/app/profilGratuit';
import { allure, profilCoureur } from '@/lib/app/zones';
import { AllerPlusLoin } from './AllerPlusLoin';
import { BOUTON, BOUTON_SECONDAIRE, CHAMP, Carte, CarteSombre, Surtitre, TITRE } from './Ui';

// Le profil de l'app gratuite (maquette « Profil » validée le 16/11/2026, textes mot pour mot) : les
// trois tests, les repères et le style de coureur qui en sortent (les calculs de l'app des acheteurs, lib/app/zones.ts).
// « Tes zones » et « Des séances types » viennent du moteur (lot B) : une ligne à leur place.
// Un visiteur voit son résultat sans rien enregistrer (le calcul tourne ici, dans son navigateur ; son brouillon ne
// dépasse pas l'onglet) ; un compte gratuit l'enregistre dans son compte.
const etiquette = 'block text-xs font-semibold text-indigo mb-1.5';
const COCHE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const CONSENTEMENT_FC = 'J’accepte que City to Summit garde ces valeurs dans mon compte, seulement pour calculer mes zones et mes repères. Je peux les effacer à tout moment.';

export default function ProfilGratuit({ compte, gardee, consentementDonne, ouvrirTest }: {
  compte: boolean; gardee: { tests: TestsGratuits } | null; consentementDonne: boolean; ouvrirTest: boolean;
}) {
  const router = useRouter();
  const depart: Saisie = gardee ? saisieDepuis(gardee.tests) : SAISIE_VIDE;
  const calculDepart = gardee ? calculer(depart, '') : null;
  const [saisie, setSaisie] = useState<Saisie>(depart);
  const [calcul, setCalcul] = useState<Calcul | null>(calculDepart?.ok ? calculDepart : null);
  const [etape, setEtape] = useState<'resultat' | 'test'>(ouvrirTest || !calculDepart?.ok ? 'test' : 'resultat');
  const [consent, setConsent] = useState(false);
  const [erreur, setErreur] = useState('');
  const [statut, setStatut] = useState('');
  const [enCours, setEnCours] = useState(false);

  // Un visiteur qui revient sur son profil dans la même session retrouve ce qu'il avait sous les yeux.
  useEffect(() => {
    if (compte) return;
    const b = lireBrouillon();
    if (brouillonVide(b) || !b) return;
    const c = calculer(b, '');
    setSaisie(b);
    if (c.ok) {
      setCalcul(c);
      if (!ouvrirTest) setEtape('resultat');
    }
  }, [compte, ouvrirTest]);

  const champ = (cle: keyof Saisie) => (e: React.ChangeEvent<HTMLInputElement>) => setSaisie((s) => ({ ...s, [cle]: e.target.value }));
  const ouvrir = () => { setErreur(''); setStatut(''); setEtape('test'); };

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setStatut('');
    const c = calculer(saisie, new Date().toISOString().slice(0, 10));
    if (!c.ok) { setErreur(c.message); return; }
    if (compte) {
      setEnCours(true);
      const r = await enregistrerProfilGratuit({ saisie, consentementFc: consent });
      setEnCours(false);
      if (!r.ok) { setErreur(r.message); return; }
      setStatut(r.message);
      router.refresh();
    } else garderBrouillon(saisie);
    setCalcul(c);
    setEtape('resultat');
  }
  // Une nouvelle vue du profil s'ouvre en haut.
  useEffect(() => { window.scrollTo(0, 0); }, [etape]);

  if (etape === 'test') {
    return (
      <form onSubmit={valider} className="space-y-4">
        {calcul && (
          <button type="button" onClick={() => { setErreur(''); setEtape('resultat'); }} className="inline-flex items-center min-h-11 px-2 text-sm font-bold text-teal">
            ‹ Retour à mon profil
          </button>
        )}
        <div className="space-y-2">
          <h1 className={TITRE}>Tes tests de terrain</h1>
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">Remplis ce que tu as : ton profil se complète test après test.</p>
        </div>

        <Carte className="space-y-3">
          <Numero n="01" titre="La vitesse critique" />
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Sur le plat, le même jour : <strong className="text-indigo">3 minutes à fond</strong>, 30 minutes de récupération, puis <strong className="text-indigo">12 minutes à fond</strong>. Note la distance de chaque effort. D’autres durées marchent : chaque effort de 2 à 15 minutes, au moins 5 minutes d’écart entre les deux.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Champ id="e1t" titre="Effort 1 · min" valeur={saisie.e1t} onChange={champ('e1t')} placeholder="3" />
            <Champ id="e1d" titre="Distance · m" valeur={saisie.e1d} onChange={champ('e1d')} placeholder="1020" />
            <Champ id="e2t" titre="Effort 2 · min" valeur={saisie.e2t} onChange={champ('e2t')} placeholder="12" />
            <Champ id="e2d" titre="Distance · m" valeur={saisie.e2d} onChange={champ('e2d')} placeholder="3480" />
          </div>
          <p className="text-[0.72rem] text-[#5E5C78] leading-relaxed">Ton style de coureur se lit dans ce test, ramené à un test de référence.</p>
        </Carte>

        <Carte className="space-y-3">
          <Numero n="02" titre="Le test de la parole" />
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Des paliers de 3 minutes sur le plat, de plus en plus rapides. Les 30 dernières secondes de chaque palier, compte à voix haute de 1 à 30. Au premier palier où ta respiration te coupe, note ta FC et ton allure : c’est ton seuil 1.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Champ id="fc1" titre="FC au palier · bpm" valeur={saisie.fc1} onChange={champ('fc1')} placeholder="152" />
            <Champ id="al1" titre="Allure · min/km" valeur={saisie.al1} onChange={champ('al1')} placeholder="4:30" inputMode="text" />
          </div>
        </Carte>

        <Carte className="space-y-3">
          <Numero n="03" titre="Ta FC au seuil 2" />
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Une fois ta vitesse critique connue, sur le plat : 15 min d’échauffement, puis 2 blocs de 10 minutes à 95 % de ta vitesse critique. Note ta FC en fin de second bloc.
          </p>
          <Champ id="fc2" titre="FC en fin de bloc · bpm" valeur={saisie.fc2} onChange={champ('fc2')} placeholder="facultatif" />
        </Carte>

        {compte && !consentementDonne && aDesFc(saisie) && (
          <label className="flex gap-2.5 items-start text-sm text-[#4A4866] cursor-pointer">
            <input type="checkbox" className="mt-1 w-4 h-4 accent-teal" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{CONSENTEMENT_FC}</span>
          </label>
        )}
        {erreur && <p role="alert" className="text-sm text-[#9A3B2C]">{erreur}</p>}
        <button type="submit" disabled={enCours} className={`${BOUTON} w-full`}>Calculer mes zones</button>
        <p className="text-xs text-[#5E5C78] leading-relaxed">Ces repères informent, ils ne remplacent pas un avis médical personnalisé.</p>
      </form>
    );
  }

  const c = calcul && calcul.ok ? calcul : null;
  const profil = c?.profil;
  const coureur = profil ? profilCoureur(profil) : null;
  const conseils = coureur && coureur.coefficient < 0.9 ? CONSEILS_GRATUITS.rapide : CONSEILS_GRATUITS.endurant;
  const reperes: [string, string | null, string, string][] = [
    ['Seuil 1', profil?.fc_seuil1 != null ? String(profil.fc_seuil1) : null, 'bpm · test de la parole', 'Le test de la parole'],
    ['Vitesse critique', profil?.vc_ms != null ? allure(profil.vc_ms) : null, 'min/km · ton seuil 2 en allure', 'La vitesse critique'],
    ['Seuil 2', profil?.fc_seuil2 != null ? String(profil.fc_seuil2) : null, 'bpm · mesurée en séance', 'en séance, sur le plat'],
  ];
  const tests = c?.tests ?? {};
  return (
    <div className="space-y-4">
      <h1 className={TITRE}>Ton profil de coureur</h1>
      {statut && <p role="status" className="text-sm text-teal font-semibold">{statut}</p>}
      <p className="text-[0.8125rem] text-[#5E5C78] leading-relaxed">Tes repères, tirés de tes tests. Ils règlent tes zones, et la façon de gérer ta course.</p>

      <section className="grid grid-cols-3 gap-2" aria-label="Tes repères">
        {reperes.map(([titre, valeur, unite, test]) => {
          const cadre = 'bg-white rounded-[14px] border border-indigo/[0.08] p-3 flex flex-col gap-1 min-h-11 text-left';
          const contenu = (
            <>
              <span className="min-h-[2.5em] text-[0.625rem] font-bold tracking-[0.1em] uppercase text-teal leading-[1.25]">{titre}</span>
              <span className={clsx('font-extrabold', valeur ? 'text-[1.375rem] text-indigo' : 'text-base text-[#8A5E10] py-1')}>{valeur ?? 'à mesurer'}</span>
              <span className="text-[0.6875rem] text-[#5E5C78] leading-snug">{valeur ? unite : `${test} ›`}</span>
            </>
          );
          return valeur ? <div key={titre} className={cadre}>{contenu}</div>
            : <button key={titre} type="button" onClick={ouvrir} className={cadre}>{contenu}</button>;
        })}
      </section>

      {coureur ? (
        <>
          <CarteSombre className="space-y-3">
            <Surtitre ton="clair">Ton style de coureur</Surtitre>
            <p className="text-2xl font-extrabold">{coureur.nom}</p>
            <div className="relative h-2.5 rounded-full bg-gradient-to-r from-[#8FD1C3] to-[#2BB39B]" aria-hidden>
              <span className="absolute top-[-3px] w-0.5 h-4 bg-white/70" style={{ left: '50%' }} />
              <span className="absolute top-[-5px] w-5 h-5 -ml-2.5 rounded-full bg-white border-[3px] border-indigo"
                style={{ left: `${Math.max(0, Math.min(100, ((coureur.coefficient - 0.8) / 0.2) * 100))}%` }} />
            </div>
            <div className="flex justify-between text-[0.6875rem] text-[#D6D5E6]"><span>plutôt rapide</span><span>plutôt endurant</span></div>
            <p className="text-[0.8125rem] leading-relaxed text-[#E8E7F2]">{coureur.texte}</p>
          </CarteSombre>
          <Carte className="space-y-3.5">
            <Conseil titre="Loin de ta course · ton point faible" texte={conseils.loin} ton="faible" />
            <div className="h-px bg-indigo/[0.08]" />
            <Conseil titre="Près de ta course · ton point fort" texte={conseils.pres} ton="fort" />
            <p className="text-[0.72rem] text-[#5E5C78] leading-relaxed">{CONSEILS_GRATUITS.note}</p>
          </Carte>
        </>
      ) : (
        <Carte className="space-y-1.5">
          <Surtitre>Ton style de coureur</Surtitre>
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">Il se tire de ton test de vitesse critique : plutôt rapide ou plutôt endurant.</p>
        </Carte>
      )}

      {/* « Tes zones » et « Des séances types » : le moteur les écrit, au lot B. */}
      <Carte className="space-y-1.5">
        <Surtitre>Tes zones</Surtitre>
        <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">Tes zones arrivent bientôt ici.</p>
      </Carte>

      <Carte className="space-y-2.5">
        <Surtitre>Tes tests</Surtitre>
        <ul>
          <LigneTest titre="Le test de la parole" valeur={tests.parole ? `${tests.parole.fc_seuil1} bpm · fait` : 'à faire'} />
          <LigneTest titre="La vitesse critique" valeur={profil?.vc_ms != null ? `${allure(profil.vc_ms)}/km · fait` : 'à faire'} />
          <LigneTest titre="Ta FC au seuil 2" valeur={tests.fc2 ? `${tests.fc2.fc_seuil2} bpm · fait` : 'à mesurer'} />
        </ul>
        <button type="button" onClick={ouvrir} className={`${BOUTON_SECONDAIRE} w-full`}>Refaire ou entrer un test</button>
        {!compte && aDesTests(tests) && (
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Sans compte, tu vois tes résultats. Pour les garder sur ton téléphone et ton ordinateur, ton e-mail suffit, sans mot de passe.{' '}
            <Link href="/app/me-connecter" className="font-bold text-teal whitespace-nowrap">Créer mon compte ›</Link>
          </p>
        )}
      </Carte>

      <AllerPlusLoin titre="Un plan qui part de ce profil, et de ce que tu cours chaque semaine." texte="" lienTexte="Voir le plan et le coaching" />
    </div>
  );
}

function Numero({ n, titre }: { n: string; titre: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[0.6875rem] font-bold tracking-[0.14em] text-teal">{n}</span>
      <h2 className="text-base font-extrabold text-indigo">{titre}</h2>
    </div>
  );
}

function Champ({ id, titre, valeur, onChange, placeholder, inputMode = 'numeric' }: {
  id: string; titre: string; valeur: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className={etiquette}>{titre}</span>
      <input id={id} name={id} value={valeur} onChange={onChange} placeholder={placeholder} inputMode={inputMode} autoComplete="off" className={CHAMP} />
    </label>
  );
}

function LigneTest({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <li className="flex items-center justify-between min-h-11 border-t border-indigo/[0.06] text-[0.8125rem]">
      <span className="font-bold text-indigo">{titre}</span><span className="text-[#5E5C78]">{valeur}</span>
    </li>
  );
}

function Conseil({ titre, texte, ton }: { titre: string; texte: string; ton: 'faible' | 'fort' }) {
  return (
    <div className="flex gap-3">
      <span className={clsx('w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center',
        ton === 'faible' ? 'bg-[#FFF1E0] text-[#9A4A06]' : 'bg-[#E1EFEA] text-teal-dark')}>
        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>{ton === 'faible' ? <path d="M13 3 5 14h6l-1 7 8-11h-6z" {...COCHE} /> : <path d="M3 20 9 9l4 6 3-4 5 9z" {...COCHE} />}</svg>
      </span>
      <div>
        <p className="text-[0.8125rem] font-bold text-indigo">{titre}</p>
        <p className="mt-1 text-[0.8125rem] text-[#4A4866] leading-relaxed">{texte}</p>
      </div>
    </div>
  );
}
