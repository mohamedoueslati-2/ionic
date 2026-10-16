# MovieMatch

**Your movies. Your people.**

MovieMatch aide les cinéphiles à **découvrir des films, conserver leurs favoris et identifier les personnes qui partagent leurs goûts**. Les films et leurs notes proviennent de TMDB. Les comptes, profils et favoris sont enregistrés dans Firebase.

L’application propose une interface adaptée au téléphone, à la tablette et à l’ordinateur, avec des thèmes sombre, clair et système.

## Sommaire

- [Premiers pas](#premiers-pas)
- [Les écrans de l’application](#les-écrans-de-lapplication)
- [Les rôles et les statuts](#les-rôles-et-les-statuts)
- [Comprendre le matching](#comprendre-le-matching)
- [Profil, sécurité et apparence](#profil-sécurité-et-apparence)
- [Questions fréquentes](#questions-fréquentes)
- [Installation et configuration](#installation-et-configuration)
- [Structure technique et déploiement](#structure-technique-et-déploiement)

## Premiers pas

1. **Créer un compte** depuis **Sign Up**, avec prénom, nom, âge, email et mot de passe, ou choisir Google.
2. **Compléter son profil** si l’écran **Almost there!** apparaît. Cette étape est obligatoire, notamment après une première inscription Google. Les noms sont requis et l’âge doit être un entier entre 1 et 120.
3. **Explorer les films** dans **Home**, par recherche, collection ou genre.
4. **Toucher le cœur** d’un film pour l’ajouter à ses favoris. Le cœur rempli indique qu’il est enregistré.
5. **Ouvrir Matching** après avoir ajouté au moins trois films distincts. Les personnes compatibles apparaissent si elles remplissent également les conditions du matching.

L’inscription par email crée directement un compte utilisateur actif avec les informations saisies. Les connexions suivantes s’effectuent depuis **Sign In** ou Google.

## Les écrans de l’application

| Écran | À quoi sert-il ? |
| --- | --- |
| **Home** | Découvrir les films, rechercher un titre, choisir un genre et ajouter des favoris. |
| **Favorites / My Watchlist** | Retrouver sa collection personnelle, voir le nombre de films enregistrés et retirer des favoris. |
| **Matching / Movie Matches** | Consulter les profils ayant des goûts proches, leur score et le nombre de films partagés. |
| **Profile** | Modifier ses informations, gérer sa photo, son mot de passe, le thème et la déconnexion. |
| **Dashboard** | Espace réservé aux administrateurs pour consulter et gérer les comptes utilisateurs. |

### Découvrir des films

Dans **Home**, saisissez un titre puis utilisez **Search** ou la touche Entrée. Les collections **Popular**, **New Releases**, **Coming Soon**, **Top Rated**, **Trending Today** et **Trending Week** permettent de changer de sélection. Le menu **Genre** propose les catégories fournies par TMDB.

Chaque carte présente l’affiche, le titre, l’année, la note TMDB et le bouton de favoris. Si l’affiche ou la date manque, un texte de remplacement apparaît. Faites défiler la page pour charger la suite lorsque la collection dispose de plusieurs pages.

Le choix d’une collection efface la recherche et le genre précédents. Une recherche efface le genre ; choisir un genre efface la recherche. **Clear search and filters** revient aux films populaires. Les sélections de genre utilisent un classement par popularité.

### Gérer ses favoris

Les cœurs de **Home** et la page **Favorites** partagent la même collection, synchronisée en temps réel avec Firestore. Retirer un film depuis l’un de ces écrans actualise également l’autre. La watchlist présente les favoris du plus récemment ajouté au plus ancien.

Une collection vide propose **Discover Movies**. Lorsqu’une opération est en cours, le cœur concerné est temporairement désactivé. En cas d’échec, un message explique le problème ; les boutons **Retry Favorites** permettent de relancer le chargement.

## Les rôles et les statuts

Le **rôle** détermine les fonctionnalités disponibles. Le **statut** indique si le compte est autorisé à les utiliser.

| Rôle | Onglets disponibles | Permissions |
| --- | --- | --- |
| **USER** | Home, Favorites, Matching, Profile | Découvrir les films, gérer ses propres favoris, consulter ses correspondances et modifier son profil. |
| **ADMIN** | Dashboard, Profile | Consulter les statistiques des comptes `USER`, rechercher par nom/email, ouvrir les détails et activer ou désactiver ces comptes. |

Toute inscription crée un **USER**. Le rôle **ADMIN** doit être attribué par un administrateur de confiance dans Firestore ; il ne se choisit pas lors de l’inscription et ne se modifie pas depuis le profil. Les administrateurs ne participent pas au matching.

| Statut | Conséquence |
| --- | --- |
| **ACTIVE** | Le compte peut accéder aux fonctionnalités de son rôle après complétion du profil. |
| **DISABLED** | L’application affiche **Account disabled** et la déconnexion, sans les onglets protégés. |

Le tableau de bord affiche les nombres de comptes `USER` au total, actifs et désactivés. Une activation/désactivation demande confirmation. Désactiver un compte bloque son accès et retire son profil de matching ; cette action ne supprime pas ses favoris. L’administrateur peut ensuite le réactiver.

## Comprendre le matching

Le matching compare **les films présents dans les favoris de deux personnes**. Il s’applique automatiquement aux comptes `USER` actifs avec profil complet, sans bouton d’adhésion ou d’activation.

Pour qu’une correspondance apparaisse :

1. Les deux personnes doivent avoir **au moins 3 favoris distincts**.
2. Leur similarité doit atteindre **75 % ou plus**.
3. Il doit s’agir de deux comptes différents.

Le score prend en compte les films en commun et tous les films distincts réunis des deux collections. Un même film présent chez les deux personnes compte une seule fois dans ce total.

```text
Similarité = nombre de films en commun / nombre total de films distincts × 100
```

| Favoris d’Alice | Favoris de Sami | Films en commun | Total distinct | Score | Affiché ? |
| --- | --- | --- | --- | --- | --- |
| A, B, C | A, B, C | 3 | 3 | 100 % | Oui |
| A, B, C | A, B, C, D | 3 | 4 | 75 % | Oui |
| A, B, C, D | A, B, C, E | 3 | 5 | 60 % | Non |

Les lettres représentent des films fictifs pour illustrer le calcul. **Trois films en commun ne suffisent donc pas toujours** : la taille des deux collections compte également.

Les résultats sont classés par similarité décroissante. Chaque carte affiche le prénom et le nom, une photo ou des initiales, un pourcentage arrondi, une barre de similarité et le nombre de films en commun. Les emails ne sont pas affichés sur ces cartes.

Les correspondances évoluent avec les favoris et les profils synchronisés. **Refresh matches** relance leur chargement. Si vous avez moins de trois favoris, l’écran indique combien de films ajouter. Si aucun profil ne dépasse le seuil, un message vous invite à compléter votre collection ou à réessayer plus tard.

Pour les grandes collections, le calcul utilise au maximum **500 films distincts par personne**, sélectionnés par identifiant croissant. La note TMDB, l’âge et la photo n’interviennent pas dans le score.

## Profil, sécurité et apparence

### Informations et photo

Depuis **Profile**, **Edit profile** permet de modifier le prénom, le nom et l’âge. **Save changes** enregistre ; **Cancel** abandonne les modifications. L’email de connexion et le rôle sont en lecture seule.

**Take Photo** ouvre la caméra et **Gallery** permet de choisir une image. La photo est envoyée automatiquement à Cloudinary, puis son adresse est enregistrée dans Firestore. Les fichiers acceptés sont **JPG, PNG et WEBP**, jusqu’à **5 Mo**. Sans photo, les initiales sont affichées.

### Mots de passe et déconnexion

- **Mot de passe oublié** : depuis **Forgot password?**, indiquez votre email puis choisissez **Send reset link**. Consultez votre boîte de réception et vos courriers indésirables. Le message de confirmation reste identique si l’adresse n’a pas de compte.
- **Compte avec mot de passe** : **Change password** demande le mot de passe actuel, le nouveau et sa confirmation.
- **Compte Google uniquement** : **Set MovieMatch password** ajoute une connexion email/mot de passe au même compte après confirmation de l’identité avec Google.
- **Validation** : les mots de passe doivent comporter au moins six caractères. Firebase Authentication gère les identifiants ; les mots de passe ne sont pas enregistrés dans les documents Firestore.
- **Logout** ferme la session ; les favoris restent associés au compte.

### Thèmes

Le bouton soleil/lune de l’en-tête bascule entre **clair** et **sombre**. **Profile → Appearance** propose aussi **System**, qui suit le réglage de l’appareil. Le thème initial est sombre et la préférence est conservée dans le navigateur ou l’appareil utilisé.

## Questions fréquentes

| Question | Explication ou action |
| --- | --- |
| Pourquoi faut-il compléter mon profil ? | Le prénom, le nom et l’âge sont obligatoires avant l’accès aux onglets. |
| Pourquoi n’ai-je aucune correspondance ? | Vérifiez les trois favoris minimum. Il faut aussi d’autres utilisateurs éligibles avec un score d’au moins 75 %. |
| Ajouter un favori garantit-il plus de matchs ? | Chaque changement peut augmenter ou diminuer un score : il dépend de l’ensemble des deux collections. |
| Pourquoi un cœur est-il désactivé ? | Une sauvegarde ou un chargement est en cours, ou une erreur empêche temporairement l’accès aux favoris. |
| Une liste vide signifie-t-elle une erreur ? | Pas forcément : une watchlist peut être vide et aucun profil ne peut encore atteindre le seuil. Une erreur de chargement affiche un message distinct. |
| Mon compte est désactivé : que faire ? | Contactez l’administrateur, qui peut rétablir l’accès. |
| Une photo ne s’envoie pas ? | Vérifiez la connexion, le format et la taille. Le responsable du déploiement doit aussi vérifier Cloudinary et les autorisations caméra/galerie. |

Une connexion Internet est nécessaire pour accéder aux services Firebase, TMDB et Cloudinary.

## Installation et configuration

Cette partie s’adresse aux personnes qui souhaitent lancer ou déployer le projet. Les utilisateurs d’une version déjà hébergée peuvent utiliser directement l’application.

### Prérequis et démarrage

- **Node.js 24.12 ou supérieur** et npm, selon les exigences des dépendances Firebase installées.
- Un projet Firebase avec Authentication et Firestore, un accès TMDB et un compte Cloudinary pour les photos.

Depuis le dossier contenant `package.json` :

```bash
npm ci
cp .env.example .env
```

Sous PowerShell, la copie peut aussi se faire avec `Copy-Item .env.example .env`. Complétez ensuite `.env` à partir des paramètres de vos services :

| Variable | Valeur attendue |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Clé de configuration Web Firebase. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domaine d’authentification Firebase. |
| `VITE_FIREBASE_PROJECT_ID` | Identifiant du projet Firebase. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Bucket indiqué dans la configuration Web Firebase. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Identifiant d’expéditeur de la configuration Firebase. |
| `VITE_FIREBASE_APP_ID` | Identifiant de l’application Web Firebase. |
| `VITE_TMDB_READ_TOKEN` | **API Read Access Token** TMDB, utilisé comme jeton Bearer ; ce n’est pas la clé API classique. |

Démarrez avec **`npm run dev`** et ouvrez l’adresse affichée par Vite. Redémarrez le serveur après une modification de `.env`.

### Configurer les services

**Firebase** : enregistrez une application Web, activez les fournisseurs **Email/Password** et **Google**, autorisez les domaines de connexion utilisés et créez la base Firestore. Les valeurs de configuration se trouvent dans les paramètres du projet Firebase.

**Cloudinary** : le nom du cloud et le preset d’upload sont actuellement définis dans [`src/services/auth.ts`](src/services/auth.ts). Adaptez-les à votre compte et configurez un preset permettant les uploads non signés. Aucune clé secrète Cloudinary ne doit être placée dans le client.

**Protection des données** : `.env` est ignoré par Git, mais les variables `VITE_` sont intégrées au navigateur et ne constituent pas des secrets serveur. Les permissions doivent être appliquées côté Firebase. **Aucun fichier de règles Firestore n’est fourni dans ce dépôt** : configurez les lectures/écritures personnelles, l’accès des comptes éligibles aux profils de matching et les actions réservées aux admins.

### Commandes disponibles

| Commande | Usage |
| --- | --- |
| `npm run dev` | Serveur de développement. |
| `npm run build` | Vérification TypeScript et génération du build dans `dist/`. |
| `npm run preview` | Prévisualisation locale du build, après compilation. |
| `npm run lint` | Vérification du code avec ESLint. |

## Structure technique et déploiement

**Technologies** : React 19, TypeScript, Ionic React 9, Vite 8, Capacitor 8, Firebase Authentication/Firestore, TMDB et Cloudinary.

| Emplacement | Responsabilité |
| --- | --- |
| `src/pages/` | Écrans de découverte, favoris, matching, compte et administration. |
| `src/components/` | Éléments partagés, navigation et contextes React. |
| `src/hooks/` | Suivi de la session, favoris, thème et synchronisation du matching. |
| `src/services/` | Appels aux services externes et règles de calcul du matching. |
| `src/config/firebase.ts` | Initialisation Firebase à partir des variables d’environnement. |
| `src/theme/variables.css` | Couleurs, typographie, thèmes et styles communs. |
| `src/types/` | Types TypeScript partagés. |

Firestore utilise les emplacements suivants, où `uid` désigne l’identifiant du compte Firebase :

| Emplacement Firestore | Données |
| --- | --- |
| `users/{uid}` | Informations personnelles, rôle, statut et état de complétion du profil. |
| `users/{uid}/favorites/{movieId}` | Films favoris du compte. |
| `matchingProfiles/{uid}` | Informations et identifiants de favoris nécessaires aux comparaisons. |

Les cartes de matching masquent l’email à l’affichage ; le document de matching conserve actuellement aussi ce champ. Les règles d’accès doivent tenir compte de cette donnée.

**Déploiement Web** : lancez `npm run build`, publiez `dist/` et configurez le serveur pour servir `index.html` sur les routes de l’application, notamment `/tabs/...`. Autorisez le domaine publié dans Firebase Authentication.

**Android/iOS** : les projets natifs ne sont pas inclus. Personnalisez `appId` et `appName` dans [`capacitor.config.ts`](capacitor.config.ts), installez `@capacitor/android@8` ou `@capacitor/ios@8`, puis ajoutez la plateforme avec `npx cap add android` ou `npx cap add ios`. Compilez avec `npm run build` et synchronisez avec `npx cap sync`. Android nécessite Android Studio ; iOS nécessite Xcode sur macOS. Vérifiez les autorisations caméra/galerie sur la plateforme ciblée.

Les données cinéma sont fournies par [The Movie Database](https://www.themoviedb.org/). Ce produit utilise l’API TMDB et n’est ni approuvé ni certifié par TMDB.
