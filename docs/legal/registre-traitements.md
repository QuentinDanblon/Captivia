# Registre des activités de traitement — Captivia

> Registre tenu au titre de l'article 30 du RGPD (W2-08, LEG-09). Établi le 2026-10-03 **à partir du code** de la branche `claude/zen-mendel-xq6nkb` : chaque durée de conservation renvoie au mécanisme qui l'applique réellement.
> Les mentions `[À COMPLÉTER]` relèvent du propriétaire (D-01). Ce document doit être relu par un professionnel du droit, comme les pages légales (W2-02).
> **Règle de mise à jour** : toute nouvelle donnée, tout nouveau prestataire et toute modification d'une durée de conservation (constantes de `backend/src/maintenance/maintenance.constants.ts`, `GUEST_RETENTION_DAYS`, `retention-days` des workflows) doit être reportée ici, dans `docs/RUNBOOK.md` (« Purge et rétention ») et dans la politique de confidentialité (`frontend/src/content/legal/`).

## 0. Identification

| Rubrique | Valeur |
|---|---|
| Responsable du traitement | `[À COMPLÉTER : raison sociale, forme juridique, SIREN, adresse]` (D-01) |
| Représentant légal | `[À COMPLÉTER]` |
| Contact « données personnelles » | `[À COMPLÉTER : adresse e-mail dédiée]` |
| Délégué à la protection des données (DPO) | `[À COMPLÉTER : désigné / non désigné — la désignation n'est pas obligatoire a priori : pas de suivi à grande échelle ni de données sensibles]` |
| Service | Captivia : application web (Next.js, Netlify), API (NestJS, Render, Francfort), base PostgreSQL (Neon, Francfort), applications mobiles Capacitor (à venir, vague 6) |
| Personnes concernées | Utilisateurs âgés d'au moins 15 ans (D-07), titulaires d'un compte ou invités ; opérateurs (administrateurs) |

Les données saisies sur les **animaux** (carnet de santé, médicaments, vaccins…) ne sont pas des données de santé au sens de l'article 9 du RGPD : elles concernent des animaux. Elles restent des données personnelles car rattachées au compte d'une personne. Les champs libres (notes, motifs) peuvent néanmoins recevoir des informations sensibles : la politique de confidentialité invite à ne pas en saisir.

## 1. Vue d'ensemble

| N° | Traitement | Base légale (art. 6) | Conservation (résumé) |
|---|---|---|---|
| T1 | Comptes et authentification | Exécution du contrat (6.1.b) | Durée du compte ; jetons : voir §4 |
| T2 | Mode invité (« Essayer sans compte ») | Exécution du contrat (6.1.b) | 90 jours d'inactivité (purge automatique) |
| T3 | Animaux et carnet de santé | Exécution du contrat (6.1.b) ; lien public : consentement (6.1.a) | Durée du compte |
| T4 | Rappels de soins (e-mail et push) | Contrat (6.1.b) ; push : consentement (6.1.a) | Historique : 90 jours |
| T5 | Agenda des soins (flux ICS) | Exécution du contrat (6.1.b), à l'initiative de l'utilisateur | Jusqu'à la désactivation ou la suppression du compte |
| T6 | Abonnements in-app (RevenueCat, Apple, Google) | Contrat (6.1.b) ; obligations comptables (6.1.c) | Abonnement : durée du compte ; journal de paiement : `[À COMPLÉTER : 10 ans ?]` |
| T7 | Exercice des droits (export, suppression) | Obligation légale (6.1.c) | Aucune conservation après suppression (sauf T6, T8) |
| T8 | Sauvegardes chiffrées de la base | Intérêt légitime (6.1.f) : continuité du service | 30 jours (artefacts) + historique Neon |
| T9 | Journaux techniques, sécurité, limitation de débit | Intérêt légitime (6.1.f) | Mémoire : minutes ; journaux hébergeur : selon l'offre |
| T10 | Suivi des erreurs (Sentry) | Intérêt légitime (6.1.f) | 90 jours au plus |
| T11 | Contenu encyclopédique (GBIF, PubMed, Species+) | — (aucune donnée personnelle transmise) | Sans objet |
| T12 | Administration (rôle opérateur) | Intérêt légitime (6.1.f) | Durée du compte opérateur |
| T13 | Communauté (profil public, publications, modération) — désactivée tant que `COMMUNITY_ENABLED` ≠ `true` | Contrat (6.1.b) : CGU + règles de communauté ; modération : obligation légale (6.1.c, DSA) et intérêt légitime (6.1.f) | Contenus : jusqu'à leur suppression, le départ de la communauté ou la suppression du compte ; journal de modération et signalements traités : 365 jours |

