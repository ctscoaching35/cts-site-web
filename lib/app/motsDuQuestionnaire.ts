/**
 * LES MOTS DU QUESTIONNAIRE DE LA SEMAINE, DITS À L'ATHLÈTE (entrées 198 et 199 du coach, 24/11/2026) : sous la 8.x, c'est « Ta semaine prochaine », le samedi à 8 h ;
 * sous le moteur 9.0, c'est « Ton point du dimanche », le dimanche vers midi (heure de Paris), à répondre d'ici dimanche 18 h, la semaine s'écrivant dimanche soir.
 * Chaque texte existe dans les deux versions ; l'écran prend la bonne par `moteurEstV9()` (lib/app/moteurEnLigne.ts), côté serveur : sous la 8.x rien ne change.
 * Sous le moteur 9.0, trois textes (`pourBienDemarrer`, `sAdapte`, `uneSeuleChose`) existent en deux voix (« Deux voix », 24/11/2026) : `v9` est celle de l'acheteur
 * (neutre, sans « je ») et `v9Coache` celle du coaché (la voix du coach, « je ») ; l'écran qui connaît le coaché passe `coache`. Sous la 8.x, une seule voix.
 * Les textes « avant » sont ceux d'avant, mot pour mot. Les textes « v9 » sont NOUVEAUX : le coach les valide en regardant l'écran avant l'OK de mise en ligne.
 * Fonctions pures, sans réseau ni base.
 */
export type Cle =
  | 'profilSemaineMoi' | 'profilSemaineSon' | 'profilAcheteur' | 'compteCoacheSansAccord' | 'compteAcheteurSansAccord'
  | 'pourBienDemarrer' | 'sAdapte' | 'uneSeuleChose' | 'confidentialite';

