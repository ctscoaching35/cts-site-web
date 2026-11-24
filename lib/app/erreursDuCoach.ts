/**
 * APRÈS UN CLIC, LE COACH LIT UNE PHRASE, PAS UN MESSAGE TECHNIQUE, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026, suite : « l'espace coach doit être très simple sous la 9.x » ;
 * reports/Application coach — revue de simplicité, 24-11.md, § 3 et proposition 5, la suite de ce que `montrerLInfra` fait pour ce que les PAGES disent : le message d'infrastructure n'est plus affiché, il reste au journal du serveur). Un geste du
 * coach (« Réessayer », « Démarrer dans Nolio », « Enregistrer » son profil ou son test…) peut revenir avec « Nolio refuse la clé de l'API : vérifie NOLIO_API_KEY dans Vercel. », « la migration du
 * 19/10/2026 est-elle passée ? » ou « Le code du coach (CTS_CLE_COACH) manque dans Vercel. » : sous la 9.x, il lit à la place une phrase simple, en mots du coach, et le détail reste au journal
 * du serveur (`console.error`). Sous la 8.x, le message est celui d'avant, mot pour mot.
 *
 * COMMENT : `messageDuCoach(message, v9)` est une fonction pure (`v9` vient de moteurEstV9, lib/app/moteurEnLigne.ts) : un message reconnu comme technique est remplacé et journalisé ; tout autre
 * message (« Choisis un lundi. », « Pas encore son accord… », une phrase de Nolio faite pour le coach) reste tel quel, sous les deux moteurs. `messageAuCoach(message)` la fait suivre de
 * `moteurEstV9().catch(() => false)` : c'est lui qu'appellent les gestes du coach, à l'endroit où l'écran reçoit le message.
 *
 * CE QUI N'Y PASSE PAS (le même texte, sans `v9` à portée, part ailleurs : un courriel au développeur, un passage planifié, un journal) : `refusNolio` (lib/app/nolio.ts), `ErreurNolio`, les
 * `throw new Error(...)` de lib/app/ecriture.ts, stockageV9.ts, passagesV9.ts, les comptes rendus des passages (`erreur` des `Compte`), `prevenirCoach`. Ils restent ce qu'ils sont ; seul ce que
 * l'ÉCRAN du coach reçoit après un geste est dit autrement.
 *
 * Le calcul seul, sans réseau : il s'essaie avec des messages fabriqués (scripts/test-espace-coach-simple-6.mjs). Les phrases ci-dessous sont NOUVELLES et ne sont lues que par le coach.
 */
import { moteurEstV9 } from './moteurEnLigne';

// ─── Les phrases (pour le coach seul) ─────────────────────────────────────────────────────────────────────────────

export const TEXTES_ERREURS = {
  // Nolio : la clé de l'API refusée ou mal collée, un refus qui n'est pas un geste du coach (la phrase de « Nolio ne répond pas » de la page, avec « quelques minutes »).
  nolio: 'Nolio ne répond pas pour l’instant : réessaie dans quelques minutes.',
  // Le moteur : une route qui répond une erreur.
  moteur: 'Le moteur ne répond pas pour l’instant : réessaie dans quelques minutes.',
  // Le reste de l'infrastructure : une variable manquante, une migration, Supabase, Vercel.
  autre: 'Cette action n’a pas abouti pour l’instant : réessaie dans quelques minutes.',
} as const;

// ─── Ce qui est reconnu comme technique : une liste fermée, dans l'ordre (le premier motif qui va gagne) ──────────────────

