# Changelog

## [0.1.0](https://github.com/QuentinDanblon/Captivia/compare/backend-v0.0.1...backend-v0.1.0) (2026-10-03)


### Features

* **api-externes:** client HTTP unique, retry GBIF, disjoncteurs et replis (W1-04) ([7995861](https://github.com/QuentinDanblon/Captivia/commit/799586110725a5399d1ab7f9e0ff307e5537ee12))
* **api:** D-16 — carnet de santé complet sans Premium ([86d85ee](https://github.com/QuentinDanblon/Captivia/commit/86d85ee26c0782ff6c1ce627f204ad426cbe1df0))
* **api:** médias d'espèce avec page source et type MIME ([d340a63](https://github.com/QuentinDanblon/Captivia/commit/d340a635dd840de68b9856055c20ae5dfc4ec584))
* **api:** mode invité — POST /auth/guest, POST /auth/upgrade, purge des invités ([1bf184e](https://github.com/QuentinDanblon/Captivia/commit/1bf184e05382d115b24fc06fce0d36049da37c2f))
* **api:** push natif FCM / APNs (W6-07) — jetons d'appareil, envoi FCM HTTP v1, dispatcher multi-canal ([a5993a4](https://github.com/QuentinDanblon/Captivia/commit/a5993a473aa2ef2221bd2ae2eaa6a9518665b200))
* **communauté:** texte alternatif par image, suspendedUntil à la racine du profil, nature de la cible dans les décisions ([5ad9ada](https://github.com/QuentinDanblon/Captivia/commit/5ad9adabe376b4d89cc96e3bd2fdd997e4b8f3e1))
* Docker stack, redesign frontend, modules A-F et audits ([e5ee7ce](https://github.com/QuentinDanblon/Captivia/commit/e5ee7cea11bf0e49d8462f02b40421860e24c9fc))
* full application with health records, QR code, and bug fixes ([5ced2a6](https://github.com/QuentinDanblon/Captivia/commit/5ced2a6bffc77b957398ecc91a65fd5e1c0b5690))
* **integrations:** Amazon retiré, Species+ et PubMed réels et désactivables (W3-05) ([53dc9cd](https://github.com/QuentinDanblon/Captivia/commit/53dc9cd47f09dfa995a7ad1a2b18f9182ca97b33))
* **maintenance:** purge quotidienne des données techniques et analytics sans userId en query (W2-08, LEG-06) ([fc16c2f](https://github.com/QuentinDanblon/Captivia/commit/fc16c2f994ef162674c972a05556069f97661442))
* pipeline races 1592 fiches complètes (7 onglets sourcés) ([03cab31](https://github.com/QuentinDanblon/Captivia/commit/03cab317f1f9f6c759c01b7250eff26a150c6455))
* **schema:** durcissement du schéma (CHECK, FK, trigram) et date de vérification des fiches (W1-09, W5-04) ([f9fecd2](https://github.com/QuentinDanblon/Captivia/commit/f9fecd22f4e484657095a67bfbd4866b92706821))


### Bug Fixes

* **agenda:** heures locales de l'utilisateur et priorité des sources ([0bad75a](https://github.com/QuentinDanblon/Captivia/commit/0bad75a39a79f5b005e323f297a956a40d7a3efb))
* alimentation recommandée par espèce (OPFF filtrait mal) ([2645082](https://github.com/QuentinDanblon/Captivia/commit/2645082e6cffa6be287ecc15ae490243851219df))
* **api:** couverture locale d'un jeton conservée si le champ est absent, remise à zéro au transfert ([df9739a](https://github.com/QuentinDanblon/Captivia/commit/df9739a74fe89750bf6ab8389a2c67c870630f07))
* **auth:** sérialise refresh et révocations, révoque tous les accès persistants ([c1a4734](https://github.com/QuentinDanblon/Captivia/commit/c1a4734c3631dac568ff6c9e76d0c18c55f89fa5))
* export RGPD complété, dumps privés, e2e backend gardés en CI ([23c35ea](https://github.com/QuentinDanblon/Captivia/commit/23c35ead4950d8c6f1da7be6a5aad5231dbf539e))
* message d'erreur de reset-dev-password ([9594d33](https://github.com/QuentinDanblon/Captivia/commit/9594d333cf5c98ec965b2cd8b102f499a18a8e33))
* **push:** liste blanche des services push, envois hors verrou du cron ([2468822](https://github.com/QuentinDanblon/Captivia/commit/246882278a6b4f19f44d5207029453f7a774d74d))
* **seed:** typer le tableau vide de magasins (tsc never) ([685efac](https://github.com/QuentinDanblon/Captivia/commit/685efaca3b2ac6d51096dae151333f1728269522))
* **sentry:** masque le jeton ICS et les secrets, exclut le flux des traces ([f370039](https://github.com/QuentinDanblon/Captivia/commit/f3700399f21f107896dd8523519f98bbe46aa920))
* use GBIF as fallback when species has no local profile ([1be986e](https://github.com/QuentinDanblon/Captivia/commit/1be986e520b4b7851b1b4b59274df91de3ad855d))


### Documentation

* archivage des documents périmés (plan-api, notes de seed, guide de saisie des espèces) ([e0f686e](https://github.com/QuentinDanblon/Captivia/commit/e0f686e79d33128c9ad14c9aa6db1bb9da4e6cdf))
* guide AGENTS.md (règles, carte, vérifications), CLAUDE.md, README réécrits ([5479f61](https://github.com/QuentinDanblon/Captivia/commit/5479f61126084d559650bbe7f3ceffe7fbfd6dff))
