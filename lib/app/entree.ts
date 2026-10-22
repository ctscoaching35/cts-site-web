/**
 * L'entrée d'un athlète coaché (décision coach du 22/10/2026, « la carte Son entrée » ; CTS_NOLIO_CADRAGE.md dans le
 * dépôt du moteur) : ce qu'il faut, dans l'ordre, pour que ses semaines s'écrivent seules — relié à Nolio, son accord
 * de lecture, son objectif (le questionnaire de « Nouvel objectif » remplit son profil quand il n'est pas connu), ses
 * dimanches dans Nolio (posés par le passage de 18 h 30), son départ. Chaque étape se coche d'elle-même, d'après la
 * base. Programmé à la main : ni objectif ni départ à faire. Le calcul seul, sans lecture.
 */
import { dateLongue } from './plan';

export type EtapeEntree = { cle: string; titre: string; fait: boolean; detail?: string; action?: { texte: string; href: string } };
export type Entree = { etapes: EtapeEntree[]; faites: number; total: number; complete: boolean };

// objectif : son prochain objectif, à venir ; ecrit, écrit semaine par semaine (un objectif envoyé en entier n'a rien
// à démarrer) ; prevu, son départ programmé. courseA : sa course A dans Nolio, pas encore dans CTS
// (lib/app/coursesNolio.ts) ; son objectif se crée alors déjà rempli.
export function entreeDe(x: {
  athleteId: string; nolio: boolean; accord: boolean; programmation: 'auto' | 'main';
  objectif: { plan_id: string; ecrit: boolean; demarre: boolean; prevu: string | null } | null;
  dimanchesJusqua: string | null; aujourdhui: string; courseA?: { id: string; nom: string } | null;
}): Entree {
  const { nolio, accord, objectif: o } = x;
  const main = x.programmation === 'main';
  const dimanches = Boolean(x.dimanchesJusqua && x.dimanchesJusqua >= x.aujourdhui);
  const parti = Boolean(o && (!o.ecrit || o.demarre || o.prevu));
  const etapes: EtapeEntree[] = [
    { cle: 'nolio', titre: 'Relié à Nolio', fait: nolio, action: nolio ? undefined : { texte: 'Associer ›', href: '#son-nolio' } },
    { cle: 'accord', titre: 'Son accord de lecture', fait: accord,
      detail: accord ? undefined : 'Envoie-lui le message d’accord dans Nolio : ses séances faites, son RPE et son Hooper remontent alors.',
      action: accord ? undefined : { texte: 'Le message ›', href: '/app/coach/suivi#sans-accord' } },
    main
      ? { cle: 'objectif', titre: 'Programmé à la main', fait: true, detail: 'Tu écris ses séances dans Nolio : rien à écrire ici.' }
      : { cle: 'objectif', titre: 'Son objectif', fait: Boolean(o),
        detail: o ? undefined : x.courseA ? `${x.courseA.nom} est dans Nolio : son objectif se crée déjà rempli.`
          : 'Son profil se remplit avec son premier objectif.',
        action: o ? undefined : x.courseA
          ? { texte: 'Créer l’objectif ›', href: `/app/coach/nouveau?athlete=${x.athleteId}&course=${x.courseA.id}` }
          : { texte: '+ Nouvel objectif', href: `/app/coach/nouveau?athlete=${x.athleteId}` } },
    { cle: 'dimanches', titre: 'Ses dimanches dans Nolio', fait: dimanches,
      detail: dimanches ? `Questionnaire et Hooper, posés jusqu’au ${dateLongue(x.dimanchesJusqua as string, true)}.`
        : nolio ? 'Questionnaire et Hooper : ils partent au passage de 18 h 30, rien à faire.'
          : 'Questionnaire et Hooper : ils partiront une fois Nolio relié.' },
    main
      ? { cle: 'depart', titre: 'Rien à démarrer', fait: true }
      : { cle: 'depart', titre: 'Démarré dans Nolio', fait: parti,
        detail: o?.prevu && !o.demarre ? `Démarre le ${dateLongue(o.prevu, true)}.` : undefined,
        action: !parti && o && nolio ? { texte: 'Démarrer ›', href: `/app/coach/plan/${o.plan_id}` } : undefined },
  ];
  const faites = etapes.filter((e) => e.fait).length;
  return { etapes, faites, total: etapes.length, complete: faites === etapes.length };
}