// Chaque motif vient d'un message que le code écrit aujourd'hui (grep : NOLIO_API_KEY, CTS_CLE_COACH, migration, Supabase, Vercel) :
//   - « Nolio refuse la clé de l’API : vérifie NOLIO_API_KEY dans Vercel. » (lib/app/nolio.ts, refusNolio, 401) ;
//   - « La variable NOLIO_API_KEY de Vercel ne contient pas une clé Nolio (elle commence par nolio_sk_) : recolle la clé, puis redéploie. » (nolio.ts, cle()) ;
//   - « Nolio a refusé la lecture (500 server_error). » (nolio.ts, refusNolio : le code d'état et le code d'erreur de Nolio) ;
//   - « Moteur /v1/semaine : 502 » (lib/app/ecriture.ts, moteur ; coaching.ts : « Moteur /v1/nolio/seances : … ») ;
//   - « Le code du coach (CTS_CLE_COACH) manque dans Vercel. » (app/app/coach/athletes/route.ts, app/plan/simuler/route.ts) ;
//   - « L’enregistrement n’a pas abouti : la migration du 19/10/2026 est-elle passée ? » (lib/app/actionsCoaching.ts : le profil, le test de vitesse critique), et « … (la migration du
//     24/11/2026 (état du moteur v1) est-elle passée ?) » (stockageV9.ts, qui remonte par « Réessayer »).
// « variable » seul n'est pas un motif (« allure variable » est un mot du coach) : seule « variable d'environnement » ou un nom de variable en majuscules l'est.
export const MESSAGES_TECHNIQUES: readonly (readonly [motif: RegExp, phrase: string])[] = [
  [/NOLIO_API_KEY|clé de l[’']API|clé Nolio|^Nolio a refusé /, TEXTES_ERREURS.nolio],
  [/^Moteur \S+ : /, TEXTES_ERREURS.moteur],
  [/\bCTS_[A-Z_]+|\bVercel\b|\bSupabase\b|migration|est-elle passée|variables? d[’']environnement/i, TEXTES_ERREURS.autre],
];

// Le message tel que le coach le lit : sous la 8.x, le même ; sous la 9.x, une phrase simple quand il est technique (et le détail au journal), le même sinon. `journal` : pour les essais.
export function messageDuCoach(message: string, v9: boolean, journal: (m: string) => void = (m) => console.error(m)): string {
  if (!v9) return message;
  const reconnu = MESSAGES_TECHNIQUES.find(([motif]) => motif.test(message));
  if (!reconnu) return message;
  journal(`Message technique caché au coach : ${message}`);
  return reconnu[1];
}

// Une liste de soucis (« Zones Nolio : … », « Dans Nolio, à finir à la main : … ») : chacun dit comme ci-dessus, et une phrase qui reviendrait deux fois n'est dite qu'une fois.
export function soucisDuCoach(soucis: string[], v9: boolean, journal?: (m: string) => void): string[] {
  const dits = soucis.map((s) => messageDuCoach(s, v9, journal));
  return v9 ? [...new Set(dits)] : dits;
}

// Les deux, avec la version du moteur lue ici (moteurEstV9 est gardée 5 minutes par processus, et sans réponse, c'est une 8.x : le message reste celui d'avant).
// « PAS ENCORE SON ACCORD » (décision 220 du coach, 24/11/2026, suite) : le coach enregistre des repères ou un test avant que l'athlète ait donné son accord de lecture. Sous la 8.x, la phrase d'avant
// (elle envoie vers « le Suivi », écran supprimé) ; sous la 9.x, ce que le coach fait, sans parler d'écran : le bouton « Accord reçu » est dans ce qui est à faire pour l'athlète.
export const PAS_ENCORE_SON_ACCORD = 'Pas encore son accord : associe-le à Nolio, envoie-lui le message d’accord, puis coche « Accord reçu » dans le Suivi quand il a répondu oui.';
export const PAS_ENCORE_SON_ACCORD_V9 = 'Pas encore son accord de lecture : associe-le à Nolio, envoie-lui le message d’accord, puis clique sur « Accord reçu » quand il a répondu oui.';
export const pasEncoreSonAccord = (v9: boolean): string => (v9 ? PAS_ENCORE_SON_ACCORD_V9 : PAS_ENCORE_SON_ACCORD);
export const pasEncoreSonAccordAuCoach = async (): Promise<string> => pasEncoreSonAccord(await moteurEstV9().catch(() => false));

export async function messageAuCoach(message: string): Promise<string> {
  return messageDuCoach(message, await moteurEstV9().catch(() => false));
}

export async function soucisAuCoach(soucis: string[]): Promise<string[]> {
  return soucis.length ? soucisDuCoach(soucis, await moteurEstV9().catch(() => false)) : soucis;
}