## 2. Fiches de traitement

### T1 — Comptes et authentification

- **Finalité** : créer et gérer le compte, authentifier l'utilisateur, maintenir ses sessions, vérifier son adresse e-mail, réinitialiser son mot de passe.
- **Données** (`User`, `RefreshToken`, `EmailVerificationToken`, `PasswordResetToken`) : adresse e-mail (normalisée), empreinte bcrypt du mot de passe, langue, fuseau horaire, rôle, indicateur premium, points et grade, version et date d'acceptation des CGU, date de vérification de l'e-mail, date de dernière activité (`lastActiveAt`), dates de création et de mise à jour. Pour chaque session : empreinte SHA-256 du refresh token (jamais le jeton en clair), famille de rotation, agent utilisateur (tronqué), dates d'expiration et de révocation. Jetons de vérification et de réinitialisation : empreinte SHA-256 et date d'expiration.
- **Base légale** : exécution du contrat (CGU acceptées à l'inscription, `termsVersion`).
- **Destinataires** : l'utilisateur ; hébergeurs (Render, Neon) ; prestataire e-mail pour les messages de vérification et de réinitialisation (Brevo, si `MAIL_HOST` est configuré ; sinon aucun e-mail n'est envoyé).
- **Conservation** : durée du compte. Jetons : §4.

### T2 — Mode invité

- **Finalité** : permettre d'essayer le service sans compte (un animal), puis de convertir l'essai en compte sans perte (`POST /auth/upgrade`).
- **Données** : celles de T3 pour un animal, jetons de session (empreintes), agent utilisateur, abonnements push. Aucune donnée d'identification directe (ni e-mail ni mot de passe).
- **Base légale** : exécution du service demandé.
- **Conservation** : jusqu'à la conversion en compte, la suppression par l'utilisateur, ou **90 jours sans activité** (`GUEST_RETENTION_DAYS`, `GuestPurgeService`, chaque jour à 03:17 UTC) : suppression en cascade de toutes les données de l'invité.

### T3 — Animaux et carnet de santé

- **Finalité** : enregistrer et afficher les animaux de l'utilisateur et leur suivi (carnet de santé imprimable, routines, journal des actions, médicaments, vaccins, rendez-vous vétérinaires, mesures, reproduction, filiation, photos).
- **Données** (`Animal`, `AnimalHealthRecord`, `Routine`, `ActionLog`, `Medication`, `VetAppointment`, `Vaccination`, `AnimalMeasurement`, `BreedingRecord`) : nom, espèce, sexe, date de naissance, photos (adresses ou images importées), notes, groupe ou enclos, parents ; actes, traitements, vaccins (lot, vétérinaire), rendez-vous (vétérinaire, lieu, motif), poids et tailles, événements de reproduction.
- **Lien public / QR code** (D-08) : désactivé par défaut, activé et révocable par l'utilisateur (consentement) ; la page publique n'expose que les champs choisis, sans données de santé.
- **Base légale** : exécution du contrat ; lien public : consentement.
- **Destinataires** : l'utilisateur ; toute personne disposant du lien public si l'utilisateur l'active ; hébergeurs.
- **Conservation** : durée du compte ; suppression immédiate avec le compte (cascade SQL), puis disparition des sauvegardes au bout de leur cycle (T8).

### T4 — Rappels de soins (e-mail et push)