const TEXTES: Record<Cle, { avant: string; v9: string; v9Coache?: string }> = {
  // components/app/ProfilAthlete.tsx : la semaine habituelle, vue par l'athlète (« ta ») ou par le coach (« sa »).
  profilSemaineMoi: {
    avant: 'Ta semaine de tous les jours : ta préparation se construit dessus. Chaque samedi, le questionnaire « Ta semaine prochaine » change la semaine qui vient.',
    v9: 'Ta semaine de tous les jours : ta préparation se construit dessus. Chaque dimanche vers midi, « Ton point du dimanche » change la semaine qui vient.',
  },
  profilSemaineSon: {
    avant: 'Sa semaine de tous les jours : sa préparation se construit dessus. Chaque samedi, son questionnaire « Ta semaine prochaine » change la semaine qui vient.',
    v9: 'Sa semaine de tous les jours : sa préparation se construit dessus. Chaque dimanche vers midi, son « Ton point du dimanche » change la semaine qui vient.',
  },
  // app/app/profil/page.tsx : sous la carte de coureur d'un acheteur.
  profilAcheteur: {
    avant: 'Il sert à tes prochains objectifs. Ta semaine, elle, s’ajuste chaque week-end avec ton questionnaire du samedi.',
    v9: 'Il sert à tes prochains objectifs. Ta semaine, elle, s’ajuste chaque dimanche avec ton point du dimanche.',
  },
  // app/app/compte/page.tsx : « Tes données », sans l'accord de lecture.
  compteCoacheSansAccord: {
    avant: 'Sans ton accord, ta préparation suit son plan, ton questionnaire du samedi et tes séances faites ou manquées, et tes séances ne s’affichent pas ici. Pour les voir dans l’app, réponds « oui » au message de ton coach dans Nolio.',
    v9: 'Sans ton accord, ta préparation suit son plan, ton point du dimanche et tes séances faites ou manquées, et tes séances ne s’affichent pas ici. Pour les voir dans l’app, réponds « oui » au message de ton coach dans Nolio.',
  },
  compteAcheteurSansAccord: {
    avant: 'Sans accord de lecture, l’app lit seulement tes séances faites ou manquées et leur durée : ton plan suit sa trame et ton questionnaire du samedi, sans s’ajuster à ta fatigue, et tu donnes toi-même tes repères. L’accord est recommandé.',
    v9: 'Sans accord de lecture, l’app lit seulement tes séances faites ou manquées et leur durée : ton plan suit sa trame et ton point du dimanche, sans s’ajuster à ta fatigue, et tu donnes toi-même tes repères. L’accord est recommandé.',
  },
  // components/app/PourBienDemarrer.tsx : la phrase au bas de « Pour bien démarrer ».
  pourBienDemarrer: {
    avant: 'Chaque samedi à 8 h, le questionnaire « Ta semaine prochaine » t’attend dans Nolio : réponds d’ici dimanche 18 h, ta semaine suivante s’écrit dimanche soir d’après tes réponses.',
    v9: 'Chaque dimanche vers midi, « Ton point du dimanche » t’attend dans Nolio : réponds d’ici dimanche 18 h, ta semaine suivante est préparée dimanche soir d’après tes réponses.',
    v9Coache: 'Chaque dimanche vers midi, « Ton point du dimanche » t’attend dans Nolio : réponds d’ici dimanche 18 h, je prépare ta semaine suivante dimanche soir d’après tes réponses.',
  },
  // components/app/PourBienDemarrer.tsx : pour un acheteur dont la préparation s'adapte.
  sAdapte: {
    avant: 'Ta préparation s’adapte chaque semaine : le samedi, un court questionnaire dans Nolio te demande tes jours et ton nombre de séances ; le dimanche soir, ta semaine s’écrit d’après tes réponses et ce que tu as couru.',
    v9: 'Ta préparation s’adapte chaque semaine : le dimanche vers midi, « Ton point du dimanche », un court questionnaire dans Nolio, te demande tes jours et ton nombre de séances ; le dimanche soir, ta semaine est préparée d’après tes réponses et ce que tu as couru.',
    v9Coache: 'J’adapte ta préparation chaque semaine : le dimanche vers midi, « Ton point du dimanche », un court questionnaire dans Nolio, te demande tes jours et ton nombre de séances ; le dimanche soir, je prépare ta semaine d’après tes réponses et ce que tu as couru.',
  },
  // components/app/AccueilAthlete.tsx : « Une seule chose à faire chaque semaine ».
  uneSeuleChose: {
    avant: 'Le dimanche, ton appli à jour (tes séances remontées dans Nolio) et le questionnaire du samedi rempli. C’est ce qui permet d’adapter ta semaine suivante. Sans ça, elle reste au même niveau, puis se recale dès que tu actualises.',
    v9: 'Le dimanche, ton appli à jour (tes séances remontées dans Nolio) et ton point du dimanche rempli. C’est ce qui permet d’adapter ta semaine suivante. Sans ça, elle reste au même niveau, puis est remise à jour dès que tu actualises.',
    v9Coache: 'Le dimanche, ton appli à jour (tes séances remontées dans Nolio) et ton point du dimanche rempli. C’est ce qui permet d’adapter ta semaine suivante. Sans ça, je garde ta semaine au même niveau, puis je la remets à jour dès que tu actualises.',
  },
  // app/confidentialite/page.tsx : ce que la semaine suivante lit chaque dimanche. Sous la 9.0, l'arrêt et sa durée, sa cause (blessure, maladie, autre) seulement avec l'accord de lecture (décision 209), et les séances clés pas faites s'y ajoutent.
  confidentialite: {
    avant: 'tes réponses au questionnaire du samedi (tes jours, ton jour de sortie longue, ton nombre de séances)',
    v9: 'tes réponses à « Ton point du dimanche » (ton arrêt éventuel et sa durée, et sa cause (blessure, maladie, autre) si tu nous as donné ton accord de lecture, les séances clés que tu n’as pas faites, tes jours, ton nombre de séances, ton jour de sortie longue)',
  },
};

// Le texte pour la version du moteur en ligne : v9 vrai sous une 9.x ; `coache` vrai pour un coaché (sa voix, sous la 9.x seulement).
export const motsDuQuestionnaire = (cle: Cle, v9: boolean, coache = false): string => {
  const t = TEXTES[cle];
  return v9 ? (coache && t.v9Coache) || t.v9 : t.avant;
};
export const TOUS_LES_TEXTES = TEXTES;
