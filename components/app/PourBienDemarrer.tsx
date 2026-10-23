'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { masquerDemarrage } from '@/lib/app/actionsBienvenue';
import type { EtatNolio } from '@/lib/app/tableauDuPlan';
import { Carte, Surtitre } from './Ui';

// « Pour bien démarrer » (décision coach du 21/10/2026 : « expliquer à l'athlète le cheminement à mettre en place pour
// avoir l'app + Nolio ») : en haut de l'accueil, ce qui fait quoi, puis les étapes et leur état, cochées d'elles-mêmes
// quand le site le sait (l'équipe CTS rejointe, l'accord de lecture donné, le profil de coureur d'un coaché rempli,
// décision coach du 23/10/2026, l'app installée sur cet appareil). Une
// version acheteur, une version coaché. Une fois tout en place, elle se masque sur cet appareil (un cookie), comme
// d'un appui sur « Masquer ».
const APP_STORE = 'https://apps.apple.com/app/nolio/id1615773607';
const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=dupont.nolio';
// L'aide de Nolio, marque par marque (Garmin, Coros, Suunto, Polar, Apple Watch…).
const MONTRE = 'https://help.nolio.io/fr/collections/19748649-connecter-un-appareil-ou-une-application';

type Etape = { fait: boolean; titre: string; texte?: React.ReactNode };

// seanceFaite : une séance faite remontée de Nolio (avec son accord de lecture) ; elle coche l'appli Nolio et la montre
// (décision coach du 23/10/2026).
export default function PourBienDemarrer({ acheteur, nolio, accord, questionnaire, installer, profil = true, lienProfil = '', seanceFaite = false }: {
  acheteur: boolean; nolio: EtatNolio; accord: boolean; questionnaire: boolean; installer: string; profil?: boolean; lienProfil?: string;
  seanceFaite?: boolean;
}) {
  const [installee, setInstallee] = useState(false);
  const [masquee, setMasquee] = useState(false);
  useEffect(() => {
    setInstallee(window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  }, []);
  const dansNolio = acheteur ? nolio === 'actif' : accord;
  const enPlace = dansNolio && installee && (acheteur || profil);
  useEffect(() => {
    if (enPlace) masquerDemarrage().catch(() => {});
  }, [enPlace]);
  if (masquee || enPlace) return null;

  const lienExterne = (href: string, texte: string) => (
    <a href={href} target="_blank" rel="noopener" className="font-bold text-teal whitespace-nowrap">{texte}</a>
  );
  const etapes: Etape[] = acheteur ? [
    { fait: true, titre: 'Ta préparation est prête' },
    nolio === 'actif'
      ? { fait: true, titre: 'Tu es dans l’équipe CTS sur Nolio' }
      : { fait: false, titre: 'Rejoins l’équipe CTS dans Nolio', texte: nolio === 'refuse'
        ? 'Ton invitation n’a pas abouti : réponds simplement à ton e-mail de bienvenue, nous t’en renvoyons une.'
        : 'Nolio t’écrit à l’adresse de ton achat (ou de ton compte Nolio) : accepte l’invitation, ou connecte-toi avec les '
          + 'identifiants reçus. Regarde aussi dans tes indésirables.' },
    seanceFaite
      ? { fait: true, titre: 'L’appli Nolio et ta montre sont reliées' }
      : { fait: false, titre: 'Installe l’appli Nolio et relie ta montre', texte: (
        <>{lienExterne(APP_STORE, 'App Store')} · {lienExterne(GOOGLE_PLAY, 'Google Play')} · {lienExterne(MONTRE, 'Relier ta montre ›')}</>
      ) },
  ] : [
    { fait: true, titre: 'Ton espace CTS est ouvert' },
    profil
      ? { fait: true, titre: 'Ton profil de coureur est rempli' }
      : { fait: false, titre: 'Remplis ton profil de coureur', texte: (
        <>Ton niveau et ta semaine habituelle, une seule fois : tes objectifs partent de lui.{' '}
          <Link href={lienProfil} className="font-bold text-teal whitespace-nowrap">Le remplir ›</Link></>
      ) },
    accord
      ? { fait: true, titre: 'Ton accord de lecture est donné' }
      : { fait: false, titre: 'Donne ton accord à ton coach',
        texte: 'Réponds « oui » à son message dans Nolio : tes séances faites, ton RPE et ton Hooper remontent alors dans l’app.' },
  ];
  etapes.push(installee
    ? { fait: true, titre: 'L’app CTS est sur ton écran d’accueil' }
    : { fait: false, titre: 'Ajoute l’app CTS à ton écran d’accueil', texte: <Link href={installer} className="font-bold text-teal">Comment ›</Link> });

  return (
    <Carte className="space-y-3">
      <Surtitre>Pour bien démarrer</Surtitre>
      <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
        <strong className="text-indigo">Nolio</strong> : tes séances, au jour le jour, jusqu’à ta montre.{' '}
        <strong className="text-indigo">L’app CTS</strong> : ta course, ta préparation, tes données et tes fiches.
      </p>
      <ol>
        {etapes.map((e) => (
          <li key={e.titre} className="grid grid-cols-[22px_1fr] gap-x-2.5 py-2.5 border-t border-indigo/[0.06] first:border-t-0">
            <span aria-hidden className={e.fait
              ? 'mt-0.5 w-[18px] h-[18px] rounded-full bg-teal flex items-center justify-center'
              : 'mt-0.5 w-[18px] h-[18px] rounded-full border-2 border-indigo/25'}>
              {e.fait && (
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17 19 7" /></svg>
              )}
            </span>
            <span className="min-w-0">
              <span className={e.fait ? 'block text-sm text-[#5E5C78]' : 'block text-sm font-bold text-indigo'}>
                {e.titre}<span className="sr-only">{e.fait ? ', fait' : ', à faire'}</span>
              </span>
              {e.texte && <span className="block mt-0.5 text-[0.8125rem] text-[#4A4866] leading-relaxed">{e.texte}</span>}
            </span>
          </li>
        ))}
      </ol>
      {questionnaire && (
        <p className="p-3 rounded-xl bg-sand text-xs text-[#4A4866] leading-relaxed">
          Chaque dimanche à 8 h, le questionnaire « Ta semaine prochaine » t’attend dans Nolio : ta semaine suivante s’écrit
          d’après tes réponses.
        </p>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={() => { setMasquee(true); masquerDemarrage().catch(() => {}); }}
          className="min-h-11 text-[0.8125rem] font-bold text-[#5E5C78]">
          Masquer
        </button>
      </div>
    </Carte>
  );
}