- **Finalité** : rappeler à l'utilisateur les soins à effectuer (routines, médicaments, vaccins, rendez-vous), suivre les rappels faits ou non faits et attribuer les points.
- **Données** : préférences de notification (`NotificationPreference` : types, horaires, canal), événements de rappel (`NotificationEvent` : type, libellé, date prévue, statut, points, date d'envoi), abonnements Web Push (`PushSubscription` : adresse du service push du navigateur, clés de chiffrement).
- **Base légale** : exécution du contrat ; notifications push : consentement donné par l'autorisation du navigateur, retirable à tout moment.
- **Destinataires** : prestataire e-mail (Brevo) pour les rappels par e-mail ; service push de l'éditeur du navigateur (Google FCM, Mozilla autopush, Apple…) qui achemine un message chiffré (VAPID, `web-push`).
- **Conservation** : `NotificationEvent` : **90 jours après la date prévue** (job de maintenance, §4). Préférences : durée du compte. Abonnements push : jusqu'à la désinscription, la déconnexion de l'appareil, un refus du service push (404/410, supprimé aussitôt) ou la suppression du compte.

### T5 — Agenda des soins (flux ICS)

- **Finalité** : permettre à l'utilisateur de s'abonner, depuis son application d'agenda, au calendrier de soins de ses animaux.
- **Données** : empreinte SHA-256 du jeton du flux (`User.calendarToken`, jamais le jeton en clair) ; contenu du flux généré à la demande (noms des animaux, soins, dates), non stocké.
- **Base légale** : exécution du contrat, à l'initiative de l'utilisateur.
- **Destinataires** : l'application d'agenda choisie par l'utilisateur (Google Agenda, Apple Calendrier…), qui interroge le flux : elle agit pour le compte de l'utilisateur, pas comme sous-traitant de Captivia.
- **Conservation** : jusqu'à la régénération (l'ancien lien cesse de fonctionner), la désactivation ou la suppression du compte. Le jeton n'a pas d'expiration : le job de maintenance n'a rien à purger. Le jeton est masqué dans les journaux (`redactTokenInUrl`) et dans Sentry (`sentry-scrub.ts`).

### T6 — Abonnements in-app (RevenueCat, Apple, Google)

