/**
 * UN LIEN VERS UN RÉGLAGE OUVRE « RÉGLAGES », SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026, suite : la page de l'athlète range ses réglages dans un `details` « Réglages », replié ;
 * app/app/coach/athlete/[id]/page.tsx). Un navigateur n'ouvre pas un `details` replié pour une ancre qui est dedans (et Next, qui fait défiler jusqu'à l'ancre après un clic sur un `Link`, non plus) :
 * `#sa-semaine-passee`, `#courses-nolio`, `#son-nolio`, `#retirer`, `#son-entree`… menaient sur une page qui ne bougeait pas. Le composant components/app/OuvrirLeReglage.tsx, rendu par la page
 * sous la 9.x seulement, suit l'adresse (`#…`) et ouvre le ou les `details` qui contiennent l'élément visé, puis fait défiler jusqu'à lui. Sous la 8.x, la page n'en rend rien.
 *
 * Le calcul seul, sans navigateur : la fenêtre et le document sont donnés (de faux, aux essais : scripts/test-espace-coach-simple-6.mjs). Rien ne se lit ni ne s'écrit ailleurs que dans la page.
 */

// Ce qu'on lit d'un élément de la page : son nom de balise, son état ouvert (un `details`), son parent, et de quoi y faire défiler.
export type Noeud = { tagName?: string; open?: boolean; parentElement?: Noeud | null; scrollIntoView?: (options?: ScrollIntoViewOptions) => void };

// L'identifiant que dit une adresse : « #son-nolio », ou « %23… » décodé ; rien (« ») quand il n'y a pas d'ancre.
export function idDeLAncre(hash: string): string {
  const brut = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(brut);
  } catch {
    return brut;
  }
}

// Ouvre le `details` qui est l'élément lui-même ou qui le contient, et ses parents `details` ; rend combien il en a ouvert (0 : rien n'était fermé, ou l'élément n'est dans aucun).
export function ouvrirLesDetailsDe(element: Noeud | null | undefined): number {
  let ouverts = 0;
  for (let n = element ?? null; n; n = n.parentElement ?? null) {
    if (String(n.tagName ?? '').toUpperCase() === 'DETAILS' && !n.open) {
      n.open = true;
      ouverts += 1;
    }
  }
  return ouverts;
}

type Fenetre = Pick<Window, 'addEventListener' | 'removeEventListener'> & { location: Pick<Location, 'hash' | 'href' | 'pathname' | 'origin'> };
type Page = Pick<Document, 'getElementById' | 'addEventListener' | 'removeEventListener'>;

// Ouvre ce que l'ancre vise. faireDefiler : après l'ouverture, ramener l'élément à l'écran (au chargement et quand l'adresse change : le navigateur a déjà défilé, dans le vide, avant l'ouverture) ;
// au clic, il suffit d'ouvrir d'avance : la navigation défile ensuite d'elle-même.
export function ouvrirLaCible(page: Page, id: string, faireDefiler: boolean): boolean {
  const cible = id ? page.getElementById(id) as Noeud | null : null;
  const ouverts = ouvrirLesDetailsDe(cible);
  if (ouverts > 0 && faireDefiler) cible?.scrollIntoView?.({ block: 'start' });
  return ouverts > 0;
}

// Suit l'adresse de la page : au chargement, à chaque changement d'ancre (`hashchange`, retour en arrière : `popstate`), et à chaque clic sur un lien qui reste sur la même page avec une ancre
// (un `Link` de Next change l'adresse par `pushState`, qui ne dit rien : `hashchange` ne part pas). Rend de quoi arrêter de suivre.
export function suivreLAncre(fenetre: Fenetre, page: Page): () => void {
  const suivre = () => { ouvrirLaCible(page, idDeLAncre(fenetre.location.hash), true); };
  const clic = (e: Event) => {
    const lien = (e.target as Element | null)?.closest?.('a[href]') as { href: string } | null | undefined;
    if (!lien) return;
    let url: URL;
    try {
      url = new URL(lien.href, fenetre.location.href);
    } catch {
      return;
    }
    if (url.origin === fenetre.location.origin && url.pathname === fenetre.location.pathname) ouvrirLaCible(page, idDeLAncre(url.hash), false);
  };
  suivre();
  fenetre.addEventListener('hashchange', suivre);
  fenetre.addEventListener('popstate', suivre);
  page.addEventListener('click', clic, true);
  return () => {
    fenetre.removeEventListener('hashchange', suivre);
    fenetre.removeEventListener('popstate', suivre);
    page.removeEventListener('click', clic, true);
  };
}
