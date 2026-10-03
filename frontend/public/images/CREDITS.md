# Crédits des images

Toute image servie depuis `public/images/` figure ici **avant** d'être utilisée dans une page.
Règles complètes : `frontend/docs/DESIGN.md`, section « Imagerie ».

- Licences acceptées : **CC0**, **domaine public**, **CC BY** et **CC BY-SA** (attribution obligatoire,
  y compris dans la légende `Figure` : auteur + licence liés à la source).
- Sources : Wikimedia Commons en priorité (licence lue sur la page du fichier, pas sur un site miroir).
- Interdit : images générées par IA, banques d'images sans licence libre, captures d'autres sites,
  licences NC/ND (incompatibles avec la redistribution et le recadrage).
- Fichiers : `public/images/<animals|nature>/<slug>-<largeur>.<avif|webp>`, plusieurs largeurs, plus
  grande variante ≤ 150 Ko, métadonnées (EXIF, XMP, ICC, localisation) retirées.

Le registre utilisé par le code est `src/content/photos.ts` (même liste) : `Figure` affiche le
crédit sous chaque photo (ou en cartouche sur la photo du haut de la landing) et la page
« Sources et licences » reprend ce tableau.

## Vérification

Licence, auteur et attribution relus le 2026-10-02 via l'API de Wikimedia Commons
(`action=query&prop=imageinfo&iiprop=url|extmetadata`, champs `LicenseShortName`, `LicenseUrl`,
`Artist`, `Attribution`, `AttributionRequired`). Téléchargement de la vignette 1920 px fournie par
Commons (ou du fichier original s'il est plus petit), puis traitement avec `sharp`.

**Modifications** (toutes les photos) : recadrage au ratio d'affichage, redimensionnement,
conversion AVIF + WebP, retrait des métadonnées. *Textures de fond* (`moss-forest`, `lemon-balm`) :
léger flou en plus, pour alléger les fichiers. Les adaptations des photos CC BY-SA sont diffusées
sous la même licence.

## Photographies

| Fichier(s) | Sujet | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/dog-golden-retriever-{480,800,1200}` | Golden retriever, en forêt (Dülmen, Allemagne) | Dülmen, Hausdülmen, Golden Retriever -- 2022 -- 5945.jpg | Dietmar Rabich | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_Hausd%C3%BClmen,_Golden_Retriever_--_2022_--_5945.jpg |
| `animals/dog-river-{640,960,1280,1600}` | Chien dans l'eau, lumière du soir (Laos) | Liver yellow dog in the water looking at viewer at golden hour in Don Det Laos.jpg | Basile Morin | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Liver_yellow_dog_in_the_water_looking_at_viewer_at_golden_hour_in_Don_Det_Laos.jpg |
| `animals/cat-straw-{480,800,1200}` | Chat roux et blanc couché sur la paille | Felis silvestris catus lying on rice straw.jpg | Basile Morin | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Felis_silvestris_catus_lying_on_rice_straw.jpg |
| `animals/cat-tabby-{480,800}` | Jeune chat tigré assis (Portugal) | Cat November 2010-1a.jpg | Alvesgaspar | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Cat_November_2010-1a.jpg |
| `animals/rabbit-straw-{480,800,1200}` | Lapin noir et blanc buvant dans une gamelle | Conejo común (Oryctolagus cuniculus), Tierpark Hellabrunn, Múnich, Alemania, 2012-06-17, DD 02.JPG | Diego Delso | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Conejo_com%C3%BAn_(Oryctolagus_cuniculus),_Tierpark_Hellabrunn,_M%C3%BAnich,_Alemania,_2012-06-17,_DD_02.JPG |
| `animals/cockatiels-{480,800,1200}` | Trois calopsittes sur une branche | Nymphicus hollandicus - Forst 01.jpg | H. Zell | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Nymphicus_hollandicus_-_Forst_01.jpg |
| `animals/budgerigars-{480,800,1200}` | Deux perruches ondulées | Melopsittacus undulatus - Vogelpark Steinen 02.jpg | H. Zell | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Melopsittacus_undulatus_-_Vogelpark_Steinen_02.jpg |
| `animals/leopard-gecko-{480,800}` | Gecko léopard sur le sable | Eublepharis macularius 2009 G6.jpg | George Chernilevsky | Domaine public | https://commons.wikimedia.org/wiki/File:Eublepharis_macularius_2009_G6.jpg |
| `animals/bearded-dragon-{480,800}` | Tête de pogona (agame barbu) | 383 - Head of central bearded dragon (Pogona vitticeps).jpg | Virtual-Pano | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:383_-_Head_of_central_bearded_dragon_(Pogona_vitticeps).jpg |
| `animals/neon-tetra-{480,800,1200}` | Néon (tétra) en aquarium | Neonsalmler Paracheirodon innesi.jpg | Holger Krisp | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Neonsalmler_Paracheirodon_innesi.jpg |
| `animals/horse-{480,800}` | Portrait d'un cheval lusitanien | Horse December 2014-1.jpg | Alvesgaspar | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Horse_December_2014-1.jpg |
| `animals/hen-{480,800,1200}` | Poule rousse | Hen chicken.jpg | Thegreenj | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Hen_chicken.jpg |
| `nature/moss-forest-{640,960,1280}` | Sous-bois moussu (Lierneux, Belgique) | Mossy forest in Lierneux (DSC01260).jpg | Trougnouf (Benoit Brummer) | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Mossy_forest_in_Lierneux_(DSC01260).jpg |
| `nature/grass-droplets-{800,1200,1600}` | Brins d'herbe et gouttes de rosée (Lisbonne) | Grass blades with water droplets, Parque Florestal de Monsanto, Lisbon, Portugal (approx. GPS location) julesvernex2.jpg | Jules Verne Times Two | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Grass_blades_with_water_droplets,_Parque_Florestal_de_Monsanto,_Lisbon,_Portugal_(approx._GPS_location)_julesvernex2.jpg |
| `nature/lemon-balm-{640,960,1280}` | Feuilles de mélisse | Mélisse Feuilles FR 2013b.jpg | JLPC / Wikimedia Commons | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:M%C3%A9lisse_Feuilles_FR_2013b.jpg |

Chaque fichier existe en `.avif` et en `.webp`. Licences : CC BY-SA 4.0
(https://creativecommons.org/licenses/by-sa/4.0/), CC BY-SA 3.0
(https://creativecommons.org/licenses/by-sa/3.0/), CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/), CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).

## Hors de `public/images/`

| Fichier | Usage | Origine |
| --- | --- | --- |
| `src/assets/og-golden-retriever.jpg` | Fond de l'image Open Graph (1200×630) générée par `opengraph-image.tsx` | `dog-golden-retriever` ci-dessus (Dietmar Rabich, CC BY-SA 4.0), recadrée ; le crédit est écrit sur l'image |
