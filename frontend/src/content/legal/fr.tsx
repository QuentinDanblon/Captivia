import type { ReactNode } from 'react';
import { HOSTS, LEGAL, LEGAL_ROUTES } from '@/lib/legal';
import { A, Field, ILink, P, Table, UL, type LegalContent } from './ui';
import { PhotoCreditsTable } from './photos';

/**
 * Contenu des documents légaux — version française (version de référence).
 * Les informations propres à l'éditeur proviennent de `@/lib/legal`.
 * Document à faire valider par un professionnel du droit.
 */
export function buildFrContent(locale: string): LegalContent {
  const L = (href: string, children: ReactNode) => (
    <ILink locale={locale} href={href}>
      {children}
    </ILink>
  );
  const contact = <Field value={LEGAL.contactEmail} />;

  return {
    legalNotice: {
      title: 'Mentions légales',
      description:
        "Identité de l'éditeur, directeur de la publication et hébergeurs du service Captivia (article 6 III de la loi pour la confiance dans l'économie numérique).",
      sections: [
        {
          id: 'editeur',
          title: 'Éditeur du service',
          body: (
            <>
              <P>
                Le service {LEGAL.serviceName} (site web et application) est édité par :
              </P>
              <UL>
                <li>
                  Dénomination : <Field value={LEGAL.companyName} />
                </li>
                <li>
                  Forme juridique et capital : <Field value={LEGAL.legalForm} />
                </li>
                <li>
                  Immatriculation (SIREN) : <Field value={LEGAL.siren} />
                </li>
                <li>
                  TVA intracommunautaire : <Field value={LEGAL.vatNumber} />
                </li>
                <li>
                  Adresse : <Field value={LEGAL.address} />
                </li>
                <li>
                  Téléphone : <Field value={LEGAL.phone} />
                </li>
                <li>Courriel : {contact}</li>
              </UL>
            </>
          ),
        },
        {
          id: 'directeur-publication',
          title: 'Directeur de la publication',
          body: (
            <P>
              <Field value={LEGAL.publicationDirector} />
            </P>
          ),
        },
        {
          id: 'hebergement',
          title: 'Hébergement',
          body: (
            <UL>
              <li>
                Interface web : {HOSTS.frontend.name}, {HOSTS.frontend.address} —{' '}
                <A href={HOSTS.frontend.website}>{HOSTS.frontend.website}</A>
              </li>
              <li>
                Serveur applicatif (API) : {HOSTS.api.name}, {HOSTS.api.address} — serveurs situés à{' '}
                {HOSTS.api.region} — <A href={HOSTS.api.website}>{HOSTS.api.website}</A>
              </li>
              <li>
                Base de données : {HOSTS.database.name} — serveurs situés à {HOSTS.database.region} —{' '}
                <A href={HOSTS.database.website}>{HOSTS.database.website}</A>
              </li>
            </UL>
          ),
        },
        {
          id: 'propriete-intellectuelle',
          title: 'Propriété intellectuelle',
          body: (
            <>
              <P>
                La structure du service, son code, sa charte graphique, ses textes originaux et le nom{' '}
                {LEGAL.serviceName} sont protégés par le droit de la propriété intellectuelle. Toute reproduction
                ou représentation non autorisée est interdite.
              </P>
              <P>
                Les contenus issus de sources ouvertes (Wikipédia, Wikidata, GBIF, Open Pet Food Facts, etc.)
                restent soumis à leurs licences respectives, détaillées sur la page{' '}
                {L(LEGAL_ROUTES.sources, 'Sources et licences')}.
              </P>
            </>
          ),
        },
        {
          id: 'affiliation',
          title: 'Affiliation',
          body: (
            <P>
              {LEGAL.serviceName} n&apos;affiche aujourd&apos;hui aucun lien d&apos;affiliation. Si des liens
              partenaires vers des sites marchands sont proposés, ils sont signalés comme tels, et le programme
              d&apos;affiliation concerné est nommé à côté ; voir la page{' '}
              {L(LEGAL_ROUTES.transparency, 'Transparence et affiliation')}.
            </P>
          ),
        },
        {
          id: 'signalement',
          title: 'Contact et signalement de contenu illicite',
          body: (
            <P>
              Pour toute question ou pour signaler un contenu manifestement illicite, écrivez à {contact} en
              précisant l&apos;adresse de la page concernée et la nature du contenu.
            </P>
          ),
        },
        {
          id: 'donnees-personnelles',
          title: 'Données personnelles',
          body: (
            <P>
              Le traitement de vos données personnelles est décrit dans la{' '}
              {L(LEGAL_ROUTES.privacy, 'politique de confidentialité')}. L&apos;utilisation du service est régie
              par les {L(LEGAL_ROUTES.terms, "conditions générales d'utilisation")}.
            </P>
          ),
        },
      ],
    },

    privacy: {
      title: 'Politique de confidentialité',
      description:
        'Données collectées par Captivia, finalités, bases légales, sous-traitants, durées de conservation, traceurs et exercice de vos droits (RGPD).',
      sections: [
        {
          id: 'responsable',
          title: '1. Responsable du traitement',
          body: (
            <P>
              Le responsable du traitement est <Field value={LEGAL.companyName} />, <Field value={LEGAL.address} />.
              Pour toute question relative à vos données ou pour exercer vos droits : {contact}.
            </P>
          ),
        },
        {
          id: 'donnees',
          title: '2. Données que nous traitons',
          body: (
            <>
              <P>Nous ne collectons que les données nécessaires au fonctionnement du service :</P>
              <UL>
                <li>
                  <strong>Compte</strong> : adresse e-mail, empreinte (hachage) de votre mot de passe — jamais le
                  mot de passe en clair —, langue d&apos;affichage, dates de création et de mise à jour, indicateur
                  d&apos;abonnement.
                </li>
                <li>
                  <strong>Progression</strong> : points et grade obtenus dans le service.
                </li>
                <li>
                  <strong>Animaux</strong> que vous enregistrez : nom, espèce, date de naissance, sexe, photos
                  (image que vous importez ou adresse web que vous indiquez), notes, groupe ou enclos, filiation
                  (père, mère), routines de soins et journal des actions réalisées.
                </li>
                <li>
                  <strong>Suivi de santé de vos animaux</strong> : carnet de santé, médicaments (nom, dose,
                  fréquence), vaccins (nom, date, rappel, numéro de lot, vétérinaire), rendez-vous vétérinaires
                  (vétérinaire, date, lieu, motif), mesures (poids, taille) et reproduction (événements,
                  partenaire, nombre de petits).
                </li>
                <li>
                  <strong>Notifications</strong> : vos préférences, l&apos;historique des rappels générés et, si
                  vous activez les notifications push, l&apos;abonnement technique fourni par votre navigateur
                  (adresse du service de notification et clés de chiffrement).
                </li>
                <li>
                  <strong>Réinitialisation du mot de passe</strong> : un jeton à usage unique, valable une heure.
                </li>
                <li>
                  <strong>Données techniques et de sécurité</strong> : adresse IP et informations de requête, utilisées
                  pour limiter les abus (limitation du nombre de requêtes) et présentes dans les journaux techniques
                  des hébergeurs ; rapports d&apos;erreurs techniques si le suivi d&apos;erreurs est activé.
                </li>
              </UL>
              <P>
                Les informations sur vos animaux ne sont pas des données de santé au sens du RGPD. Évitez toutefois
                d&apos;inscrire dans les champs libres (notes, motifs) des informations sensibles vous concernant ou
                concernant d&apos;autres personnes.
              </P>
            </>
          ),
        },
        {
          id: 'finalites',
          title: '3. Finalités et bases légales',
          body: (
            <Table
              head={['Finalité', 'Base légale (RGPD, art. 6)']}
              rows={[
                [
                  'Créer et gérer votre compte, enregistrer et afficher vos animaux, carnet de santé, routines et rappels',
                  'Exécution du contrat (CGU) — art. 6.1.b',
                ],
                [
                  'Envoyer les e-mails nécessaires au service (réinitialisation du mot de passe, informations sur le compte)',
                  'Exécution du contrat — art. 6.1.b',
                ],
                ['Envoyer des notifications push', 'Consentement, donné via l’autorisation du navigateur et retirable à tout moment — art. 6.1.a'],
                [
                  'Rendre publique la fiche d’un animal (partage par lien ou QR code)',
                  'Consentement : partage désactivé par défaut, activé et révocable par vous — art. 6.1.a',
                ],
                [
                  'Sécuriser le service, prévenir les abus, diagnostiquer les erreurs',
                  'Intérêt légitime à assurer la sécurité et le bon fonctionnement du service — art. 6.1.f',
                ],
                ['Répondre aux demandes des autorités et respecter nos obligations', 'Obligation légale — art. 6.1.c'],
              ]}
            />
          ),
        },
        {
          id: 'destinataires',
          title: '4. Destinataires et sous-traitants',
          body: (
            <>
              <P>
                Vos données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires. Elles sont
                accessibles à l&apos;éditeur et aux sous-traitants techniques suivants, dans la limite de leur mission :
              </P>
              <Table
                head={['Prestataire', 'Rôle', 'Localisation des données']}
                rows={[
                  [HOSTS.frontend.name, 'Hébergement de l’interface web', 'Réseau mondial de diffusion (CDN) ; société établie aux États-Unis'],
                  [HOSTS.api.name, 'Hébergement de l’API', `${HOSTS.api.region} ; société établie aux États-Unis`],
                  [HOSTS.database.name, 'Base de données PostgreSQL', `${HOSTS.database.region} ; société établie aux États-Unis`],
                  ['Functional Software, Inc. (Sentry)', 'Suivi des erreurs techniques, uniquement s’il est activé', 'Selon la région du compte Sentry ; société établie aux États-Unis'],
                  [<Field key="mail" value={LEGAL.emailProvider} />, 'Envoi des e-mails transactionnels', <Field key="mail-loc" value={LEGAL.emailProvider} />],
                  ['Service push de votre navigateur (Google, Mozilla, Apple…)', 'Acheminement des notifications push, si vous les activez', 'Selon l’éditeur du navigateur'],
                ]}
              />
              <P>
                Lorsque des données peuvent être accessibles depuis un pays situé hors de l&apos;Union européenne,
                ce transfert est encadré par les clauses contractuelles types de la Commission européenne et, le cas
                échéant, par le cadre de protection des données UE–États-Unis (Data Privacy Framework) lorsque le
                prestataire y est certifié.
              </P>
            </>
          ),
        },
        {
          id: 'sources-tierces',
          title: '5. Sources de données externes',
          body: (
            <>
              <P>
                Les fiches d&apos;espèces s&apos;appuient sur des services ouverts (GBIF, Wikipédia, Wikidata,
                Species+/CITES, PubMed, Open Pet Food Facts, iNaturalist, Encyclopedia of Life). Notre serveur les
                interroge avec des noms ou identifiants d&apos;espèces uniquement : aucune donnée personnelle ne leur
                est transmise.
              </P>
              <P>
                Certaines images (par exemple les photos de produits d&apos;Open Pet Food Facts) sont chargées
                directement depuis les serveurs de leur source : comme pour toute ressource web, votre navigateur
                leur communique alors votre adresse IP.
              </P>
              <P>
                Si vous suivez un lien vers un site marchand partenaire, vous quittez {LEGAL.serviceName} : ce site
                applique sa propre politique de confidentialité et de cookies. Nous ne
                lui transmettons aucune donnée vous concernant ; le lien contient seulement notre identifiant de
                partenaire.
              </P>
            </>
          ),
        },
        {
          id: 'conservation',
          title: '6. Durées de conservation',
          body: (
            <UL>
              <li>
                Compte, animaux et données associées : tant que votre compte existe. Ils sont effacés lors de la
                suppression du compte ; les sauvegardes automatiques de la base sont écrasées selon leur cycle de
                rétention (30 jours au plus).
              </li>
              <li>
                Utilisation sans compte (invité) : votre animal et son carnet sont conservés jusqu&apos;à la création
                d&apos;un compte, leur suppression, ou après 90 jours sans utilisation de l&apos;application ; ils sont
                alors effacés.
              </li>
              <li>Jeton de réinitialisation du mot de passe : une heure au plus, puis il devient inutilisable.</li>
              <li>Jeton de connexion conservé dans votre navigateur : valable 7 jours, effacé à la déconnexion.</li>
              <li>Journaux techniques et de sécurité (dont l&apos;adresse IP) : 12 mois au plus.</li>
              <li>Rapports d&apos;erreurs (si le suivi est activé) : 90 jours au plus.</li>
            </UL>
          ),
        },
        {
          id: 'traceurs',
          title: '7. Cookies et stockage local',
          body: (
            <>
              <P>
                {LEGAL.serviceName} n&apos;utilise aucun cookie publicitaire, aucun outil de mesure d&apos;audience
                tiers et aucun bouton de réseau social. Seuls des traceurs strictement nécessaires au service sont
                utilisés ; ils sont dispensés de consentement (article 82 de la loi Informatique et Libertés) :
              </P>
              <UL>
                <li>
                  <strong>Stockage local du navigateur (localStorage)</strong> — <code>token</code> : jeton de
                  connexion qui vous maintient authentifié ; <code>user</code> : copie de votre profil (identifiant,
                  e-mail, langue, points, grade, indicateur d&apos;abonnement) pour l&apos;affichage. Ces éléments
                  sont effacés lorsque vous vous déconnectez.
                </li>
                <li>
                  <strong>Cookie de session <code>NEXT_LOCALE</code></strong> : mémorise la langue que vous avez
                  choisie lorsqu&apos;elle diffère de celle de votre navigateur ; il disparaît à la fermeture du
                  navigateur.
                </li>
              </UL>
            </>
          ),
        },
        {
          id: 'securite',
          title: '8. Sécurité',
          body: (
            <P>
              Les échanges sont chiffrés (HTTPS), les mots de passe sont stockés sous forme hachée, l&apos;accès à
              vos données est limité à votre compte et le nombre de requêtes est limité pour prévenir les abus.
              Aucune mesure n&apos;offrant une sécurité absolue, nous vous notifierons ainsi que la CNIL de toute
              violation de données dans les conditions prévues par le RGPD.
            </P>
          ),
        },
        {
          id: 'droits',
          title: '9. Vos droits',
          body: (
            <>
              <P>
                Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation,
                d&apos;opposition, de portabilité, du droit de retirer votre consentement à tout moment et du droit
                de définir des directives sur le sort de vos données après votre décès.
              </P>
              <UL>
                <li>
                  <strong>Export gratuit</strong> de vos données dans un format lisible par machine (JSON) :{' '}
                  {L(LEGAL_ROUTES.accountSettings, 'Paramètres > Compte')}.
                </li>
                <li>
                  <strong>Suppression de votre compte</strong> et de toutes les données associées :{' '}
                  {L(LEGAL_ROUTES.accountSettings, 'Paramètres > Compte')} (voir aussi{' '}
                  {L(LEGAL_ROUTES.accountDeletion, 'Supprimer mon compte')}).
                </li>
                <li>
                  Rectification : directement dans le service (profil, fiches de vos animaux).
                </li>
                <li>Toute autre demande : {contact}.</li>
              </UL>
              <P>
                Ces démarches sont gratuites. Nous répondons dans un délai d&apos;un mois, prolongeable de deux mois
                pour les demandes complexes ; en cas de doute raisonnable sur votre identité, un justificatif
                peut vous être demandé.
              </P>
              <P>
                Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de
                la Commission nationale de l&apos;informatique et des libertés (CNIL), 3 place de Fontenoy, TSA 80715,
                75334 Paris Cedex 07 — <A href="https://www.cnil.fr/fr/plaintes">www.cnil.fr/fr/plaintes</A>.
              </P>
            </>
          ),
        },
        {
          id: 'mineurs',
          title: '10. Âge minimum',
          body: (
            <P>
              La création d&apos;un compte est réservée aux personnes âgées d&apos;au moins {LEGAL.minimumAge} ans,
              âge du consentement numérique en France (article 45 de la loi Informatique et Libertés).
            </P>
          ),
        },
        {
          id: 'modifications',
          title: '11. Modifications',
          body: (
            <P>
              Cette politique peut évoluer, notamment lors de l&apos;ajout de fonctionnalités (par exemple un
              abonnement payant). La date de dernière mise à jour figure en haut de la page ; en cas de changement
              important, vous en serez informé dans le service ou par e-mail.
            </P>
          ),
        },
      ],
    },

    terms: {
      title: "Conditions générales d'utilisation",
      description:
        "Règles d'accès et d'utilisation du service Captivia : compte, âge minimum, contenus, partage public, limites des informations fournies et responsabilité.",
      sections: [
        {
          id: 'objet',
          title: '1. Objet',
          body: (
            <P>
              Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;utilisation du service{' '}
              {LEGAL.serviceName}, édité par <Field value={LEGAL.companyName} /> (voir les{' '}
              {L(LEGAL_ROUTES.legalNotice, 'mentions légales')}). La création d&apos;un compte vaut acceptation des
              CGU ; la simple consultation du site implique leur respect.
            </P>
          ),
        },
        {
          id: 'service',
          title: '2. Description du service',
          body: (
            <UL>
              <li>Consultation gratuite de fiches d&apos;espèces (taxonomie, soins, alimentation, matériel, réglementation).</li>
              <li>
                Avec un compte : enregistrement de vos animaux, carnet de santé, routines, rappels et notifications.
              </li>
              <li>
                Un magasin pouvant présenter des liens vers des sites marchands partenaires (liens d&apos;affiliation,
                signalés comme tels).
              </li>
              <li>Le partage public facultatif de la fiche d&apos;un animal.</li>
            </UL>
          ),
        },
        {
          id: 'compte',
          title: '3. Compte et âge minimum',
          body: (
            <>
              <P>
                Vous devez avoir au moins {LEGAL.minimumAge} ans pour créer un compte. Vous vous engagez à fournir une
                adresse e-mail valide, à garder votre mot de passe confidentiel et à nous signaler toute utilisation
                non autorisée de votre compte.
              </P>
              <P>
                Vous pouvez supprimer votre compte à tout moment et gratuitement depuis{' '}
                {L(LEGAL_ROUTES.accountSettings, 'Paramètres > Compte')}.
              </P>
            </>
          ),
        },
        {
          id: 'veterinaire',
          title: '4. Informations de santé : pas de substitution à un vétérinaire',
          body: (
            <P>
              Les informations fournies (soins, alimentation, santé, médicaments, rappels) sont générales et
              indicatives. Elles ne constituent ni un diagnostic, ni une prescription, ni un avis vétérinaire, et ne
              remplacent pas la consultation d&apos;un vétérinaire. En cas de doute, de symptôme ou d&apos;urgence,
              contactez sans délai un vétérinaire. Les rappels du service sont une aide : ils ne garantissent pas
              qu&apos;un soin sera réalisé à temps.
            </P>
          ),
        },
        {
          id: 'reglementation',
          title: '5. Réglementation sur la détention des animaux',
          body: (
            <P>
              Les informations réglementaires (statut CITES, protection, autorisations) sont fournies à titre
              indicatif et peuvent être incomplètes ou ne plus être à jour. Il vous appartient de vérifier la
              réglementation applicable avant d&apos;acquérir ou de détenir un animal, notamment en France
              l&apos;arrêté du 8 octobre 2018 relatif à la détention d&apos;animaux d&apos;espèces non domestiques,
              auprès des autorités compétentes (direction départementale de la protection des populations).
            </P>
          ),
        },
        {
          id: 'contenus',
          title: '6. Vos contenus',
          body: (
            <>
              <P>
                Vous restez propriétaire des contenus que vous ajoutez (photos, notes, informations sur vos animaux).
                Vous nous autorisez à les héberger et à les afficher uniquement pour vous fournir le service et, si
                vous activez le partage public, à les afficher aux personnes disposant du lien, pendant la durée du
                partage.
              </P>
              <P>
                Vous garantissez disposer des droits sur les photos que vous importez et vous vous interdisez de
                publier des contenus illicites, injurieux, portant atteinte aux droits de tiers ou contenant des
                données personnelles de tiers sans leur accord.
              </P>
            </>
          ),
        },
        {
          id: 'partage',
          title: '7. Partage public',
          body: (
            <P>
              Le partage public d&apos;un animal est désactivé par défaut. Lorsque vous l&apos;activez, toute
              personne disposant du lien ou du QR code peut consulter les informations rendues publiques. Vous pouvez
              désactiver le partage à tout moment ; le lien cesse alors de fonctionner.
            </P>
          ),
        },
        {
          id: 'affiliation',
          title: '8. Liens d’affiliation et sites tiers',
          body: (
            <P>
              Si des liens partenaires vers des sites marchands sont proposés, ils sont signalés comme tels et
              peuvent rapporter une commission à {LEGAL.serviceName} ; le prix payé reste identique pour vous. Les achats sont conclus directement avec
              le marchand, selon ses propres conditions ; {LEGAL.serviceName} n&apos;est pas partie à cette vente.
              Voir la page {L(LEGAL_ROUTES.transparency, 'Transparence et affiliation')}.
            </P>
          ),
        },
        {
          id: 'sources',
          title: '9. Données issues de sources ouvertes',
          body: (
            <P>
              Une partie des contenus provient de bases ouvertes (voir{' '}
              {L(LEGAL_ROUTES.sources, 'Sources et licences')}). Malgré notre attention, ces données peuvent
              comporter des erreurs ou des lacunes ; signalez-nous toute inexactitude.
            </P>
          ),
        },
        {
          id: 'disponibilite',
          title: '10. Disponibilité',
          body: (
            <P>
              Nous nous efforçons d&apos;assurer l&apos;accès au service, sans garantie de disponibilité
              permanente. Le service peut être interrompu pour maintenance, mise à jour ou en cas de défaillance de
              nos prestataires. Nous vous recommandons d&apos;exporter régulièrement vos données.
            </P>
          ),
        },
        {
          id: 'responsabilite',
          title: '11. Responsabilité',
          body: (
            <P>
              {LEGAL.serviceName} ne saurait être tenu responsable des décisions prises sur la seule base des
              informations du service, ni des dommages résultant d&apos;une utilisation non conforme aux présentes
              CGU. Ces limites ne s&apos;appliquent pas lorsque la loi l&apos;interdit, notamment en cas de faute
              lourde ou de dommage corporel, et ne privent pas les consommateurs des droits que leur accorde la loi.
            </P>
          ),
        },
        {
          id: 'suspension',
          title: '12. Suspension et résiliation',
          body: (
            <P>
              En cas de manquement grave aux présentes CGU, nous pouvons suspendre ou supprimer un compte, après
              notification motivée sauf urgence (contenu illicite, atteinte à la sécurité). Vous pouvez mettre fin à
              votre utilisation à tout moment en supprimant votre compte.
            </P>
          ),
        },
        {
          id: 'payant',
          title: '13. Offres payantes',
          body: (
            <P>
              Le service ne propose actuellement aucune offre payante. Si un abonnement est proposé, son prix, sa
              durée, ses modalités de renouvellement et de résiliation ainsi que votre droit de rétractation vous
              seront présentés dans des conditions générales de vente avant tout paiement.
            </P>
          ),
        },
        {
          id: 'modification',
          title: '14. Modification des CGU',
          body: (
            <P>
              Nous pouvons modifier les présentes CGU. En cas de modification substantielle, vous en serez informé
              dans le service ou par e-mail avant son entrée en vigueur ; si vous la refusez, vous pouvez supprimer
              votre compte.
            </P>
          ),
        },
        {
          id: 'droit',
          title: '15. Droit applicable et litiges',
          body: (
            <P>
              Les présentes CGU sont soumises au droit français. En cas de litige, nous vous invitons à nous
              contacter d&apos;abord à {contact} afin de rechercher une solution amiable. À défaut, le litige sera
              porté devant les juridictions compétentes ; si vous êtes consommateur, vous pouvez saisir notamment la
              juridiction du lieu de votre domicile.
            </P>
          ),
        },
      ],
    },

    sources: {
      title: 'Sources et licences',
      description:
        'Sources de données ouvertes utilisées par Captivia (Wikipédia, Wikidata, GBIF, Open Pet Food Facts, Species+/CITES, PubMed…), licences et attributions.',
      sections: [
        {
          id: 'principe',
          title: 'Principe',
          body: (
            <P>
              {LEGAL.serviceName} assemble des informations issues de bases de données ouvertes. Nous remercions
              leurs contributeurs. Chaque source conserve sa licence ; lorsque vous réutilisez ces contenus, vous
              devez respecter la licence d&apos;origine indiquée ci-dessous.
            </P>
          ),
        },
        {
          id: 'wikipedia',
          title: 'Wikipédia',
          body: (
            <P>
              Les extraits d&apos;articles de Wikipédia sont diffusés sous licence{' '}
              <A href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr">
                Creative Commons Attribution – Partage dans les mêmes conditions 4.0 (CC BY-SA 4.0)
              </A>
              . Auteurs : les contributeurs de Wikipédia, dont l&apos;historique est consultable sur chaque article
              d&apos;origine. Les extraits peuvent être raccourcis ou mis en forme ; ces adaptations sont diffusées
              sous la même licence.
            </P>
          ),
        },
        {
          id: 'wikidata',
          title: 'Wikidata',
          body: (
            <P>
              Les données structurées de Wikidata sont placées dans le domaine public (
              <A href="https://creativecommons.org/publicdomain/zero/1.0/deed.fr">CC0 1.0</A>).
            </P>
          ),
        },
        {
          id: 'gbif',
          title: 'GBIF',
          body: (
            <>
              <P>
                Les données taxonomiques et d&apos;occurrence proviennent du Global Biodiversity Information Facility
                (<A href="https://www.gbif.org">www.gbif.org</A>). Citation : « GBIF.org (2026), GBIF Home Page.
                Disponible sur https://www.gbif.org ».
              </P>
              <P>
                Chaque jeu de données publié sur GBIF a sa propre licence (CC0 1.0, CC BY 4.0 ou CC BY-NC 4.0) et sa
                propre citation, indiquées sur sa page GBIF. Les statuts de conservation proviennent de la Liste
                rouge de l&apos;UICN (© UICN), soumise aux conditions d&apos;utilisation de l&apos;UICN.
              </P>
            </>
          ),
        },
        {
          id: 'opff',
          title: 'Open Pet Food Facts',
          body: (
            <P>
              Les informations sur les aliments proviennent d&apos;
              <A href="https://world.openpetfoodfacts.org">Open Pet Food Facts</A>. La base de données est
              disponible sous{' '}
              <A href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License (ODbL) 1.0</A>, son
              contenu individuel sous Database Contents License (DbCL) 1.0, et les photos de produits sous licence
              Creative Commons Attribution – Partage dans les mêmes conditions (CC BY-SA).
            </P>
          ),
        },
        {
          id: 'species-plus',
          title: 'Species+ / CITES',
          body: (
            <P>
              Les informations sur le statut CITES proviennent de{' '}
              <A href="https://speciesplus.net">Species+</A> : UNEP-WCMC, The Species+ Website, Nairobi (Kenya),
              compilé par UNEP-WCMC, Cambridge (Royaume-Uni). Elles sont indicatives : seuls les textes officiels
              de la CITES et de l&apos;Union européenne font foi.
            </P>
          ),
        },
        {
          id: 'pubmed',
          title: 'PubMed',
          body: (
            <P>
              Les références scientifiques (titres, auteurs, revues) proviennent de{' '}
              <A href="https://pubmed.ncbi.nlm.nih.gov">PubMed</A>, service de la National Library of Medicine
              (NLM) des États-Unis. La NLM ne cautionne pas {LEGAL.serviceName}. Les articles eux-mêmes restent
              soumis aux droits de leurs auteurs et éditeurs : nous n&apos;affichons que des références et des
              liens.
            </P>
          ),
        },
        {
          id: 'autres',
          title: 'Autres sources',
          body: (
            <UL>
              <li>
                <A href="https://www.inaturalist.org">iNaturalist</A> : observations et photos sous la licence
                choisie par chaque observateur (CC0, CC BY, CC BY-NC…), avec attribution à son auteur.
              </li>
              <li>
                <A href="https://eol.org">Encyclopedia of Life</A> : licence propre à chaque contenu, indiquée par
                EOL.
              </li>
            </UL>
          ),
        },
        {
          id: 'photographies',
          title: 'Photographies',
          body: (
            <>
              <P>
                Les photographies d&apos;animaux et de nature du site proviennent de{' '}
                <A href="https://commons.wikimedia.org">Wikimedia Commons</A>. Leur licence a été vérifiée sur la
                page de chaque fichier ; aucune n&apos;est générée par une intelligence artificielle. Chaque photo
                est créditée là où elle s&apos;affiche ; les adaptations des photos sous licence CC BY-SA sont
                diffusées sous la même licence.
              </P>
              <PhotoCreditsTable lang="fr" />
            </>
          ),
        },
        {
          id: 'logiciels',
          title: 'Polices et icônes',
          body: (
            <UL>
              <li>Polices Fraunces, IBM Plex Sans et IBM Plex Mono : SIL Open Font License 1.1.</li>
              <li>Icônes Lucide : licence ISC.</li>
            </UL>
          ),
        },
        {
          id: 'signaler',
          title: 'Signaler un problème',
          body: (
            <P>
              Si vous constatez une attribution manquante ou incorrecte, écrivez-nous à {contact} : nous la
              corrigerons rapidement.
            </P>
          ),
        },
      ],
    },
  };
}
