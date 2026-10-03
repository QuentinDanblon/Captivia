# Store listing — English (App Store and Google Play)

> Copy and paste into App Store Connect (*App Information*, *Version*) and the Play Console (*Store presence → Main store listing*).
> Each field is a `text` block preceded by its key (checked by `npm run store:check`: lengths and writing rules).
> Sources: `docs/MESSAGING.md` §§ 8–9 and the writing rule in `docs/PRODUCT.md`. No price is written here: prices are entered in the consoles (`docs/PAYMENTS.md`).
> URLs use the current domain; replace them with the final domain (D-03) before submitting.

## Common fields

### `title` — Name (30 max, App Store and Google Play)

```text
Captivia: Pet Health Log
```

### `subtitle` — Subtitle (30 max, App Store)

```text
Vaccines, care and reminders
```

### `short` — Short description (80 max, Google Play)

```text
Your pets' health record, with reminders right when they're due.
```

### `promo` — Promotional text (170 max, App Store, editable without a new version)

```text
Vaccines, dewormers, weigh-ins, vet visits: log them once and Captivia reminds you when they're due. No account needed to start.
```

### `keywords` — Keywords (100 max, App Store; comma-separated, no spaces)

Words already in the name and subtitle (pet, health, log, vaccines, care, reminders) are indexed by the App Store, so they are not repeated.

```text
cat,dog,rabbit,reptile,vet,deworming,weight,planner,appointment,medication,species,gecko,bird
```

### `description` — Full description (4,000 max, App Store and Google Play)

```text
You love them. Captivia remembers the rest.

Vaccines, dewormers, weigh-ins, vet visits: log them once and Captivia reminds you when they're due. For a cat, a dog, a rabbit... or a leopard gecko.

EVERYTHING YOUR VET WILL ASK FOR, ALREADY WRITTEN DOWN
• One health record per pet: vaccines with their next due date, treatments, visit notes, photos.
• A weight curve drawn at every weigh-in.
• A record you can print or share before the appointment, so you arrive with the full history.

THE RIGHT REMINDER, RIGHT ON TIME
• Today's care, treatments, vaccine boosters and appointments to book: Captivia notifies you on your phone, even without a connection.
• A care calendar showing the status of each item: done, to do, overdue.
• With an account, your care schedule can also show up in your phone's calendar.

SOURCED ANSWERS, NOT HEARSAY
• One page per species: diet, habitat, behavior, health, regulations.
• Every piece of information points to its source: Wikipedia, GBIF, the IUCN Red List, CITES.
• Captivia helps you not forget anything and tells you what should lead you to see a vet. The diagnosis stays with your vet.

COMING SOON: FELLOW PET PEOPLE
A community to show your pets and ask questions is on its way. Your pet's health record stays private: nothing is published unless you choose to.

FREE FOR ONE PET
• No account needed to start: add your pet and try it for yourself.
• A free account backs up your data and brings it to another device. Your pet and its record follow you, nothing to enter again.
• Premium is for following several pets, each with its own record. It is a monthly or yearly subscription bought in the app, with the price shown before any purchase. It renews automatically until you cancel, which you can do at any time in your App Store or Google Play account settings.

YOUR DATA STAYS YOURS
• Hosted in Frankfurt, Germany.
• Nothing sold or rented, no advertising.
• Delete your account and your data at any time, from within the app.

Available in French, English, Spanish, German, Italian and Portuguese.

Terms of use: https://captivia-app.netlify.app/en/cgu
Privacy policy: https://captivia-app.netlify.app/en/confidentialite
```

### `whatsnew` — Release notes 1.0 (4,000 max on the App Store; 500 max on Google Play)

```text
First release of Captivia.

• Log vaccines, treatments, weigh-ins and appointments in each pet's health record.
• Get your reminders on your phone, even without a connection.
• Browse species pages, with their sources.
• Start without an account, for one pet.
```

## Links

| Field | Value |
| --- | --- |
| Support URL (App Store) / Website (Play) | `https://captivia-app.netlify.app/en/mentions-legales` (publisher contact details, including the email; a dedicated support page is worth considering, see README) |
| Marketing URL (App Store, optional) | `https://captivia-app.netlify.app/en` |
| Privacy policy URL | `https://captivia-app.netlify.app/en/confidentialite` |
| Terms of use (custom EULA, App Store) | `https://captivia-app.netlify.app/en/cgu` |
| Account deletion (Play "Delete account" field) | `https://captivia-app.netlify.app/en/suppression-compte` |
| Contact email (Play, required) | `[TO COMPLETE: contact address, D-01 — same as LEGAL.contactEmail in src/lib/legal.ts]` |
| Copyright (App Store) | `© 2026 [TO COMPLETE: company name, D-01]` |

## Category, price and rating

| Item | Value |
| --- | --- |
| App Store — primary category | **Lifestyle** |
| App Store — secondary category | **Reference** (sourced species pages) |
| Google Play — type and category | App · **Lifestyle**; then pick the console's tags that relate to pets (the list changes: do not invent any) |
| Why not "Health & Fitness" | That category is about people's health (App Store guideline 1.4, Google Play Health policy); Captivia tracks animals' care and makes no diagnosis or measurement about the user. |
| Price | Free, with in-app purchases (Premium subscription, prices entered in the consoles) |
| Age rating | See `docs/store/classification-age.md` (expected at launch: **4+** App Store, **PEGI 3 / Everyone**) |
| Privacy declarations | See `docs/store/declarations-confidentialite.md` |

## Screenshots and graphics

- iPhone 6.9": 1320 × 2868; iPhone 6.5": 1284 × 2778; Play phone: 1080 × 1920.
- Produced by `npm run screenshots:store` (see `docs/store/README.md`).
- 1024 × 1024 icon (App Store): `frontend/mobile/assets/icon-only.png`; 512 × 512 Play icon: `frontend/mobile/assets/store/play-icon-512.png`. Provisional logo (D-15).
- Play feature graphic (1024 × 500): **to be made with the final logo** (D-15), not generated here.