- **Finalité** : vendre et gérer l'abonnement Premium dans les applications mobiles (aucun paiement web : pas de Stripe), ouvrir le droit premium, conserver la preuve des transactions.
- **Données** : `Subscription` (source APPLE/GOOGLE, produit, statut, identifiant de transaction d'origine, échéance, renouvellement, environnement) ; `PaymentEvent` (fournisseur, identifiant et type d'événement, résultat, contenu de la notification RevenueCat, date de réception). L'identifiant d'utilisateur RevenueCat est l'identifiant interne Captivia (`User.id`) ; les `subscriber_attributes` ne sont pas stockés. Captivia ne reçoit aucune donnée de carte bancaire.
- **Base légale** : exécution du contrat ; obligations comptables et fiscales pour le journal de paiement.
- **Destinataires** : RevenueCat (sous-traitant) ; Apple et Google, qui encaissent le paiement en tant que **responsables de traitement distincts** (vendeur et marchand de référence de l'achat intégré).
- **Conservation** : `Subscription` : durée du compte (cascade). `PaymentEvent` : **jamais purgé par le job de maintenance** ; à la suppression du compte, `userId` passe à NULL (la notification ne contient pas d'e-mail, seulement l'identifiant interne devenu orphelin). Durée cible `[À COMPLÉTER : 10 ans (pièces justificatives comptables, art. L123-22 du Code de commerce) ou durée plus courte si les justificatifs comptables sont les relevés Apple/Google — à valider avec l'expert-comptable]`. Aucune purge automatique n'existe tant que cette durée n'est pas fixée.

### T7 — Exercice des droits

- **Finalité** : répondre aux demandes d'accès, de portabilité, de rectification et d'effacement.
- **Mise en œuvre** : export JSON complet et gratuit (`GET /users/me/export`, format 4, sans empreintes de mots de passe ni jetons ; section `community` : profil public, publications et URL des images, commentaires, réactions, signalements émis, blocages, décisions de modération reçues) ; rectification dans le service ; suppression du compte en libre-service (`DELETE /users/me`, mot de passe exigé hors invité), en cascade sur toutes les données liées, sauf `PaymentEvent` (T6) et le journal de modération (T13, conservé sans lien vers le compte) ; les fichiers des images communautaires sont effacés du stockage juste après (un échec est repris par le job de maintenance).
- **Conservation** : la suppression est immédiate en base ; les données subsistent dans les sauvegardes jusqu'à leur expiration (T8). Les demandes reçues par e-mail sont conservées `[À COMPLÉTER : durée, par ex. 1 an pour la preuve de la réponse]`.

### T8 — Sauvegardes chiffrées

- **Finalité** : restaurer la base en cas d'incident.
- **Mise en œuvre** : workflow GitHub Actions `Database Backup` (`.github/workflows/backup.yml`), chaque dimanche : `pg_dump` chiffré avec **age** (clé publique seule dans GitHub, clé privée hors ligne chez le propriétaire), déposé en artefact. Historique et restauration à un instant donné de Neon selon l'offre.
- **Données** : toute la base (T1 à T6).
- **Base légale** : intérêt légitime (continuité et intégrité du service).
- **Destinataires** : GitHub (stockage d'un fichier chiffré qu'il ne peut pas lire) ; Neon.
- **Conservation** : artefacts **30 jours** (`retention-days: 30`) ; historique Neon : fenêtre de l'offre (`[À COMPLÉTER : durée de l'offre Neon souscrite]`). Une restauration réintroduit des données supprimées depuis : après restauration, rejouer les suppressions de comptes intervenues entre la sauvegarde et l'incident `[À COMPLÉTER : procédure à formaliser dans docs/RUNBOOK.md §3]`.

### T9 — Journaux techniques, sécurité et limitation de débit

- **Finalité** : sécuriser le service, prévenir les abus, diagnostiquer les incidents.
- **Données** : journaux HTTP JSON (pino) : méthode, chemin, statut, durée, identifiant de requête, adresse IP et agent utilisateur ; sont masqués l'en-tête `Authorization`, les cookies, les champs `password`, `token`, `email` et le paramètre `token` des URL. Compteurs de limitation de débit par adresse IP (en mémoire du processus, ou Redis s'il est activé), pendant la fenêtre de limitation. Mesure d'usage de l'API réservée aux opérateurs (`/analytics`, chargée seulement si Redis est activé — désactivé dans `render.yaml`) : compteurs par route et pseudonyme (SHA-256 tronqué) des opérateurs, clés journalières expirant après 90 jours ; l'identifiant d'utilisateur n'est jamais accepté en paramètre d'URL (LEG-06).
- **Base légale** : intérêt légitime.
- **Destinataires** : Render (journaux du service), Netlify (journaux d'accès du site).
- **Conservation** : compteurs de limitation : durée de la fenêtre (minutes à une heure) ; journaux Render et Netlify : rétention de l'offre souscrite (`[À COMPLÉTER : vérifier la durée de l'offre ; la politique annonce 12 mois au plus]`).

### T10 — Suivi des erreurs (Sentry)

- **Finalité** : détecter et corriger les erreurs.
- **Mise en œuvre** : actif seulement si `SENTRY_DSN` (API) ou `NEXT_PUBLIC_SENTRY_DSN` (site) est défini ; projet hébergé dans la **région UE** de Sentry (`docs/DEPLOY.md`). `sendDefaultPii: false` côté site ; nettoyage des jetons, mots de passe, codes et e-mails avant envoi (`backend/src/sentry-scrub.ts`, `frontend/src/lib/sentry-scrub.ts`) ; traces échantillonnées à 10 %.
- **Données** : pile d'appels, route, version, navigateur, identifiant de requête.
- **Base légale** : intérêt légitime.
- **Destinataire** : Functional Software, Inc. (Sentry), sous-traitant.
- **Conservation** : **90 jours au plus** (réglage de rétention du projet Sentry : `[À COMPLÉTER : vérifier le réglage]`).

### T11 — Contenu encyclopédique et sources externes

- GBIF, PubMed (NCBI) et Species+ (CITES) sont interrogés **par le serveur** avec des noms ou identifiants d'espèces uniquement (`backend/src/external/http/` : secrets retirés, aucun en-tête utilisateur transmis). Aucune donnée personnelle ne leur est communiquée : ce ne sont ni des sous-traitants ni des destinataires.
- Certaines images de produits (Open Pet Food Facts) et ressources sont chargées directement par le navigateur : la source voit l'adresse IP du visiteur, comme pour toute ressource web (mentionné dans la politique de confidentialité).
- Amazon : **aucune intégration** (route `/amazon/*` retirée, D-09). Un éventuel lien d'affiliation ne transmet aucune donnée.

### T12 — Administration (rôle opérateur)

- **Finalité** : modérer et administrer le service (statut premium manuel, contenus et file de modération de la communauté — T13 —, mesure d'usage). Les opérateurs voient le pseudo des auteurs et le contenu signalé, jamais leur adresse e-mail.
- **Données** : compte opérateur (T1), rôle `OPERATOR` attribué uniquement en base par `npm run operator:set` ; e-mail vérifié obligatoire.
- **Base légale** : intérêt légitime (gestion du service).
- **Conservation** : durée du compte ; rétrogradation documentée (`docs/RUNBOOK.md` §5).

### T13 — Communauté (volet social)

- **Finalité** : permettre aux membres qui le choisissent de publier des photos et des questions sur leurs animaux, de commenter et d'aimer les publications ; modérer ces contenus (signalements, masquage, suppression, suspension, recours) conformément au règlement (UE) 2022/2065 sur les services numériques (DSA) ; protéger les membres (blocage, limitation des abus).
- **Activation** : aucune donnée n'est créée sans activation explicite du profil public par l'utilisateur, qui accepte les règles de communauté (version et date enregistrées, `CommunityProfile.rulesVersion` / `rulesAcceptedAt`). Réservé aux comptes à e-mail vérifié (jamais aux invités) ayant confirmé l'âge minimal des CGU (15 ans, D-07) : case de l'inscription, ou confirmation à l'activation pour un compte antérieur (`ageConfirmedAt`). Le volet entier est désactivé tant que `COMMUNITY_ENABLED` ≠ `true`.
- **Données** :
  - profil public (`CommunityProfile`) : pseudo, avatar facultatif, version et date d'acceptation des règles, date de confirmation de l'âge, suspension éventuelle — **jamais l'adresse e-mail** ;
  - publications (`CommunityPost`) : type, texte (≤ 2 000 caractères), catégorie d'espèce, images, et **si l'auteur le choisit** l'animal montré : seuls son nom et son espèce sont affichés, **aucune donnée du carnet de santé** (séparation vérifiée par un test automatisé) ;
  - commentaires (`CommunityComment`), « j'aime » (`CommunityReaction`), blocages (`CommunityBlock`) ;
  - images (`CommunityMedia`) : fichier ré-encodé en WebP, ≤ 1 600 px de large, **sans aucune métadonnée** (EXIF, dont la géolocalisation GPS, XMP, IPTC retirés avant stockage) ; clé aléatoire, dimensions, poids ;
  - signalements (`CommunityReport`) : auteur du signalement, contenu visé, motif (liste fermée), précisions facultatives (≤ 500 caractères), statut ;
  - décisions de modération (`CommunityModerationAction`) : action, contenu ou compte visé, motif, exposé des motifs, caractère automatisé, opérateur, date de notification, recours (texte, issue).
- **Base légale** : exécution du contrat (CGU et règles de communauté acceptées) pour le profil, les contenus, les réactions et les blocages ; obligation légale (DSA art. 16, 17 et 20 : traitement des signalements, exposé des motifs, recours interne) et intérêt légitime (sécurité de la communauté, lutte contre le spam) pour la modération et les limitations.
- **Destinataires** : les membres connectés (contenus publiés : pseudo, avatar, texte, images, nom et espèce de l'animal montré) ; les opérateurs (T12) ; le stockage objet des images (Cloudflare R2, si `MEDIA_DRIVER=s3`) ; le prestataire e-mail (notifications de modération à l'auteur) ; hébergeurs. Les images sont publiques pour qui connaît leur adresse (clé aléatoire non devinable).
- **Mesures** : modération décrite dans `docs/RUNBOOK.md` §9 ; masquage automatique au-delà de `COMMUNITY_HIDE_THRESHOLD` signalements distincts (défaut 3), toujours revu par une personne sur recours ; notification motivée de chaque décision défavorable avec point de contact (`COMMUNITY_CONTACT_EMAIL`), recours interne gratuit pendant 6 mois, mention du règlement extrajudiciaire et de la voie judiciaire ; blocage entre membres (contenus masqués dans les deux sens) ; limites par compte (publications par heure, commentaires par minute, images par heure, signalements par heure) ; liens interdits pendant les 7 premiers jours d'un compte ; contrôle du type réel des fichiers (signature binaire), taille maximale (`MEDIA_MAX_BYTES`, 8 Mo par défaut).
- **Conservation** :
  - profil, publications, commentaires, réactions, blocages, images : jusqu'à leur suppression par l'utilisateur, son départ de la communauté (`DELETE /community/profile` : tout est effacé, fichiers compris), la suppression par un opérateur ou la suppression du compte ;
  - contenus masqués : conservés (visibles de leur seul auteur et des opérateurs) jusqu'à la décision de l'opérateur, la suppression par l'auteur ou celle du compte ;
  - images téléversées jamais rattachées à une publication ou un avatar : **24 heures** (job de maintenance, fichier compris) ;
  - signalements : ouverts jusqu'à leur traitement ; traités : **365 jours** ; supprimés avec le compte de leur auteur ;
  - journal des décisions de modération : **365 jours** (exposé des motifs, recours ouvert 6 mois), conservé après la suppression du contenu ou du compte, sans lien vers le compte (`subjectId` → NULL) `[À VALIDER : durée, avec un professionnel du droit]`.

## 3. Sous-traitants et destinataires

| Prestataire | Rôle | Données | Localisation | Garanties de transfert | DPA |
|---|---|---|---|---|---|
| Neon, Inc. (groupe Databricks) | Base PostgreSQL | Toute la base | Francfort (UE) ; société aux États-Unis | Clauses contractuelles types (CCT) / DPF selon certification | À signer |
| Render Services, Inc. | Hébergement de l'API, journaux | Toutes les requêtes API, journaux | Francfort (UE) ; société aux États-Unis | CCT / DPF | À signer |
| Netlify, Inc. | Hébergement du site (CDN) | Requêtes du site (IP, journaux d'accès) | CDN mondial ; société aux États-Unis | CCT / DPF | À signer |
| Brevo (Sendinblue SAS) — si `MAIL_*` configuré (D-06) | E-mails transactionnels et rappels | E-mail, langue, contenu des messages (noms d'animaux, soins) | UE (France) | Sans transfert hors UE annoncé | À signer |
| Functional Software, Inc. (Sentry) — si DSN configuré | Suivi des erreurs | Événements d'erreur nettoyés | Région UE du compte ; société aux États-Unis | CCT / DPF | À signer |
| RevenueCat, Inc. — si `IAP_ENABLED` | Gestion des achats intégrés | Identifiant interne, achats, statut d'abonnement | États-Unis | CCT / DPF | À signer |
| Cloudflare, Inc. (R2) — si `MEDIA_DRIVER=s3` (T13) | Stockage et diffusion des images de la communauté | Images ré-encodées sans métadonnées (clés aléatoires) | Juridiction UE du bucket si choisie `[À COMPLÉTER]` ; société aux États-Unis | CCT / DPF | À signer avant `COMMUNITY_ENABLED=true` |
| GitHub, Inc. (Microsoft) | CI/CD, stockage des sauvegardes **chiffrées** | Dumps chiffrés (illisibles sans la clé privée), code | États-Unis | CCT / DPF | À accepter (DPA intégré aux conditions GitHub) |
| Apple Inc., Google LLC | Vente des achats intégrés ; services push | Achat (identité du payeur chez le store) ; messages push chiffrés | Monde | Responsables distincts (stores) / éditeurs de navigateur | Sans objet (conditions des stores) |
| Applications d'agenda de l'utilisateur | Lecture du flux ICS | Contenu du flux | Selon l'application | À l'initiative de l'utilisateur | Sans objet |
| GBIF, NCBI PubMed, Species+ (PNUE-WCMC) | Sources de contenu | Aucune donnée personnelle | — | — | Sans objet |

Aucune donnée n'est vendue, louée ni utilisée à des fins publicitaires. Pas de Stripe ni d'Amazon.

## 4. Durées de conservation et purges effectives

| Donnée | Durée | Mécanisme (code) | Fréquence |
|---|---|---|---|
| Compte et données liées (T1, T3, T4) | Durée du compte | Suppression en libre-service (`AccountService.deleteAccount`), cascade SQL | Immédiate |
| Comptes **inactifs depuis plus de 36 mois** | Aucune suppression automatique | Procédure manuelle avec préavis par e-mail (§6) | Revue `[À COMPLÉTER : annuelle ?]` |
| Invités inactifs | 90 jours sans activité (`GUEST_RETENTION_DAYS`) | `GuestPurgeService`, verrou consultatif `4731202611` | Quotidienne, 03:17 UTC |
| Jetons de réinitialisation du mot de passe | Validité 1 h ; supprimés dès l'expiration | `MaintenanceService` (+ purge à chaque nouvelle demande) | Quotidienne, 03:41 UTC |
| Jetons de vérification d'e-mail | Validité 24 h ; supprimés dès l'expiration (ou invalidation par un nouvel envoi) | `MaintenanceService` | Quotidienne, 03:41 UTC |
| Refresh tokens (empreintes) | Validité 30 jours (≥ 90 jours pour un invité), rotatifs ; supprimés **30 jours après expiration ou révocation** | `MaintenanceService` (tous comptes) + purge opportuniste des jetons expirés du compte à chaque rotation | Quotidienne, 03:41 UTC |
| Événements de rappel (`NotificationEvent`) | **90 jours** après la date prévue | `MaintenanceService` | Quotidienne, 03:41 UTC |
| Abonnements push | Jusqu'à désinscription, échec 404/410 ou suppression du compte | `WebPushSender`, cascade | À l'événement |
| Jeton du flux ICS | Jusqu'à régénération, désactivation ou suppression du compte | Remplacement de `User.calendarToken` | À l'événement |
| Communauté : contenus, profil, réactions, blocages (T13) | Jusqu'à suppression par l'utilisateur, départ de la communauté, décision d'un opérateur ou suppression du compte | `CommunityDataService` (départ, suppression du compte : fichiers compris), cascade SQL | Immédiate |
| Communauté : images orphelines | 24 h (jamais rattachées) ; immédiat si le propriétaire est supprimé | `MaintenanceService` → `CommunityMediaService.purgeOrphans` (fichier puis ligne, 1 000 par exécution) | Quotidienne, 03:41 UTC |
| Communauté : signalements traités, journal de modération | **365 jours** (`COMMUNITY_MODERATION_RETENTION_DAYS`) ; signalements ouverts : jusqu'à traitement | `MaintenanceService` | Quotidienne, 03:41 UTC |
| Journal de paiement (`PaymentEvent`) | `[À COMPLÉTER : 10 ans ?]` — **non purgé** | Aucun (obligations comptables) ; `userId` → NULL à la suppression du compte | — |
| Sauvegardes chiffrées | 30 jours | `retention-days: 30` (`backup.yml`) | Hebdomadaire |
| Compteurs de mesure d'usage (Redis, opérateurs) | 90 jours | `EXPIRE` sur les clés journalières (`ApiAnalyticsService`) | À l'écriture |
| Compteurs de limitation de débit | Fenêtre de limitation | Expiration en mémoire / Redis | Continue |
| Journaux Render / Netlify | Rétention de l'offre | Hébergeur | `[À COMPLÉTER]` |
| Événements Sentry | 90 jours au plus | Réglage du projet Sentry | `[À COMPLÉTER]` |

Le job de maintenance (`backend/src/maintenance/`) supprime par lots de 1 000 lignes, au plus 50 000 lignes par table et par exécution (le reste part le lendemain), sous verrou consultatif `4731202612`, et journalise le nombre de lignes supprimées par catégorie. `MAINTENANCE_ENABLED=false` le suspend.

## 5. Mesures de sécurité

- **Transport** : HTTPS partout (Netlify, Render) ; en-têtes de sécurité `helmet` ; CORS limité aux origines déclarées.
- **Authentification** : mots de passe bcrypt (10 tours, 10 à 128 caractères) ; jeton d'accès JWT HS256 de 30 minutes ; refresh tokens opaques, rotatifs, stockés hachés, détection de réutilisation (révocation de la famille), révocation globale par `tokenVersion` (déconnexion de tous les appareils, changement ou réinitialisation du mot de passe).
- **Jetons à usage unique** (réinitialisation, vérification d'e-mail, flux ICS) : stockés uniquement sous forme d'empreinte SHA-256, durée de vie courte, purge quotidienne.
- **Cloisonnement** : chaque ressource est filtrée par propriétaire (protection BOLA) ; rôle opérateur attribué uniquement en base, e-mail vérifié exigé.
- **Limitation de débit** : globale (throttler) et dédiée (connexion, réinitialisation, création d'invités : 5 par heure et par IP).
- **Communauté (T13)** : images contrôlées par leur signature binaire (JPEG, PNG, WebP seulement), taille et nombre de pixels bornés, ré-encodées en WebP sans métadonnées (EXIF/GPS) ; aucune route communautaire ne lit le carnet de santé ni l'adresse e-mail (test automatisé) ; texte stocké brut et affiché comme texte ; limites par compte ; blocage ; volet désactivable instantanément (`COMMUNITY_ENABLED=false`).
- **Validation** : DTO stricts (`whitelist`, `forbidNonWhitelisted`) ; appels sortants par un client unique (hôtes publics en HTTPS, taille et délai bornés, secrets retirés, disjoncteur).
- **Minimisation des journaux** : masquage des en-têtes d'autorisation, cookies, mots de passe, jetons et e-mails (pino) ; nettoyage Sentry ; aucun identifiant d'utilisateur en paramètre d'URL.
- **Base de données** : hébergement UE, chiffrement au repos et en transit (Neon), contraintes d'intégrité SQL (CHECK, clés étrangères en cascade).
- **Sauvegardes** : chiffrées avec age avant de quitter le runner ; clé privée hors ligne ; test de restauration documenté (`docs/RUNBOOK.md` §3.4).
- **Secrets** : variables d'environnement Render, Netlify et GitHub (jamais dans le dépôt) ; procédures de rotation (`docs/RUNBOOK.md` §4).
- **Conservation** : purges automatiques décrites au §4.
- **Violations de données** : évaluation par le propriétaire, notification à la CNIL sous 72 h si nécessaire, information des personnes en cas de risque élevé (`[À COMPLÉTER : registre des violations et contact]`).

## 6. Comptes inactifs depuis plus de 36 mois

Aucune suppression automatique : la décision reste humaine.

1. **Repérage** (requête en lecture seule, voir `docs/RUNBOOK.md`, « Purge et rétention ») : comptes non invités dont `lastActiveAt` remonte à plus de 36 mois, sans abonnement actif.
2. **Préavis** : e-mail à chaque titulaire annonçant la suppression dans un délai `[À COMPLÉTER : 30 jours]`, avec un lien de connexion et le lien d'export des données. Toute connexion pendant le délai met à jour `lastActiveAt` et annule la suppression.
3. **Suppression manuelle** à l'échéance, uniquement pour les comptes toujours inactifs (même cascade que la suppression en libre-service), puis consignation du nombre de comptes supprimés et de la date.

La durée de 36 mois (référence CNIL pour une inactivité prolongée) est à confirmer par le propriétaire et à inscrire dans la politique de confidentialité (`[À COMPLÉTER]`).

## 7. Accords de sous-traitance (DPA) à signer

- [ ] Neon — DPA (console Neon / site Neon) `[À COMPLÉTER : date de signature]`
- [ ] Render — DPA `[À COMPLÉTER]`
- [ ] Netlify — DPA `[À COMPLÉTER]`
- [ ] Brevo — DPA (inclus dans les conditions, à accepter dans le compte) dès la configuration de `MAIL_*` `[À COMPLÉTER]`
- [ ] Sentry — DPA, avec vérification de la région UE du projet `[À COMPLÉTER]`
- [ ] RevenueCat — DPA, avant `IAP_ENABLED=true` `[À COMPLÉTER]`
- [ ] GitHub — DPA (GitHub Data Protection Agreement, intégré aux conditions) `[À COMPLÉTER]`
- [ ] Cloudflare (R2, images de la communauté) — DPA (Cloudflare Data Processing Addendum), avant `COMMUNITY_ENABLED=true` `[À COMPLÉTER]`
- [ ] Apple (Paid Applications Agreement) et Google Play (Developer Distribution Agreement) : pas de DPA, conditions des stores à accepter (W6-01)

## 8. Points à décider ou compléter par le propriétaire

- Identité du responsable du traitement et contact (D-01).
- Durée de conservation de `PaymentEvent` (avec l'expert-comptable) et, le cas échéant, purge à mettre en place.
- Confirmation des 36 mois d'inactivité, du délai de préavis et de la fréquence de revue des comptes inactifs ; mise à jour de la politique de confidentialité en conséquence.
- Rétention réelle des journaux Render / Netlify et des événements Sentry (la politique annonce 12 mois et 90 jours au plus).
- Durée de l'historique Neon (offre souscrite).
- Signature des DPA (§7) et registre des violations.
- Mention des achats intégrés (RevenueCat, Apple, Google) dans la politique de confidentialité avant la vague 6 (absente aujourd'hui).
- **Communauté (T13), avant `COMMUNITY_ENABLED=true`** : publier les règles de communauté (version `2026-10`) et compléter les CGU (contenus des membres, licence d'affichage, modération, recours) ; ajouter T13 à la politique de confidentialité ; désigner le point de contact DSA (`COMMUNITY_CONTACT_EMAIL`) et le délai cible de traitement des signalements et des recours ; valider la durée de 365 jours du journal de modération ; signer le DPA Cloudflare (R2) et choisir la juridiction UE du bucket ; prévoir la procédure de signalement aux autorités des contenus manifestement illicites (`docs/RUNBOOK.md` §9.2).
