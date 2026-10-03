import type { ReactNode } from 'react';
import { HOSTS, LEGAL, LEGAL_ROUTES } from '@/lib/legal';
import { A, Field, ILink, P, Table, UL, type LegalContent } from './ui';
import { PhotoCreditsTable } from './photos';

const EU_REGION = 'Frankfurt (Germany, European Union)';

/**
 * Legal documents — English version (also served to es/de/it/pt until translated).
 * The French version prevails in case of discrepancy.
 * Publisher details come from `@/lib/legal`. To be reviewed by a legal professional.
 */
export function buildEnContent(locale: string): LegalContent {
  const L = (href: string, children: ReactNode) => (
    <ILink locale={locale} href={href}>
      {children}
    </ILink>
  );
  const contact = <Field value={LEGAL.contactEmail} />;

  return {
    legalNotice: {
      title: 'Legal notice',
      description:
        'Publisher identity, publication director and hosting providers of the Captivia service (French law on confidence in the digital economy, art. 6 III).',
      sections: [
        {
          id: 'publisher',
          title: 'Publisher',
          body: (
            <>
              <P>The {LEGAL.serviceName} service (website and application) is published by:</P>
              <UL>
                <li>
                  Company name: <Field value={LEGAL.companyName} />
                </li>
                <li>
                  Legal form and share capital: <Field value={LEGAL.legalForm} />
                </li>
                <li>
                  Registration number (SIREN): <Field value={LEGAL.siren} />
                </li>
                <li>
                  EU VAT number: <Field value={LEGAL.vatNumber} />
                </li>
                <li>
                  Address: <Field value={LEGAL.address} />
                </li>
                <li>
                  Phone: <Field value={LEGAL.phone} />
                </li>
                <li>Email: {contact}</li>
              </UL>
            </>
          ),
        },
        {
          id: 'publication-director',
          title: 'Publication director',
          body: (
            <P>
              <Field value={LEGAL.publicationDirector} />
            </P>
          ),
        },
        {
          id: 'hosting',
          title: 'Hosting',
          body: (
            <UL>
              <li>
                Web interface: {HOSTS.frontend.name}, {HOSTS.frontend.address} —{' '}
                <A href={HOSTS.frontend.website}>{HOSTS.frontend.website}</A>
              </li>
              <li>
                Application server (API): {HOSTS.api.name}, {HOSTS.api.address} — servers located in {EU_REGION} —{' '}
                <A href={HOSTS.api.website}>{HOSTS.api.website}</A>
              </li>
              <li>
                Database: {HOSTS.database.name} — servers located in {EU_REGION} —{' '}
                <A href={HOSTS.database.website}>{HOSTS.database.website}</A>
              </li>
            </UL>
          ),
        },
        {
          id: 'intellectual-property',
          title: 'Intellectual property',
          body: (
            <>
              <P>
                The structure of the service, its code, visual identity, original texts and the {LEGAL.serviceName}{' '}
                name are protected by intellectual property law. Any unauthorised reproduction or representation is
                prohibited.
              </P>
              <P>
                Content from open sources (Wikipedia, Wikidata, GBIF, Open Pet Food Facts, etc.) remains subject to
                its own licences, listed on the {L(LEGAL_ROUTES.sources, 'Sources and licences')} page.
              </P>
            </>
          ),
        },
        {
          id: 'affiliation',
          title: 'Affiliate links',
          body: (
            <P>
              As an Amazon Associate, {LEGAL.serviceName} earns from qualifying purchases. Affiliate links are
              labelled as such; see the {L(LEGAL_ROUTES.transparency, 'Transparency and affiliation')} page.
            </P>
          ),
        },
        {
          id: 'report',
          title: 'Contact and reporting illegal content',
          body: (
            <P>
              For any question or to report manifestly illegal content, write to {contact}, stating the address of
              the page concerned and the nature of the content.
            </P>
          ),
        },
        {
          id: 'personal-data',
          title: 'Personal data',
          body: (
            <P>
              The processing of your personal data is described in the {L(LEGAL_ROUTES.privacy, 'privacy policy')}.
              Use of the service is governed by the {L(LEGAL_ROUTES.terms, 'terms of use')}.
            </P>
          ),
        },
      ],
    },

    privacy: {
      title: 'Privacy policy',
      description:
        'Data processed by Captivia, purposes, legal bases, processors, retention periods, trackers and how to exercise your rights (GDPR).',
      sections: [
        {
          id: 'controller',
          title: '1. Data controller',
          body: (
            <P>
              The data controller is <Field value={LEGAL.companyName} />, <Field value={LEGAL.address} />. For any
              question about your data or to exercise your rights: {contact}.
            </P>
          ),
        },
        {
          id: 'data',
          title: '2. Data we process',
          body: (
            <>
              <P>We only collect the data needed to run the service:</P>
              <UL>
                <li>
                  <strong>Account</strong>: email address, a hash of your password — never the password itself —,
                  display language, creation and update dates, subscription flag.
                </li>
                <li>
                  <strong>Progress</strong>: points and grade earned in the service.
                </li>
                <li>
                  <strong>Animals</strong> you record: name, species, date of birth, sex, photos (an image you upload
                  or a web address you enter), notes, group or enclosure, parentage (father, mother), care routines
                  and log of completed actions.
                </li>
                <li>
                  <strong>Your animals&apos; health tracking</strong>: health record, medications (name, dose,
                  frequency), vaccinations (name, date, booster, batch number, vet), vet appointments (vet, date,
                  place, reason), measurements (weight, height) and breeding (events, partner, number of young).
                </li>
                <li>
                  <strong>Notifications</strong>: your preferences, the history of generated reminders and, if you
                  enable push notifications, the technical subscription provided by your browser (push service
                  address and encryption keys).
                </li>
                <li>
                  <strong>Password reset</strong>: a single-use token, valid for one hour.
                </li>
                <li>
                  <strong>Technical and security data</strong>: IP address and request information, used to prevent
                  abuse (rate limiting) and present in the hosting providers&apos; technical logs; technical error
                  reports if error tracking is enabled.
                </li>
              </UL>
              <P>
                Information about your animals is not health data within the meaning of the GDPR. Please avoid
                entering sensitive information about yourself or other people in free-text fields (notes, reasons).
              </P>
            </>
          ),
        },
        {
          id: 'purposes',
          title: '3. Purposes and legal bases',
          body: (
            <Table
              head={['Purpose', 'Legal basis (GDPR, art. 6)']}
              rows={[
                [
                  'Create and manage your account; record and display your animals, health record, routines and reminders',
                  'Performance of the contract (terms of use) — art. 6(1)(b)',
                ],
                [
                  'Send emails required by the service (password reset, account information)',
                  'Performance of the contract — art. 6(1)(b)',
                ],
                ['Send push notifications', 'Consent, given through the browser permission and revocable at any time — art. 6(1)(a)'],
                [
                  'Make an animal’s profile public (sharing by link or QR code)',
                  'Consent: sharing is off by default, enabled and revocable by you — art. 6(1)(a)',
                ],
                [
                  'Secure the service, prevent abuse, diagnose errors',
                  'Legitimate interest in keeping the service secure and working — art. 6(1)(f)',
                ],
                ['Respond to requests from authorities and meet our obligations', 'Legal obligation — art. 6(1)(c)'],
              ]}
            />
          ),
        },
        {
          id: 'recipients',
          title: '4. Recipients and processors',
          body: (
            <>
              <P>
                Your data is never sold, rented or used for advertising. It is accessible to the publisher and to the
                following technical processors, strictly for their task:
              </P>
              <Table
                head={['Provider', 'Role', 'Data location']}
                rows={[
                  [HOSTS.frontend.name, 'Web interface hosting', 'Global content delivery network (CDN); US company'],
                  [HOSTS.api.name, 'API hosting', `${EU_REGION}; US company`],
                  [HOSTS.database.name, 'PostgreSQL database', `${EU_REGION}; US company`],
                  ['Functional Software, Inc. (Sentry)', 'Technical error tracking, only if enabled', 'Depends on the Sentry account region; US company'],
                  [<Field key="mail" value={LEGAL.emailProvider} />, 'Transactional email delivery', <Field key="mail-loc" value={LEGAL.emailProvider} />],
                  ['Your browser’s push service (Google, Mozilla, Apple…)', 'Delivery of push notifications, if you enable them', 'Depends on the browser vendor'],
                ]}
              />
              <P>
                Where data may be accessed from a country outside the European Union, the transfer is covered by the
                European Commission&apos;s standard contractual clauses and, where applicable, by the EU–US Data
                Privacy Framework when the provider is certified under it.
              </P>
            </>
          ),
        },
        {
          id: 'external-sources',
          title: '5. External data sources',
          body: (
            <>
              <P>
                Species profiles rely on open services (GBIF, Wikipedia, Wikidata, Species+/CITES, PubMed, Open Pet
                Food Facts, iNaturalist, Encyclopedia of Life). Our server queries them with species names or
                identifiers only: no personal data is sent to them.
              </P>
              <P>
                Some images (for example Open Pet Food Facts product photos) are loaded directly from their source&apos;s
                servers: as with any web resource, your browser then sends them your IP address.
              </P>
              <P>
                When you follow an affiliate link, you leave {LEGAL.serviceName}: the merchant&apos;s website (for
                example Amazon) applies its own privacy and cookie policy. We do not send it any data about you; the
                link only contains our partner identifier.
              </P>
            </>
          ),
        },
        {
          id: 'retention',
          title: '6. Retention periods',
          body: (
            <UL>
              <li>
                Account, animals and related data: for as long as your account exists. They are erased when the account
                is deleted; automatic database backups are overwritten according to their retention cycle (30 days at
                most).
              </li>
              <li>
                Use without an account (guest): your animal and its health record are kept until you create an
                account, delete them, or after 90 days without using the app; they are then erased.
              </li>
              <li>
                Reminder history (generated reminders, done or not done): 90 days after the reminder&apos;s scheduled
                date, then erased automatically.
              </li>
              <li>
                Password reset tokens (valid for one hour) and email verification tokens (valid for 24 hours): erased
                automatically once expired (daily purge).
              </li>
              <li>
                Login tokens: access token valid for 30 minutes and renewal token valid for 30 days (90 days in guest
                mode), renewed on each use and erased from your device on logout. Our servers only keep a fingerprint
                of it, erased 30 days after it expires or is revoked.
              </li>
              <li>Technical and security logs (including IP address): 12 months at most.</li>
              <li>Error reports (if tracking is enabled): 90 days at most.</li>
            </UL>
          ),
        },
        {
          id: 'trackers',
          title: '7. Cookies and local storage',
          body: (
            <>
              <P>
                {LEGAL.serviceName} uses no advertising cookies, no third-party audience measurement and no social
                media buttons. Only trackers strictly necessary for the service are used; they are exempt from consent
                (article 82 of the French Data Protection Act):
              </P>
              <UL>
                <li>
                  <strong>Browser local storage (localStorage)</strong> — <code>token</code>: login token that keeps
                  you signed in; <code>user</code>: a copy of your profile (identifier, email, language, points, grade,
                  subscription flag) for display. Both are erased when you log out.
                </li>
                <li>
                  <strong>
                    Session cookie <code>NEXT_LOCALE</code>
                  </strong>
                  : remembers the language you chose when it differs from your browser&apos;s; it disappears when you
                  close the browser.
                </li>
              </UL>
            </>
          ),
        },
        {
          id: 'security',
          title: '8. Security',
          body: (
            <P>
              Traffic is encrypted (HTTPS), passwords are stored hashed, access to your data is restricted to your
              account and request rates are limited to prevent abuse. As no measure is absolutely secure, we will
              notify you and the French data protection authority (CNIL) of any data breach as required by the GDPR.
            </P>
          ),
        },
        {
          id: 'rights',
          title: '9. Your rights',
          body: (
            <>
              <P>
                You have the rights of access, rectification, erasure, restriction, objection and portability, the
                right to withdraw your consent at any time and the right to set instructions regarding your data after
                your death.
              </P>
              <UL>
                <li>
                  <strong>Free export</strong> of your data in a machine-readable format (JSON):{' '}
                  {L(LEGAL_ROUTES.accountSettings, 'Settings > Account')}.
                </li>
                <li>
                  <strong>Deletion of your account</strong> and all related data:{' '}
                  {L(LEGAL_ROUTES.accountSettings, 'Settings > Account')} (see also{' '}
                  {L(LEGAL_ROUTES.accountDeletion, 'Delete my account')}).
                </li>
                <li>Rectification: directly in the service (profile, your animals&apos; records).</li>
                <li>Any other request: {contact}.</li>
              </UL>
              <P>
                These requests are free of charge. We reply within one month, which may be extended by two months for
                complex requests; if we have reasonable doubts about your identity, we may ask for proof.
              </P>
              <P>
                If you believe your rights are not being respected, you may lodge a complaint with the French data
                protection authority (CNIL), 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, France —{' '}
                <A href="https://www.cnil.fr/fr/plaintes">www.cnil.fr/fr/plaintes</A> — or with the supervisory
                authority of your country of residence.
              </P>
            </>
          ),
        },
        {
          id: 'minimum-age',
          title: '10. Minimum age',
          body: (
            <P>
              You must be at least {LEGAL.minimumAge} years old to create an account, the age of digital consent in
              France (article 45 of the French Data Protection Act).
            </P>
          ),
        },
        {
          id: 'changes',
          title: '11. Changes',
          body: (
            <P>
              This policy may change, in particular when features are added (for example a paid subscription). The
              last update date is shown at the top of the page; in case of a significant change, you will be informed
              in the service or by email.
            </P>
          ),
        },
      ],
    },

    terms: {
      title: 'Terms of use',
      description:
        'Rules for accessing and using the Captivia service: account, minimum age, content, public sharing, limits of the information provided and liability.',
      sections: [
        {
          id: 'purpose',
          title: '1. Purpose',
          body: (
            <P>
              These terms of use govern the use of the {LEGAL.serviceName} service, published by{' '}
              <Field value={LEGAL.companyName} /> (see the {L(LEGAL_ROUTES.legalNotice, 'legal notice')}). Creating an
              account implies acceptance of these terms; simply browsing the site requires compliance with them.
            </P>
          ),
        },
        {
          id: 'service',
          title: '2. The service',
          body: (
            <UL>
              <li>Free access to species profiles (taxonomy, care, feeding, equipment, regulations).</li>
              <li>With an account: record your animals, health record, routines, reminders and notifications.</li>
              <li>A shop listing links to partner merchant websites (affiliate links).</li>
              <li>Optional public sharing of an animal&apos;s profile.</li>
            </UL>
          ),
        },
        {
          id: 'account',
          title: '3. Account and minimum age',
          body: (
            <>
              <P>
                You must be at least {LEGAL.minimumAge} years old to create an account. You agree to provide a valid
                email address, keep your password confidential and tell us about any unauthorised use of your account.
              </P>
              <P>
                You can delete your account at any time, free of charge, from{' '}
                {L(LEGAL_ROUTES.accountSettings, 'Settings > Account')}.
              </P>
            </>
          ),
        },
        {
          id: 'vet',
          title: '4. Health information: no substitute for a veterinarian',
          body: (
            <P>
              The information provided (care, feeding, health, medication, reminders) is general and indicative. It is
              not a diagnosis, a prescription or veterinary advice, and does not replace a consultation with a
              veterinarian. If in doubt, if your animal shows symptoms or in an emergency, contact a veterinarian
              without delay. Reminders are an aid: they do not guarantee that care will be given on time.
            </P>
          ),
        },
        {
          id: 'regulations',
          title: '5. Regulations on keeping animals',
          body: (
            <P>
              Regulatory information (CITES status, protection, permits) is provided for guidance only and may be
              incomplete or out of date. It is your responsibility to check the applicable rules with the competent
              authorities before acquiring or keeping an animal — in France, in particular, the order of 8 October 2018
              on keeping non-domestic species.
            </P>
          ),
        },
        {
          id: 'content',
          title: '6. Your content',
          body: (
            <>
              <P>
                You remain the owner of the content you add (photos, notes, information about your animals). You allow
                us to host and display it only to provide the service and, if you enable public sharing, to display it
                to people who have the link, for as long as sharing is active.
              </P>
              <P>
                You warrant that you hold the rights to the photos you upload and you must not publish content that is
                illegal, abusive, infringes third-party rights or contains other people&apos;s personal data without
                their consent.
              </P>
            </>
          ),
        },
        {
          id: 'sharing',
          title: '7. Public sharing',
          body: (
            <P>
              Public sharing of an animal is off by default. When you enable it, anyone with the link or QR code can
              view the information made public. You can disable sharing at any time; the link then stops working.
            </P>
          ),
        },
        {
          id: 'affiliate',
          title: '8. Affiliate links and third-party sites',
          body: (
            <P>
              As an Amazon Associate, {LEGAL.serviceName} earns from qualifying purchases. The price you pay is the
              same. Purchases are made directly with the merchant, under its own terms; {LEGAL.serviceName} is not a
              party to the sale. See the {L(LEGAL_ROUTES.transparency, 'Transparency and affiliation')} page.
            </P>
          ),
        },
        {
          id: 'open-data',
          title: '9. Open data',
          body: (
            <P>
              Part of the content comes from open databases (see {L(LEGAL_ROUTES.sources, 'Sources and licences')}).
              Despite our care, this data may contain errors or gaps; please report any inaccuracy to us.
            </P>
          ),
        },
        {
          id: 'availability',
          title: '10. Availability',
          body: (
            <P>
              We strive to keep the service available, without guaranteeing permanent availability. The service may be
              interrupted for maintenance, updates or failures of our providers. We recommend that you export your data
              regularly.
            </P>
          ),
        },
        {
          id: 'liability',
          title: '11. Liability',
          body: (
            <P>
              {LEGAL.serviceName} cannot be held liable for decisions made solely on the basis of information from the
              service, or for damage resulting from use that does not comply with these terms. These limits do not
              apply where the law prohibits them, in particular in case of gross negligence or personal injury, and do
              not deprive consumers of their statutory rights.
            </P>
          ),
        },
        {
          id: 'suspension',
          title: '12. Suspension and termination',
          body: (
            <P>
              In the event of a serious breach of these terms, we may suspend or delete an account, after a reasoned
              notice except in urgent cases (illegal content, security threat). You may stop using the service at any
              time by deleting your account.
            </P>
          ),
        },
        {
          id: 'paid',
          title: '13. Paid offers',
          body: (
            <P>
              The service currently offers no paid plan. If a subscription is offered, its price, duration, renewal and
              cancellation terms and your right of withdrawal will be presented in terms of sale before any payment.
            </P>
          ),
        },
        {
          id: 'changes',
          title: '14. Changes to these terms',
          body: (
            <P>
              We may change these terms. In case of a substantial change, you will be informed in the service or by
              email before it takes effect; if you do not accept it, you may delete your account.
            </P>
          ),
        },
        {
          id: 'law',
          title: '15. Governing law and disputes',
          body: (
            <P>
              These terms are governed by French law. In case of dispute, please first contact us at {contact} to seek
              an amicable solution. Failing that, the dispute will be brought before the competent courts; consumers may
              in particular refer the matter to the court of their place of residence.
            </P>
          ),
        },
      ],
    },

    sources: {
      title: 'Sources and licences',
      description:
        'Open data sources used by Captivia (Wikipedia, Wikidata, GBIF, Open Pet Food Facts, Species+/CITES, PubMed…), licences and attributions.',
      sections: [
        {
          id: 'principle',
          title: 'Principle',
          body: (
            <P>
              {LEGAL.serviceName} brings together information from open databases. We thank their contributors. Each
              source keeps its own licence; if you reuse this content, you must comply with the original licence listed
              below.
            </P>
          ),
        },
        {
          id: 'wikipedia',
          title: 'Wikipedia',
          body: (
            <P>
              Excerpts from Wikipedia articles are distributed under the{' '}
              <A href="https://creativecommons.org/licenses/by-sa/4.0/">
                Creative Commons Attribution-ShareAlike 4.0 licence (CC BY-SA 4.0)
              </A>
              . Authors: Wikipedia contributors, whose history can be viewed on each original article. Excerpts may be
              shortened or reformatted; such adaptations are distributed under the same licence.
            </P>
          ),
        },
        {
          id: 'wikidata',
          title: 'Wikidata',
          body: (
            <P>
              Structured data from Wikidata is dedicated to the public domain (
              <A href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0</A>).
            </P>
          ),
        },
        {
          id: 'gbif',
          title: 'GBIF',
          body: (
            <>
              <P>
                Taxonomic and occurrence data comes from the Global Biodiversity Information Facility (
                <A href="https://www.gbif.org">www.gbif.org</A>). Citation: “GBIF.org (2026), GBIF Home Page. Available
                from: https://www.gbif.org”.
              </P>
              <P>
                Each dataset published on GBIF has its own licence (CC0 1.0, CC BY 4.0 or CC BY-NC 4.0) and citation,
                shown on its GBIF page. Conservation statuses come from the IUCN Red List (© IUCN), subject to the
                IUCN terms of use.
              </P>
            </>
          ),
        },
        {
          id: 'opff',
          title: 'Open Pet Food Facts',
          body: (
            <P>
              Food information comes from <A href="https://world.openpetfoodfacts.org">Open Pet Food Facts</A>. The
              database is available under the{' '}
              <A href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License (ODbL) 1.0</A>, its
              individual contents under the Database Contents License (DbCL) 1.0, and product photos under a Creative
              Commons Attribution-ShareAlike (CC BY-SA) licence.
            </P>
          ),
        },
        {
          id: 'species-plus',
          title: 'Species+ / CITES',
          body: (
            <P>
              CITES status information comes from <A href="https://speciesplus.net">Species+</A>: UNEP-WCMC, The
              Species+ Website, Nairobi, Kenya, compiled by UNEP-WCMC, Cambridge, UK. It is provided for guidance only:
              only the official CITES and European Union texts are authoritative.
            </P>
          ),
        },
        {
          id: 'pubmed',
          title: 'PubMed',
          body: (
            <P>
              Scientific references (titles, authors, journals) come from{' '}
              <A href="https://pubmed.ncbi.nlm.nih.gov">PubMed</A>, a service of the US National Library of Medicine
              (NLM). The NLM does not endorse {LEGAL.serviceName}. The articles themselves remain subject to the rights
              of their authors and publishers: we only display references and links.
            </P>
          ),
        },
        {
          id: 'others',
          title: 'Other sources',
          body: (
            <UL>
              <li>
                <A href="https://www.inaturalist.org">iNaturalist</A>: observations and photos under the licence chosen
                by each observer (CC0, CC BY, CC BY-NC…), with attribution to their author.
              </li>
              <li>
                <A href="https://eol.org">Encyclopedia of Life</A>: licence specific to each item, as stated by EOL.
              </li>
            </UL>
          ),
        },
        {
          id: 'photographs',
          title: 'Photographs',
          body: (
            <>
              <P>
                The animal and nature photographs on this site come from{' '}
                <A href="https://commons.wikimedia.org">Wikimedia Commons</A>. Each licence was checked on the file&apos;s
                own page; none is AI-generated. Every photo is credited where it appears; adaptations of CC BY-SA photos
                are shared under the same licence.
              </P>
              <PhotoCreditsTable lang="en" />
            </>
          ),
        },
        {
          id: 'software',
          title: 'Fonts and icons',
          body: (
            <UL>
              <li>Fraunces, IBM Plex Sans and IBM Plex Mono fonts: SIL Open Font License 1.1.</li>
              <li>Lucide icons: ISC licence.</li>
            </UL>
          ),
        },
        {
          id: 'report',
          title: 'Report a problem',
          body: (
            <P>
              If you notice a missing or incorrect attribution, write to us at {contact} and we will correct it
              promptly.
            </P>
          ),
        },
      ],
    },
  };
}
