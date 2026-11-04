# Une rétractation, pas à pas (pour le coach)

*Audit de l'app plan du 03/11/2026, C11. Les conditions de vente (article sur la rétractation) disent ce que l'acheteur
peut demander ; voici ce que tu fais quand il le demande.*

**Ce qu'il peut demander.** Pendant 14 jours à compter de son paiement, l'acheteur peut se rétracter, sans motif : il
répond à son e-mail de bienvenue, ou il renvoie le formulaire des conditions de vente. Il a demandé que sa préparation
commence dès son paiement : il est remboursé du prix, moins la part des jours de préparation déjà écoulés
(article L221-25 du Code de la consommation). Au-delà de 14 jours, rien n'est dû.

## 1. Calculer le remboursement

La règle des conditions de vente (article 8) : il doit la part du prix des jours de préparation déjà écoulés le jour
de sa demande, rapportés à la durée de sa préparation jusqu'à sa course ; avant la date de début donnée dans son plan,
rien.

- Le prix payé : dans Stripe (le paiement), ou dans ton espace coach, Chiffres de la vente (code promo déduit).
- La date de début : celle de son plan (« Ta préparation commence le… », dans son e-mail de bienvenue et dans l'app) ;
  pour un plan rejoint en route, le jour de son paiement.
- Les jours écoulés : de la date de début au jour de sa demande (0 si sa demande arrive avant).
- La durée : de la date de début au jour de sa course.
- Remboursement = prix × (1 − jours écoulés / durée), arrondi au centime inférieur, sous 14 jours.

Exemple : 49 € payés, préparation commencée le 2 mars, course le 28 juin (118 jours), demande le 9 mars (7 jours) :
49 × (1 − 7/118) = 46,09 €.

## 2. Rembourser dans Stripe

Stripe › Paiements › le paiement de l'acheteur › « Rembourser » › montant partiel : le montant calculé. Stripe envoie
lui-même le reçu du remboursement.

## 3. L'arrêter dans Nolio

Dans Nolio, retire-le de ton équipe. Le site le voit passer (l'événement « a quitté l'équipe ») et n'écrit plus rien
pour lui. Ce qui est déjà posé reste dans son calendrier Nolio, à lui.

Sans ce geste, sa préparation continue de s'écrire chaque dimanche jusqu'à la fin de sa récupération.

## 4. Lui répondre

Un court message, en réponse à son e-mail : la rétractation est prise en compte, le montant remboursé et le délai de
sa banque (quelques jours), et que son compte de l'app reste ouvert ; il peut le supprimer lui-même dans Compte ›
« Supprimer mon compte ».

## Ce qui reste

- Son compte de l'app reste, sans préparation qui s'écrit : à lui de le supprimer s'il le veut.
- Son achat reste dans les Chiffres de la vente, au montant payé : le remboursement ne s'y lit pas, il se lit dans Stripe.
