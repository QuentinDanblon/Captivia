# Crédits des images

Toute image servie depuis `public/images/` figure ici **avant** d'être utilisée dans une page.
Règles complètes : `frontend/docs/DESIGN.md`, section « Imagerie ».

- Licences acceptées : **CC0**, **domaine public**, **CC BY** et **CC BY-SA** (attribution obligatoire,
  y compris dans la légende `Figure` : auteur + licence liés à la source).
- Sources : Wikimedia Commons en priorité (licence lue sur la page du fichier, pas sur un site miroir).
- Interdit : images générées par IA, banques d'images sans licence libre, captures d'autres sites,
  licences NC/ND (incompatibles avec la redistribution et le recadrage).
- Fichiers : `public/images/<animals|nature|guides|categories|textures>/<slug>-<largeur>.<avif|webp>`, plusieurs largeurs, plus
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

Les 40 photographies supplémentaires du catalogue ont été vérifiées le **2026-10-03** avec
la même API : licence libre, auteur/attribution et identification taxonomique dans la description
et les catégories de Commons, puis contrôle visuel. Les images sans attribution exploitable,
sous licence non admise ou montrant un autre taxon ont été remplacées. Les variantes ne sont
pas agrandies au-delà de la largeur originale.

Les deux schémas des guides ont été vérifiés le **2026-10-03** dans les métadonnées de la même API.
Ils sont conservés en entier sur fond blanc, redimensionnés et convertis en AVIF + WebP ; la
source vectorielle permet de produire chaque largeur sans recadrage.

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
| `animals/guinea-pig-{480,800}` | Cochon d'Inde (Cavia porcellus) | Yoyocochondinde.JPG | Variraptor | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Yoyocochondinde.JPG |
| `animals/syrian-hamster-{480,800}` | Hamster doré (Mesocricetus auratus) | Golden hamster front 1.jpg | Adamjennison111 at English Wikipedia | CC BY 2.5 | https://commons.wikimedia.org/wiki/File:Golden_hamster_front_1.jpg |
| `animals/ferret-{480,800}` | Furet (Mustela putorius furo) | Ferret 2008.png | Alfredo Gutiérrez | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Ferret_2008.png |
| `animals/chinchilla-{480,800}` | Chinchilla (Chinchilla lanigera) | Chinchilla lanigera1.jpg | Trurl66 | Domaine public | https://commons.wikimedia.org/wiki/File:Chinchilla_lanigera1.jpg |
| `animals/domestic-mouse-{480,800}` | Souris blanche domestique (Mus musculus domesticus) | Farbmaeuse.jpg | Whitesky | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Farbmaeuse.jpg |
| `animals/domestic-rat-{480,800}` | Rat domestique (Rattus norvegicus domesticus) | Rats-domestique.jpg | Alexalouest | CC0 | https://commons.wikimedia.org/wiki/File:Rats-domestique.jpg |
| `animals/canary-{480,800}` | Canari (Serinus canaria domesticus) | GelbA.JPG | NEWSchr | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:GelbA.JPG |
| `animals/african-grey-{480,800}` | Perroquet Gris d'Afrique (Psittacus erithacus) | Psittacus_erithacus_qtl1.jpg | Quartl | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Psittacus_erithacus_qtl1.jpg |
| `animals/boa-constrictor-{480,800}` | Boa Constricteur (Boa constrictor) | Boa_constrictor_Gallion_Guyane.jpg | Arnaud Aury | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Boa_constrictor_Gallion_Guyane.jpg |
| `animals/ball-python-{480,800}` | Python Royal (Python regius) | Ball_python_lucy.JPG | Mokele at English Wikipedia | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ball_python_lucy.JPG |
| `animals/green-iguana-{480,800}` | Iguane Vert (Iguana iguana) | Iguanidae_head_from_Venezuela.jpg | Wilfredor | CC0 | https://commons.wikimedia.org/wiki/File:Iguanidae_head_from_Venezuela.jpg |
| `animals/red-eared-slider-{480,800}` | Tortue à Oreilles Rouges (Trachemys scripta elegans) | Roodwangsierschildpad.jpg | Fruggo | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Roodwangsierschildpad.jpg |
| `animals/veiled-chameleon-{480,800}` | Caméléon Casqué (Chamaeleo calyptratus) | 2017-05-13_AT_Wien_22_Donaustadt,_Palmenhaus_Hirschstetten,_Chamaeleo_calyptratus_(51099601593).jpg | Paul Korecky | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:2017-05-13_AT_Wien_22_Donaustadt,_Palmenhaus_Hirschstetten,_Chamaeleo_calyptratus_(51099601593).jpg |
| `animals/axolotl-{480,800}` | Axolotl (Ambystoma mexicanum) | Ambystoma_mexicanum_-_Aksolotli,_Mexican_axolotl_C_IMG_3700.JPG | Anneli Salo | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ambystoma_mexicanum_-_Aksolotli,_Mexican_axolotl_C_IMG_3700.JPG |
| `animals/goldfish-{480,800}` | Poisson Rouge (Carassius auratus) | Gold fish1.jpg | לינה אבוגוש | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Gold_fish1.jpg |
| `animals/betta-{320,425}` | Combattant (Betta) (Betta splendens) | Betta splendens - Flickr - Nippyfish.jpg | Nippyfish | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Betta_splendens_-_Flickr_-_Nippyfish.jpg |
| `animals/guppy-{320,378}` | Guppy (Poecilia reticulata) | Guppy_coppia_gialla.jpg | Marrabbio2 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Guppy_coppia_gialla.jpg |
| `animals/stick-insect-{320,734}` | Phasme Bâton (Carausius morosus) | Carausius morosus-adult1.JPG | Dinosaur918 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Carausius_morosus-adult1.JPG |
| `animals/hissing-cockroach-{480,800}` | Blatte de Madagascar (Gromphadorhina portentosa) | Female_Madagascar_hissing_cockroach.JPG | Almabes at English Wikipedia | Domaine public | https://commons.wikimedia.org/wiki/File:Female_Madagascar_hissing_cockroach.JPG |
| `animals/emperor-scorpion-{480,800}` | Scorpion Empereur (Pandinus imperator) | Pandinus-imperator-6609.jpg | Danny Steaven | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Pandinus-imperator-6609.jpg |
| `animals/bullfrog-{480,800}` | Grenouille Taureau (Lithobates catesbeianus) | North-American-bullfrog1.jpg | Carl D. Howe | CC BY-SA 2.5 | https://commons.wikimedia.org/wiki/File:North-American-bullfrog1.jpg |
| `animals/russian-hamster-{480,800}` | Hamster russe (Phodopus sungorus) | Phodopus_sungorus2.jpg | Dirk Goldhahn | CC BY-SA 2.5 | https://commons.wikimedia.org/wiki/File:Phodopus_sungorus2.jpg |
| `animals/campbell-hamster-{320,360}` | Hamster de Campbell (Phodopus campbelli) | Campbell_hamster_blue_fawn.jpg | Allen Huang | Domaine public | https://commons.wikimedia.org/wiki/File:Campbell_hamster_blue_fawn.jpg |
| `animals/roborovski-hamster-{320,559}` | Hamster Roborovski (Phodopus roborovskii) | Photo_of_Roborovski_Hamster.jpg | Roborovskihamsters at en.wikipedia | Domaine public | https://commons.wikimedia.org/wiki/File:Photo_of_Roborovski_Hamster.jpg |
| `animals/crested-gecko-{480,800}` | Gecko à crête (Correlophus ciliatus) | Eveha's_crested_gecko.jpg | Eveha | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Eveha%27s_crested_gecko.jpg |
| `animals/panther-chameleon-{480,800}` | Caméléon panthère (Furcifer pardalis) | Panther chameleon (Furcifer pardalis) male Montagne d’Ambre 2.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Panther_chameleon_(Furcifer_pardalis)_male_Montagne_d%E2%80%99Ambre_2.jpg |
| `animals/hermann-tortoise-{480,800}` | Tortue Hermann (Testudo hermanni) | Testudo_hermanni_hermanni_Mallorca_02.jpg | Orchi | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Testudo_hermanni_hermanni_Mallorca_02.jpg |
| `animals/ring-necked-parakeet-{320,645}` | Perruche à collier (Psittacula krameri) | Rose-ringed_Parakeets_(Male_&_Female)-_During_Foreplay_at_Hodal_I_Picture_0034.jpg | J.M.Garg | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Rose-ringed_Parakeets_(Male_%26_Female)-_During_Foreplay_at_Hodal_I_Picture_0034.jpg |
| `animals/fischer-lovebird-{480,800}` | Inséparable Fischer (Agapornis fischeri) | Inséparables.JPG | Ghislain38 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ins%C3%A9parables.JPG |
| `animals/blue-yellow-macaw-{480,800}` | Ara ararauna (Ara ararauna) | Ara ararauna qtl3.jpg | Quartl | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ara_ararauna_qtl3.jpg |
| `animals/angelfish-{480,800}` | Scalaire (Pterophyllum scalare) | Angelfish 2.jpg | Gannu03 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Angelfish_2.jpg |
| `animals/zebrafish-{480,800}` | Danio zébré (Danio rerio) | Zebradanio-P1219668.jpg | Ffish.asia | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Zebradanio-P1219668.jpg |
| `animals/ramirezi-{320,444}` | Cichlidé de Ramirezi (Mikrogeophagus ramirezi) | Mikrogeophagus_ramirezi_2.jpg | Grommash | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Mikrogeophagus_ramirezi_2.jpg |
| `animals/red-eyed-tree-frog-{480,800}` | Rainette aux yeux rouges (Agalychnis callidryas) | Agalychnis_callidryas.jpg | Christian R. Linder | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Agalychnis_callidryas.jpg |
| `animals/dyeing-poison-frog-{480,800}` | Dendrobate (Dendrobates tinctorius) | Dendrobates tinctorius - Wilhelma.jpg | H. Zell | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Dendrobates_tinctorius_-_Wilhelma.jpg |
| `animals/cherry-shrimp-{480,800}` | Crevette Red Cherry (Neocaridina davidi) | RedCherryShrimp.jpg | Atulbhats | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:RedCherryShrimp.jpg |
| `animals/amano-shrimp-{480,800}` | Crevette Amano (Caridina multidentata) | Caridina_multidentata(Hamamatsu,Shizuoka,Japan,2007).jpg | Seotaro | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Caridina_multidentata(Hamamatsu,Shizuoka,Japan,2007).jpg |
| `animals/sheep-{480,800}` | Mouton (Ovis aries) | Flock_of_sheep.jpg | Keith Weller | Domaine public | https://commons.wikimedia.org/wiki/File:Flock_of_sheep.jpg |
| `animals/donkey-{320,714}` | Âne (Equus asinus) | Donkey_in_Clovelly,_North_Devon,_England.jpg | Adrian Pingstone | Domaine public | https://commons.wikimedia.org/wiki/File:Donkey_in_Clovelly,_North_Devon,_England.jpg |
| `animals/african-hedgehog-{480,800}` | Hérisson africain (Atelerix albiventris) | Atelerix albiventris in Spain.jpg | Nacaru | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Atelerix_albiventris_in_Spain.jpg |
| `guides/aquarium-filter-{480,800,1200}` | Schéma de filtre extérieur d'aquarium | Aquarium-Au enfilter.svg | Fred the Oyster | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Aquarium-Au_enfilter.svg |
| `guides/nitrogen-cycle-{480,800,1200}` | Cycle de l'azote dans un aquarium | Aquarium Nitrogen Cycle.svg | Ilmari Karonen | Domaine public | https://commons.wikimedia.org/wiki/File:Aquarium_Nitrogen_Cycle.svg |

Chaque fichier existe en `.avif` et en `.webp`. Licences : CC BY-SA 4.0
(https://creativecommons.org/licenses/by-sa/4.0/), CC BY-SA 3.0
(https://creativecommons.org/licenses/by-sa/3.0/), CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/), CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/), CC BY 2.0
(https://creativecommons.org/licenses/by/2.0/), CC BY 2.5
(https://creativecommons.org/licenses/by/2.5/), CC BY-SA 2.0
(https://creativecommons.org/licenses/by-sa/2.0/), CC BY-SA 2.5
(https://creativecommons.org/licenses/by-sa/2.5/) et CC0
(https://creativecommons.org/publicdomain/zero/1.0/).

## Hors de `public/images/`

| Fichier | Usage | Origine |
| --- | --- | --- |
| `src/assets/og-golden-retriever.jpg` | Fond de l'image Open Graph (1200×630) générée par `opengraph-image.tsx` | `dog-golden-retriever` ci-dessus (Dietmar Rabich, CC BY-SA 4.0), recadrée ; le crédit est écrit sur l'image |

## Photos HD des catégories — vérifiées le 2026-10-04

Originaux Wikimedia Commons, recadrés en 16:9 puis exportés en 640, 1200 et 1600 pixels, sans agrandissement, en AVIF et WebP sans métadonnées. Les dérivés conservent la licence de leur source.

| Fichier | Auteur | Licence | Source |
|---|---|---|---|
| `categories/mammals-{640,1200,1600}.{avif,webp}` | Dietmar Rabich | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_Hausd%C3%BClmen,_Golden_Retriever_--_2022_--_5945.jpg |
| `categories/birds-{640,1200,1600}.{avif,webp}` | Quartl | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ara_ararauna_qtl3.jpg |
| `categories/fish-{640,1200,1600}.{avif,webp}` | Denise Chan | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Betta-splendens-male.jpg |
| `categories/reptiles-{640,1200,1600}.{avif,webp}` | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Panther_chameleon_(Furcifer_pardalis)_male_Montagne_d%E2%80%99Ambre_2.jpg |
| `categories/amphibians-{640,1200,1600}.{avif,webp}` | Pavel Kirillov | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Red-eyed_Leaf_Frog_(Agalychnis_callidryas)_(9362143274).jpg |
| `categories/insects-{640,1200,1600}.{avif,webp}` | Rhododendrites | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Monarch_butterfly_in_BBG_(84685).jpg |

## Textures photographiques des catégories — vérifiées le 2026-10-04

Photographies réelles de matières animales, recadrées sans agrandissement à 800 × 550 pixels, AVIF/WebP sans métadonnées ; répétition par réflexion dans l’interface. Les dérivés conservent la licence de leur source.

| Fichier | Matière | Auteur | Licence | Source |
|---|---|---|---|---|
| `textures/mammals-800.{avif,webp}` | Mammals | Scott Robinson from Rockville, MD, USA | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Greyhound_fur_brindle.jpg |
| `textures/birds-800.{avif,webp}` | Birds | Marc-Julien-Photography | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Flamingo-feathers-layered-texture-pink-minimal.jpg |
| `textures/fish-800.{avif,webp}` | Fish | Ryan Hagerty/USFWS | Domaine public | https://commons.wikimedia.org/wiki/File:Erwin_NFH_rainbow_trout_scales_7_March_2022.png |
| `textures/reptiles-800.{avif,webp}` | Reptiles | Willie Luker from USA | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Eye_of_Lizard_(55203172463).jpg |
| `textures/amphibians-800.{avif,webp}` | Amphibians | H. Zell | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Dendrobates_tinctorius_-_Wilhelma.jpg |
| `textures/insects-800.{avif,webp}` | Insects | Franz van Duns | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:2021-08-16_-_Peacock_butterfly_(Aglais_io)_-_eyespot_on_forewing_-_colourful_scales_-_DSG3404-1_(magnif._ratio_2.2x,_HiRes_focus_stack).jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04

Les douze fichiers ci-dessous ont été vérifiés sur la page Commons et visuellement avant recadrage au format 4:3, redimensionnement, conversion AVIF/WebP et suppression des métadonnées. Les fichiers dérivés gardent la licence de leur source.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/tarantula-mexican-red-knee-{480,800}.{avif,webp}` | Brachypelma smithi, tarentule mexicaine à genoux rouges | Brachypelma smithi 2009 G02.jpg | George Chernilevsky | Domaine public | https://commons.wikimedia.org/wiki/File:Brachypelma_smithi_2009_G02.jpg |
| `animals/greek-tortoise-{480,800}.{avif,webp}` | Testudo graeca, tortue grecque | Testudo graeca at Dibbeen2.JPG | عباد ديرانية | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Testudo_graeca_at_Dibbeen2.JPG |
| `animals/marginated-tortoise-{480,800}.{avif,webp}` | Testudo marginata, tortue bordée | Klokschildpad - Marginated tortoise - Testudo marginata 02.jpg | Bouke ten Cate | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Klokschildpad_-_Marginated_tortoise_-_Testudo_marginata_02.jpg |
| `animals/corn-snake-{480,800}.{avif,webp}` | Pantherophis guttatus, serpent des blés | Kornnatter (Pantherophis guttatus), Seitenansicht.jpg | Peter Paplanus | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Kornnatter_(Pantherophis_guttatus),_Seitenansicht.jpg |
| `animals/king-snake-{480,800}.{avif,webp}` | Lampropeltis getula, couleuvre royale | Lampropeltis getula Stanton 1.jpg | Riley Stanton | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Lampropeltis_getula_Stanton_1.jpg |
| `animals/savannah-monitor-{480,800}.{avif,webp}` | Varanus exanthematicus, varan des steppes | Varanus exanthematicus in the wild.jpg | Daniel Bennett | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Varanus_exanthematicus_in_the_wild.jpg |
| `animals/panda-corydoras-{480,800}.{avif,webp}` | Corydoras panda | Corydoras panda. (46592394085).jpg | Harry Kramer from Winterswijk, The Netherlands | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Corydoras_panda._(46592394085).jpg |
| `animals/bronze-corydoras-{480,800}.{avif,webp}` | Corydoras aeneus, corydoras bronze | Female Bronze Corydoras (Corydoras aeneus).jpg | Andrew Keller | CC0 | https://commons.wikimedia.org/wiki/File:Female_Bronze_Corydoras_(Corydoras_aeneus).jpg |
| `animals/platy-{480,640}.{avif,webp}` | Xiphophorus maculatus, platy | Platy 011.jpg | Gourami Watcher | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Platy_011.jpg |
| `animals/oriental-fire-bellied-toad-{480,800}.{avif,webp}` | Bombina orientalis, crapaud à ventre de feu | Bombina orientalis 35461949.jpg | Kim, Hyun-tae | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Bombina_orientalis_35461949.jpg |
| `animals/orchid-mantis-{480,800}.{avif,webp}` | Hymenopus coronatus, mante orchidée | Mantis Hymenopus coronatus 6 Luc Viatour.jpg | Luc Viatour | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Mantis_Hymenopus_coronatus_6_Luc_Viatour.jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 2

Ces dix images Commons ont été contrôlées sur leur fiche de fichier et visuellement, puis recadrées au format 4:3, redimensionnées sans agrandissement, converties en AVIF/WebP et privées de leurs métadonnées.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/curly-hair-tarantula-{480,700}.{avif,webp}` | Brachypelma albopilosum, tarentule du Curacao | Brachypelma.albopilosum.female.jpg | Sarefo | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Brachypelma.albopilosum.female.jpg |
| `animals/rosy-faced-lovebird-{480,800}.{avif,webp}` | Agapornis roseicollis, inséparable rosâtre | Rosy-faced lovebird (Agapornis roseicollis roseicollis).jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Rosy-faced_lovebird_(Agapornis_roseicollis_roseicollis).jpg |
| `animals/zebra-finch-{480,800}.{avif,webp}` | Taeniopygia guttata, diamant mandarin | 2014-08-19 Zebra Finch, Sumba, Nusa Tenggara Timur, Indonesia 1.jpg | christoph_moning | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:2014-08-19_Zebra_Finch,_Sumba,_Nusa_Tenggara_Timur,_Indonesia_1.jpg |
| `animals/black-molly-{480,800}.{avif,webp}` | Poecilia sphenops, molly noire | PoeciliaSphenops.jpg | Dnoerholm | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:PoeciliaSphenops.jpg |
| `animals/green-treefrog-{480,800}.{avif,webp}` | Hyla cinerea, rainette arboricole verte | Green treefrog.jpg | Brian Gratwicke | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Green_treefrog.jpg |
| `animals/mongolian-gerbil-{480,800}.{avif,webp}` | Meriones unguiculatus, gerbille | Meriones unguiculatus (wild).jpg | Alastair Rae from London, United Kingdom | Domaine public | https://commons.wikimedia.org/wiki/File:Meriones_unguiculatus_(wild).jpg |
| `animals/chilean-degu-{480,720}.{avif,webp}` | Octodon degus, dègue du Chili | Octodon Degus fr.jpg | Jacek555 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Octodon_Degus_fr.jpg |
| `animals/blue-fronted-amazon-{480,800}.{avif,webp}` | Amazona aestiva, amazone à front bleu | Amazona aestiva - Nayara - 416814215.jpeg | Nayara | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Amazona_aestiva_-_Nayara_-_416814215.jpeg |
| `animals/white-fronted-amazon-{480,800}.{avif,webp}` | Amazona albifrons, amazone à front blanc | Amazona-albifrons.jpg | Penkinvaltaaja | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Amazona-albifrons.jpg |
| `animals/white-cockatoo-{480,800}.{avif,webp}` | Cacatua alba, cacatoès blanc | Burung Kakatua Putih Di THKMS.jpg | Muhamad Izzul Fiqih | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Burung_Kakatua_Putih_Di_THKMS.jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 3

Ces cinq photos ont été vérifiées sur Commons et visuellement, puis recadrées au format 4:3 et optimisées localement en AVIF/WebP. Les deux autres espèces du lot de recherche ne figurent pas dans le catalogue actuel.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/madagascar-giant-day-gecko-{480,800}.{avif,webp}` | Phelsuma grandis, gecko géant de Madagascar | Madagascar giant day gecko (Phelsuma grandis) Nosy Komba.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Madagascar_giant_day_gecko_(Phelsuma_grandis)_Nosy_Komba.jpg |
| `animals/whites-tree-frog-{480,800}.{avif,webp}` | Litoria caerulea, rainette de White | Australia green tree frog (Litoria caerulea) crop.jpg | LiquidGhoul | Domaine public | https://commons.wikimedia.org/wiki/File:Australia_green_tree_frog_(Litoria_caerulea)_crop.jpg |
| `animals/capybara-{480,800}.{avif,webp}` | Hydrochoerus hydrochaeris, capybara | Capivara (Hydrochoerus hydrochaeris).jpg | Clodomiro Esteves Junior | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Capivara(Hydrochoerus_hydrochaeris).jpg |
| `animals/tokay-gecko-{480,800}.{avif,webp}` | Gekko gecko, gecko tokay | Tokay Gecko (Gekko gecko) (7109782823).jpg | Bernard DUPONT | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Tokay_Gecko_(Gekko_gecko)_(7109782823).jpg |
| `animals/meerkat-{480,800}.{avif,webp}` | Suricata suricatta, suricate | Meerkat (Suricata suricatta) Tswalu.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Meerkat_(Suricata_suricatta)_Tswalu.jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 4

Les quatorze photos suivantes ont été vérifiées sur Commons et visuellement, recadrées au format 4:3 et optimisées localement en AVIF/WebP.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/eclectus-{480,800}.{avif,webp}` | Eclectus roratus, éclectus | Eclectus roratus -National Zoo, Washington, USA -female-8a.jpg | angela n. | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Eclectus_roratus_-National_Zoo,_Washington,_USA_-female-8a.jpg |
| `animals/emu-{480,800}.{avif,webp}` | Dromaius novaehollandiae, émeu | Emu 1 - Tidbinbilla.jpg | JJ Harrison | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Emu_1_-_Tidbinbilla.jpg |
| `animals/blue-peafowl-{480,800}.{avif,webp}` | Pavo cristatus, paon bleu | Pfau imponierend.jpg | BS Thurner Hof | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Pfau_imponierend.jpg |
| `animals/golden-pheasant-{480,800}.{avif,webp}` | Chrysolophus pictus, faisan doré | Golden Pheasant, Tangjiahe Nature Reserve.jpg | Jmhullot | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Golden_Pheasant,_Tangjiahe_Nature_Reserve.jpg |
| `animals/gouldian-finch-{480,800}.{avif,webp}` | Chloebia gouldiae, gouldien | Chloebia gouldiae, Elsey, Northern Territory, Australia 1.jpg | Kym Nicolson | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Chloebia_gouldiae,_Elsey,_Northern_Territory,_Australia_1.jpg |
| `animals/ornate-horned-frog-{480,800}.{avif,webp}` | Ceratophrys ornata, grenouille cornue | Argentine Horned Frog (Ceratophrys ornata)1.JPG | Max | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Argentine_Horned_Frog_(Ceratophrys_ornata)1.JPG |
| `animals/japanese-giant-salamander-{480,800}.{avif,webp}` | Andrias japonicus, salamandre géante du Japon | Japanese giant salamander in Tottori Prefecture, Japan.jpg | Salamandra2021 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Japanese_giant_salamander_in_Tottori_Prefecture,_Japan.jpg |
| `animals/leaf-insect-{480,800}.{avif,webp}` | Phyllium philippinicum, phasme feuille | Phyllium Philippinicum.jpg | Ebe.wiki | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Phyllium_Philippinicum.jpg |
| `animals/giant-african-snail-{480,800}.{avif,webp}` | Achatina fulica, escargot géant africain | Giant African land snail (Achatina fulica) Ranomafana.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Giant_African_land_snail_(Achatina_fulica)_Ranomafana.jpg |
| `animals/giant-millipede-{480,800}.{avif,webp}` | Archispirostreptus gigas, mille-pattes géant | Archispirostreptus-Gigas-Amphitheatre.jpg | Bjørn Christian Tørrissen | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Archispirostreptus-Gigas-Amphitheatre.jpg |
| `animals/fire-salamander-{480,800}.{avif,webp}` | Salamandra salamandra, salamandre tachetée | A fire salamander (Salamandra salamandra).jpg | Vasyl Krasnoshtan | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:A_fire_salamander_(Salamandra_salamandra).jpg |
| `animals/tomato-frog-{480,800}.{avif,webp}` | Dyscophus antongilii, grenouille tomate | Dyscophus antongilii 186311549.jpg | Marius Burger | CC0 | https://commons.wikimedia.org/wiki/File:Dyscophus_antongilii_186311549.jpg |
| `animals/bumblebee-poison-frog-{480,800}.{avif,webp}` | Dendrobates leucomelas, dendrobate lépreux | Bumblebee Poison Frog Dendrobates leucomelas.jpg | Holger Krisp | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Bumblebee_Poison_Frog_Dendrobates_leucomelas.jpg |
| `animals/cranwells-horned-frog-{480,800}.{avif,webp}` | Ceratophrys cranwelli, grenouille cornue de Cranwell | Ceratophrys cranwell.jpg | Daiju Azuma | CC BY-SA 2.5 | https://commons.wikimedia.org/wiki/File:Ceratophrys_cranwell.jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 5

Ces quinze photos ont été vérifiées sur Commons et visuellement, puis recadrées au format 4:3 et optimisées localement en AVIF/WebP.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/phelsuma-madagascar-{480,800}.{avif,webp}` | Phelsuma madagascariensis, gecko diurne de Madagascar | Phelsuma madagascariensis vivarium Lausanne.jpg | Gzzz | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Phelsuma_madagascariensis_vivarium_Lausanne.jpg |
| `animals/satanic-leaf-tailed-gecko-{480,800}.{avif,webp}` | Uroplatus phantasticus, gecko satanique | Satanic leaf-tailed gecko (Uroplatus phantasticus) Ranomafana 2.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Satanic_leaf-tailed_gecko_(Uroplatus_phantasticus)_Ranomafana_2.jpg |
| `animals/antilles-iguana-{480,800}.{avif,webp}` | Iguana delicatissima, iguane des Petites Antilles | Iguana delicatissima in Coulibistrie e04.jpg | Postdlf | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Iguana_delicatissima_in_Coulibistrie_e04.jpg |
| `animals/green-anole-{480,800}.{avif,webp}` | Anolis carolinensis, anole vert | Anolis carolinensis mating.JPG | Cowenby | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Anolis_carolinensis_mating.JPG |
| `animals/knight-anole-{480,800}.{avif,webp}` | Anolis equestris, anole de Cuba | Knight Anole hunting.jpg | James Powers | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Knight_Anole_hunting.jpg |
| `animals/green-basilisk-{480,800}.{avif,webp}` | Basiliscus plumifrons, basilic vert | Plumedbasiliskcele4.jpg | Marcel Burkhard / Cele4 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Plumedbasiliskcele4.jpg |
| `animals/jacksons-chameleon-{480,800}.{avif,webp}` | Trioceros jacksonii, caméléon de Jackson | Male Jackson's Chameleon - Big Island Hawaii June 12 2025.jpg | AMMuench | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Male_Jackson%27s_Chameleon_-_Big_Island_Hawaii_June_12_2025.jpg |
| `animals/parsons-chameleon-{480,800}.{avif,webp}` | Calumma parsonii, caméléon de Parson | Parson's chameleon (Calumma parsonii cristifer) female Andasibe 2.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Parson%27s_chameleon_(Calumma_parsonii_cristifer)_female_Andasibe_2.jpg |
| `animals/komodo-dragon-{480,800}.{avif,webp}` | Varanus komodoensis, varan de Komodo | Komodo dragon (Varanus komodoensis) 2.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Komodo_dragon_(Varanus_komodoensis)_2.jpg |
| `animals/argentine-tegu-{480,800}.{avif,webp}` | Salvator merianae, téju noir et blanc | Argentine Black and White Tegu (Salvator merianae) male - Flickr - berniedup.jpg | Bernard DUPONT | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Argentine_Black_and_White_Tegu_(Salvator_merianae)_male_-_Flickr_-_berniedup.jpg |
| `animals/frill-necked-lizard-{480,800}.{avif,webp}` | Chlamydosaurus kingii, lézard à collerette | Frill-necked Lizard (Chlamydosaurus kingii) (8692607976).jpg | Matt from Melbourne | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Frill-necked_Lizard_(Chlamydosaurus_kingii)_(8692607976).jpg |
| `animals/ocellated-lizard-{480,800}.{avif,webp}` | Timon lepidus, lézard ocellé | Jewelled Lizard (Timon lepidus) female (found by Jean NICOLAS) - Flickr - berniedup (1).jpg | Bernard DUPONT | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Jewelled_Lizard_(Timon_lepidus)_female_(found_by_Jean_NICOLAS)_-_Flickr_-_berniedup_(1).jpg |
| `animals/emerald-tree-boa-{480,800}.{avif,webp}` | Corallus caninus, boa émeraude | Emerald Tree Boa 003.jpg | Ltshears | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Emerald_Tree_Boa_003.jpg |
| `animals/milk-snake-{480,800}.{avif,webp}` | Lampropeltis triangulum, couleuvre faux-corail | Eastern Milksnake (Lampropeltis triangulum) - Flickr - 2ndPeter (2).jpg | Peter Paplanus | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Eastern_Milksnake_(Lampropeltis_triangulum)_-_Flickr_-_2ndPeter_(2).jpg |
| `animals/hognose-snake-{480,800}.{avif,webp}` | Heterodon nasicus, couleuvre à nez plat | Plains Hognose Snake (Heterodon nasicus) (29833441881).jpg | Peter Paplanus | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Plains_Hognose_Snake_(Heterodon_nasicus)_(29833441881).jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 6

Treize photos de poissons ont été vérifiées sur Commons et visuellement, puis recadrées au format 4:3 et optimisées localement. Le poisson-clown et le cichlidé convict recherchés ne sont pas associés : le premier n'existe pas dans le catalogue actuel et la notice photo du second comporte une contradiction sur le sexe.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/black-neon-tetra-{480,800}.{avif,webp}` | Hyphessobrycon herbertaxelrodi, néon noir | Hyphessobrycon herbertaxelrodi Gratwicke.jpg | Brian Gratwicke | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Hyphessobrycon_herbertaxelrodi_Gratwicke.jpg |
| `animals/lemon-tetra-{480,800}.{avif,webp}` | Hyphessobrycon pulchripinnis, tétra citron | Hyphessobrycon pulchripinnis.jpg | Waugsberg | CC BY 2.5 | https://commons.wikimedia.org/wiki/File:Hyphessobrycon_pulchripinnis.jpg |
| `animals/emperor-tetra-{480,800}.{avif,webp}` | Nematobrycon palmeri, tétra empereur | Nematobrycon palmeri lateral view.jpg | AggieFish | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Nematobrycon_palmeri_lateral_view.jpg |
| `animals/congo-tetra-{480,800}.{avif,webp}` | Phenacogrammus interruptus, tétra du Congo | Phenacogrammus interruptus 1.jpg | 7TP (Krzysztof Bartosik) | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Phenacogrammus_interruptus_1.jpg |
| `animals/black-phantom-tetra-{480,800}.{avif,webp}` | Hyphessobrycon megalopterus, tétra fantôme noir | Hyphessobrycon megalopterus (31473-B).png | D. Bork, A. Zarske, H.J. Richter | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Hyphessobrycon_megalopterus_(31473-B).png |
| `animals/oscar-cichlid-{480,800}.{avif,webp}` | Astronotus ocellatus, Oscar | Astronotus ocellatus 2015 G1.jpg | George Chernilevsky | Domaine public | https://commons.wikimedia.org/wiki/File:Astronotus_ocellatus_2015_G1.jpg |
| `animals/jack-dempsey-cichlid-{480,800}.{avif,webp}` | Rocio octofasciata, cichlidé de Jack Dempsey | Jack Dempsey (Rocio octofasciata) - Carwash Cenote QR.jpg | Bernard DUPONT | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Jack_Dempsey_(Rocio_octofasciata)_-_Carwash_Cenote_QR.jpg |
| `animals/parrot-cichlid-{480,800}.{avif,webp}` | Amphilophus citrinellus, cichlidé perroquet | Amphilophus citrinellus 2015 G5.jpg | George Chernilevsky | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Amphilophus_citrinellus_2015_G5.jpg |
| `animals/frontosa-cichlid-{480,800}.{avif,webp}` | Cyphotilapia frontosa, cichlidé frontosa | Cyphotilapia frontosa - Karlsruhe Zoo 01.jpg | H. Zell | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Cyphotilapia_frontosa_-_Karlsruhe_Zoo_01.jpg |
| `animals/zebra-cichlid-{480,800}.{avif,webp}` | Metriaclima zebra, cichlidé zèbre | Maylandia zebra 61728832.jpg | Kai Squires | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Maylandia_zebra_61728832.jpg |
| `animals/yellow-lab-cichlid-{480,800}.{avif,webp}` | Labidochromis caeruleus, cichlidé jaune | Female Labidochromis caeruleus light.jpg | BRKOSLAV SEVERNÍ | CC0 | https://commons.wikimedia.org/wiki/File:Female_Labidochromis_caeruleus_light.jpg |
| `animals/cherry-barb-{480,800}.{avif,webp}` | Puntius titteya, barbu cerise | Cherry barb, Puntius titteya.jpg | Brian Gratwicke | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Cherry_barb,_Puntius_titteya.jpg |
| `animals/tiger-barb-{480,800}.{avif,webp}` | Puntigrus tetrazona, barbu de Sumatra | Tiger barb fish.jpg | Editor General of Wiki | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Tiger_barb_fish.jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 7

Quinze photos vérifiées sur Commons et visuellement, recadrées au format 4:3, converties en AVIF/WebP et optimisées localement.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/red-squirrel-{480,800}.{avif,webp}` | Sciurus vulgaris, écureuil roux européen | Red squirrel (21808).jpg | Rhododendrites | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Red_squirrel_(21808).jpg |
| `animals/raccoon-{480,800}.{avif,webp}` | Procyon lotor, raton laveur | Raccoon in Central Park (35264).jpg | Rhododendrites | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Raccoon_in_Central_Park_(35264).jpg |
| `animals/coati-{480,800}.{avif,webp}` | Nasua nasua, coati | Coati2.jpg | Luna04 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Coati2.jpg |
| `animals/serval-{480,800}.{avif,webp}` | Leptailurus serval, serval | Leptailurus serval 61666728.jpg | datadan | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Leptailurus_serval_61666728.jpg |
| `animals/genet-{480,800}.{avif,webp}` | Genetta genetta, genette | Genetta genetta felina (Wroclaw zoo).JPG | Guérin Nicolas | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Genetta_genetta_felina_(Wroclaw_zoo).JPG |
| `animals/european-otter-{480,800}.{avif,webp}` | Lutra lutra, loutre | European otter 01.jpg | Alexander Leisser | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:European_otter_01.jpg |
| `animals/sugar-glider-{480,800}.{avif,webp}` | Petaurus breviceps, phalanger volant | Petaurus breviceps 119464446.jpg | Greg Tasney | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Petaurus_breviceps_119464446.jpg |
| `animals/flying-squirrel-{480,800}.{avif,webp}` | Pteromys volans, écureuil volant | Pteromys volans 292232567.jpg | Andrew Bazdyrev | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Pteromys_volans_292232567.jpg |
| `animals/chinese-pangolin-{480,800}.{avif,webp}` | Manis pentadactyla, pangolin asiatique | Manis pentadactyla pentadactyla 462300623.jpg | Yung-Lun Lin | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Manis_pentadactyla_pentadactyla_462300623.jpg |
| `animals/alpaca-{480,800}.{avif,webp}` | Vicugna pacos, alpaga | Dülmen, Börnste, Alpakas -- 2020 -- 5462.jpg | Dietmar Rabich | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_B%C3%B6rnste,_Alpakas_--_2020_--_5462.jpg |
| `animals/scarlet-macaw-{480,800}.{avif,webp}` | Ara macao, ara rouge | Scarlet macaw (Ara macao cyanopterus) Copan.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Scarlet_macaw_(Ara_macao_cyanopterus)_Copan.jpg |
| `animals/military-macaw-{480,800}.{avif,webp}` | Ara militaris, ara militaire | Ara militaris - Maroparque 02.jpg | H. Zell | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ara_militaris_-_Maroparque_02.jpg |
| `animals/sulphur-crested-cockatoo-{480,800}.{avif,webp}` | Cacatua galerita, cacatoès à huppe jaune | Sulphur-crested Cockatoo - AndrewMercer - DSC20087.jpg | Andrew Mercer | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Sulphur-crested_Cockatoo_-_AndrewMercer_-_DSC20087.jpg |
| `animals/senegal-parrot-{480,800}.{avif,webp}` | Poicephalus senegalus, perroquet youyou | Poicephalus senegalus, Fulladu West, Gambia 1.jpg | christoph_moning | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Poicephalus_senegalus,_Fulladu_West,_Gambia_1.jpg |
| `animals/european-eagle-owl-{480,800}.{avif,webp}` | Bubo bubo, grand-duc d'Europe | Eurasian eagle-owl (44034).jpg | Rhododendrites | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Eurasian_eagle-owl_(44034).jpg |
| `animals/cardinal-tetra-{480,800}.{avif,webp}` | Paracheirodon axelrodi, néon cardinalis | Cardinal Paracheirodon axelrodi (2).jpg | CHUCAO | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Cardinal_Paracheirodon_axelrodi_(2).jpg |
| `animals/discus-{480,800}.{avif,webp}` | Symphysodon discus, discus | Red discus (Symphysodon discus).jpg | MichalPL | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Red_discus_(Symphysodon_discus).jpg |
| `animals/convict-cichlid-{480,800}.{avif,webp}` | Amatitlania nigrofasciata, cichlidé convict | Convicts Cichlids.jpg | Deanpemberton | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Convicts_Cichlids.jpg |
| `animals/rosy-barb-{480,800}.{avif,webp}` | Pethia conchonius, barbu rosé | Rosy Barbs.jpg | Kkonstan | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Rosy_Barbs.jpg |
| `animals/giant-danio-{480,800}.{avif,webp}` | Devario aequipinnatus, danio géant | Devario aequipinnatus.JPG | Faucon | CC BY-SA 2.5 | https://commons.wikimedia.org/wiki/File:Devario_aequipinnatus.JPG |
| `animals/swordtail-{480,800}.{avif,webp}` | Xiphophorus hellerii, xipho | Xiphophorus hellerii red wagtail female 01.jpg | Wojciech J. Płuciennik | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Xiphophorus_hellerii_red_wagtail_female_01.jpg |
| `animals/sterbai-corydoras-{480,800}.{avif,webp}` | Corydoras sterbai | Corydoras Sterbai.jpg | Matthew Mannell | Domaine public | https://commons.wikimedia.org/wiki/File:Corydoras_Sterbai.jpg |
| `animals/otocinclus-{480,800}.{avif,webp}` | Otocinclus affinis (nom actuellement accepté : Macrotocinclus affinis) | Macrotocinclus affinis looking for algae.jpg | Cisamarc | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Macrotocinclus_affinis_looking_for_algae.jpg |
| `animals/ancistrus-{480,800}.{avif,webp}` | Ancistrus cirrhosus, ancistrus | Ancistrus cirrhosus.jpg | The Last 99 | [CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/) | https://commons.wikimedia.org/wiki/File:Ancistrus_cirrhosus.jpg |
| `animals/butterflyfish-{480,800}.{avif,webp}` | Pantodon buchholzi, poisson-papillon | Pantodon buchholzi 53146715.jpg | John P Friel | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Pantodon_buchholzi_53146715.jpg |
| `animals/archerfish-{480,800}.{avif,webp}` | Toxotes jaculatrix, poisson-archer | Toxotes jaculatrix - 9313.jpg | Amada44 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Toxotes_jaculatrix_-_9313.jpg |
| `animals/elephantnose-fish-{480,800}.{avif,webp}` | Gnathonemus petersii, poisson éléphant | Gnathonemus petersii - Zoo Frankfurt.jpg | Jutta234 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Gnathonemus_petersii_-_Zoo_Frankfurt.jpg |


## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 9

Quinze photos de mammifères et d'oiseaux, chacune vérifiée sur sa page de fichier Commons (HTTP 200), avec auteur et licence libres contrôlés dans les métadonnées. Les sujets et cadrages ont été inspectés sur une planche-contact. Les aperçus 1280 px Commons (HTTP 200) ont été recadrés au format 4:3 et exportés en AVIF/WebP 480/800, chaque fichier restant sous 150 Ko.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/small-clawed-otter-{480,800}.{avif,webp}` | Aonyx cinereus, loutre naine asiatique | Asian small-clawed otter (Aonyx cinereus) in Zooparc de Trégomeur, 2025.jpg | Animalculum | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Asian_small-clawed_otter_(Aonyx_cinereus)_in_Zooparc_de_Tr%C3%A9gomeur,_2025.jpg |
| `animals/american-mink-{480,800}.{avif,webp}` | Neovison vison, vison américain | Mink (Neovison vison).jpg | Marton Berntsen | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Mink_(Neovison_vison).jpg |
| `animals/vizcacha-{480,800}.{avif,webp}` | Lagidium viscacia, viscache des Andes | Bolivian vizcacha.jpg | Alexandre Buisse ( Nattfodd ) | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Bolivian_vizcacha.jpg |
| `animals/pygmy-opossum-{480,800}.{avif,webp}` | Monodelphis domestica, opossum pygmée | Monodelphis domestica 175946692.jpg | Célio Moura Neto | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Monodelphis_domestica_175946692.jpg |
| `animals/harvest-mouse-{480,800}.{avif,webp}` | Micromys minutus, souris des moissons | Harvest mouse and blossom.jpg | Charlie Marshall | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Harvest_mouse_and_blossom.jpg |
| `animals/common-marmoset-{480,800}.{avif,webp}` | Callithrix jacchus, ouistiti | Callithrix jacchus in Parque Bondinho Pão de Açúcar, Rio de Janeiro.jpg | Wilfredor | CC0 | https://commons.wikimedia.org/wiki/File:Callithrix_jacchus_in_Parque_Bondinho_P%C3%A3o_de_A%C3%A7%C3%BAcar,_Rio_de_Janeiro.jpg |
| `animals/agouti-{480,800}.{avif,webp}` | Dasyprocta leporina, agouti | Dasyprocta leporina 46671643.jpg | Paul Prior | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Dasyprocta_leporina_46671643.jpg |
| `animals/mara-{480,800}.{avif,webp}` | Dolichotis patagonum, mara | Dolichotis patagonum 99386074.jpg | Hugo Hulsberg | CC0 | https://commons.wikimedia.org/wiki/File:Dolichotis_patagonum_99386074.jpg |
| `animals/red-shouldered-macaw-{480,800}.{avif,webp}` | Diopsittaca nobilis, ara noble | Red-shouldered Macaw (Diopsittaca nobilis) (Record shot) (28696491836).jpg | Bernard DUPONT  from FRANCE | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Red-shouldered_Macaw_(Diopsittaca_nobilis)_(Record_shot)_(28696491836).jpg |
| `animals/green-cheeked-conure-{480,800}.{avif,webp}` | Pyrrhura molinae, conure à joues vertes | Green-cheeked Parakeet (Pyrrhura molinae molinae), Narciso Campero, Bolivia 1.jpg | sandykeller | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Green-cheeked_Parakeet_(Pyrrhura_molinae_molinae),_Narciso_Campero,_Bolivia_1.jpg |
| `animals/sun-conure-{480,800}.{avif,webp}` | Aratinga solstitialis, conure soleil | Sun parakeet (Aratinga solstitialis) at Perth Zoo, June 2023 06.jpg | Calistemon | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Sun_parakeet_(Aratinga_solstitialis)_at_Perth_Zoo,_June_2023_06.jpg |
| `animals/galah-{480,800}.{avif,webp}` | Eolophus roseicapilla, cacatoès rosalbin | Galah (Eolophus roseicapilla) female in flight Mount Pleasant.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Galah_(Eolophus_roseicapilla)_female_in_flight_Mount_Pleasant.jpg |
| `animals/java-sparrow-{480,800}.{avif,webp}` | Lonchura oryzivora, padda de Java | Java sparrow condo in kihei 7.10.24 DSC 7783-topaz-denoiseraw.jpg | lwolfartist | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Java_sparrow_condo_in_kihei_7.10.24_DSC_7783-topaz-denoiseraw.jpg |
| `animals/northern-cardinal-{480,800}.{avif,webp}` | Cardinalis cardinalis, cardinal rouge | Male northern cardinal in Central Park (52612).jpg | Rhododendrites | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Male_northern_cardinal_in_Central_Park_(52612).jpg |
| `animals/mandarin-duck-{480,800}.{avif,webp}` | Aix galericulata, canard mandarin | Aix galericulata (Male), Richmond Park, UK - May 2013.jpg | Diliff | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Aix_galericulata_(Male),_Richmond_Park,_UK_-_May_2013.jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 8

Treize photos de mammifères et d'oiseaux vérifiées sur leur page de fichier Commons et visuellement. Les téléchargements originaux renvoyaient temporairement HTTP 429; les variantes officielles Commons de 1280 px ont répondu HTTP 200. Les images locales ont été recadrées au format 4:3, redimensionnées aux largeurs indiquées et converties en AVIF/WebP.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/aardvark-{480,800}.{avif,webp}` | Orycteropus afer, oryctérope du Cap | Aardvark (Orycteropus afer).jpg | Theo Kruse / Burgers' Zoo | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Aardvark_(Orycteropus_afer).jpg |
| `animals/kinkajou-{480,800}.{avif,webp}` | Potos flavus, kinkajou | Potos flavus 181925589.jpg | desertnaturalist | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Potos_flavus_181925589.jpg |
| `animals/grey-squirrel-{480,800}.{avif,webp}` | Sciurus carolinensis, écureuil gris | Grey Squirrel Sciurus Carolinensis Autumn Stowe Gardens 2025 01.jpg | Julian Herzog (Website) | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Grey_Squirrel_Sciurus_Carolinensis_Autumn_Stowe_Gardens_2025_01.jpg |
| `animals/cottontop-tamarin-{480,800}.{avif,webp}` | Saguinus oedipus, tamarin | Saguinus oedipus qtl1.jpg | Quartl | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Saguinus_oedipus_qtl1.jpg |
| `animals/caracal-{480,800}.{avif,webp}` | Caracal caracal, caracal | Caracal caracal 289309438.jpg | Dirk Froebel | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Caracal_caracal_289309438.jpg |
| `animals/ocelot-{480,800}.{avif,webp}` | Leopardus pardalis, ocelot | 082 Ocelot in Encontro das Águas State Park Photo by Giles Laurent.jpg | Giles Laurent | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:082_Ocelot_in_Encontro_das_%C3%81guas_State_Park_Photo_by_Giles_Laurent.jpg |
| `animals/binturong-{480,800}.{avif,webp}` | Arctictis binturong, binturong | Arctictis binturong Ménagerie 20250913.jpg | Marie-Lan Taÿ Pamart | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Arctictis_binturong_M%C3%A9nagerie_20250913.jpg |
| `animals/egyptian-mongoose-{480,800}.{avif,webp}` | Herpestes ichneumon, mangouste | Mongoose - Herpestes ichneumon.jpg | Artemy Voikhansky | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Mongoose_-_Herpestes_ichneumon.jpg |
| `animals/crested-porcupine-{480,800}.{avif,webp}` | Hystrix cristata, porc-épic | 0 Hystrix cristata - Porc-épics à crête (1).JPG | Jean-Pol GRANDMONT | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:0_Hystrix_cristata_-_Porc-%C3%A9pics_à_crête_(1).JPG |
| `animals/paca-{480,800}.{avif,webp}` | Cuniculus paca, paca | Cuniculus paca 53854000.jpg | Matt Muir | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Cuniculus_paca_53854000.jpg |
| `animals/turquoise-parrot-{480,800}.{avif,webp}` | Neophema pulchella, perruche turquoisine | Neophema pulchella male - Glen Davis.jpg | JJ Harrison (jjharrison.com.au) | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Neophema_pulchella_male_-_Glen_Davis.jpg |
| `animals/masked-lovebird-{480,800}.{avif,webp}` | Agapornis personatus, inséparable masqué | Agapornis personatus, TZ.jpg | Raf24~commonswiki | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Agapornis_personatus,_TZ.jpg |
| `animals/rainbow-lorikeet-{480,800}.{avif,webp}` | Trichoglossus moluccanus, lori de Swainson | Rainbow lorikeet (Trichoglossus moluccanus) sitting in a hole in a dead tree along the Swan River, October 2023 02.jpg | Calistemon | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Rainbow_lorikeet_(Trichoglossus_moluccanus)_sitting_in_a_hole_in_a_dead_tree_along_the_Swan_River,_October_2023_02.jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 9

Quinze photos de poissons, d'amphibiens et d'invertébrés vérifiées sur leurs pages de fichier Commons et par inspection visuelle. Les miniatures Commons de 1280 px ont été redimensionnées en 480 et 800 px et converties en AVIF/WebP localement.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/orange-clownfish-{480,800}.{avif,webp}` | Amphiprion ocellaris, poisson-clown orange | Amphiprion ocellaris (Clown anemonefish) by Nick Hobgood.jpg | Nick Hobgood | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Amphiprion_ocellaris_(Clown_anemonefish)_by_Nick_Hobgood.jpg |
| `animals/koi-{480,800}.{avif,webp}` | Cyprinus rubrofuscus, koi | Loro Parque Koi3.JPG | Eistreter | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Loro_Parque_Koi3.JPG |
| `animals/dwarf-gourami-{480,800}.{avif,webp}` | Trichogaster lalius, gourami nain (Commons : synonyme Colisa lalia) | Colisa lalia - side (aka).jpg | André Karwath aka Aka | CC BY-SA 2.5 | https://commons.wikimedia.org/wiki/File:Colisa_lalia_-_side_(aka).jpg |
| `animals/australe-killifish-{480,800}.{avif,webp}` | Aphyosemion australe, killie | Aphyosemion australe gold.jpg | Alexander Prokoshev | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Aphyosemion_australe_gold.jpg |
| `animals/glass-catfish-{480,800}.{avif,webp}` | Kryptopterus vitreolus, poisson-chat de verre | Kryptopterus vitreolus.jpg | -serwacy01- | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Kryptopterus_vitreolus.jpg |
| `animals/common-toad-{480,800}.{avif,webp}` | Bufo bufo, crapaud commun | Bufo-bufo-erdkroete-maennlich.jpg | Holger Krisp | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Bufo-bufo-erdkroete-maennlich.jpg |
| `animals/xenopus-{480,800}.{avif,webp}` | Xenopus laevis, xénope lisse | XenopusLaevis 6473.jpg | Davefoc | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:XenopusLaevis_6473.jpg |
| `animals/european-tree-frog-{480,800}.{avif,webp}` | Hyla arborea, rainette à doigts de cuivre | Hyla arborea, juv 2.jpg | Christian Fischer | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Hyla_arborea,_juv_2.jpg |
| `animals/cane-toad-{480,800}.{avif,webp}` | Rhinella marina, crapaud buffle | Rhinella marina near rainwater pools 7th Brigade Park Chermside P1090820.jpg | John Robert McPherson | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Rhinella_marina_near_rainwater_pools_7th_Brigade_Park_Chermside_P1090820.jpg |
| `animals/strawberry-dart-frog-{480,800}.{avif,webp}` | Oophaga pumilio, grenouille de Dart | Oophaga pumilio 33426838.jpg | Lara Maleen Beckmann | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Oophaga_pumilio_33426838.jpg |
| `animals/praying-mantis-{480,800}.{avif,webp}` | Mantis religiosa, mante religieuse | European praying mantis (Mantis religiosa) green female Dobruja.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:European_praying_mantis_(Mantis_religiosa)_green_female_Dobruja.jpg |
| `animals/goliath-tarantula-{480,800}.{avif,webp}` | Theraphosa blondi, tarentule Goliath | Theraphosa blondi 244519965.jpg | Guillaume Delaitre | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Theraphosa_blondi_244519965.jpg |
| `animals/grammostola-rosea-{480,800}.{avif,webp}` | Grammostola rosea, tarentule de Gordon | Spiders Genova - Grammostola rosea 1.jpg | Syrio | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Spiders_Genova_-_Grammostola_rosea_1.jpg |
| `animals/caribbean-hermit-crab-{480,800}.{avif,webp}` | Coenobita clypeatus, bernard-l'ermite terrestre | Coenobita clypeatus 177457464.jpg | Dan Schofield | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Coenobita_clypeatus_177457464.jpg |
| `animals/giant-woodlouse-{480,800}.{avif,webp}` | Porcellio laevis, cloporte géant | Porcellio laevis Rufino cropped.jpg | Stephan Kleinfelder | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Porcellio_laevis_Rufino_cropped.jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 10

Quinze photos de mammifères et d'oiseaux dont le taxon a été vérifié visuellement sur les pages de fichier Commons. Les variantes locales 480/800 px sont fournies en AVIF et WebP.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/llama-{480,800}.{avif,webp}` | Lama glama, lama | Lama glama Laguna Colorada 2.jpg | kallerna | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Lama_glama_Laguna_Colorada_2.jpg |
| `animals/ring-tailed-lemur-{480,800}.{avif,webp}` | Lemur catta, maki catta | Lemur catta 001.jpg | Alex Dunkel ( Maky ) | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Lemur_catta_001.jpg |
| `animals/bennetts-wallaby-{480,800}.{avif,webp}` | Notamacropus rufogriseus, wallaby de Bennett | Macropus rufogriseus rufogriseus Juvenile 2.jpg | JJ Harrison | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Macropus_rufogriseus_rufogriseus_Juvenile_2.jpg |
| `animals/musk-ox-{480,800}.{avif,webp}` | Ovibos moschatus, bœuf musqué | Ovibos moschatus qtl3.jpg | Quartl | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ovibos_moschatus_qtl3.jpg |
| `animals/sika-deer-{480,800}.{avif,webp}` | Cervus nippon, cerf sika | Sika Deer in Nara Park, Japan.jpg | Arczi | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Sika_Deer_in_Nara_Park,_Japan.jpg |
| `animals/fallow-deer-{480,800}.{avif,webp}` | Dama dama, daim | Persian Fallow Deer 1.jpg | Eyal Bartov | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Persian_Fallow_Deer_1.jpg |
| `animals/bourkes-parakeet-{480,800}.{avif,webp}` | Neopsephotus bourkii, perruche de Bourke | Neophema bourkii 121274727.jpg | Kym Nicolson | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Neophema_bourkii_121274727.jpg |
| `animals/lavender-waxbill-{480,800}.{avif,webp}` | Estrilda caerulescens, astrild à pointe | Lavender Waxbill RWD.jpg | DickDaniels | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Lavender_Waxbill_RWD.jpg |
| `animals/japanese-bunting-{480,800}.{avif,webp}` | Emberiza cioides, bruant du Japon | Emberiza cioides male.JPG | Alpsdake | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Emberiza_cioides_male.JPG |
| `animals/diamond-dove-{480,800}.{avif,webp}` | Geopelia cuneata, colombe diamant | Geopelia cuneata -Pilbara, Western Australia, Australia-8 (1).jpg | Jim Bendon | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Geopelia_cuneata_-Pilbara,_Western_Australia,_Australia-8_(1).jpg |
| `animals/mallard-{480,800}.{avif,webp}` | Anas platyrhynchos, canard colvert | Anas platyrhynchos (Male) on the ground.jpg | Commonists | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Anas_platyrhynchos_(Male)_on_the_ground.jpg |
| `animals/wood-duck-{480,800}.{avif,webp}` | Aix sponsa, canard carolin | Wood duck druid ridge cemetery 10.10.20 DSC 6035.jpg | lwolfartist | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Wood_duck_druid_ridge_cemetery_10.10.20_DSC_6035.jpg |
| `animals/japanese-quail-{480,800}.{avif,webp}` | Coturnix japonica, caille du Japon | Japanese Quail.jpg | Ingrid Taylar | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Japanese_Quail.jpg |
| `animals/mute-swan-{480,800}.{avif,webp}` | Cygnus olor, cygne tuberculé | Mute Swan Emsworth2.JPG | Geni | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Mute_Swan_Emsworth2.JPG |
| `animals/toco-toucan-{480,800}.{avif,webp}` | Ramphastos toco, toucan toco | Toco Toucan (Ramphastos toco) - 48153967707.jpg | Bernard DUPONT | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Toco_Toucan_(Ramphastos_toco)_-_48153967707.jpg |

## Fiches d'espèces — photos ajoutées le 2026-10-04, lot 11

Quinze photos supplémentaires d'espèces non illustrées jusqu'ici par une photo exacte. Les fichiers Commons, auteurs, licences et cadrages ont été contrôlés; les variantes locales 480/800 px sont disponibles en AVIF et WebP.

| Fichier(s) | Espèce représentée | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/dendrobates-auratus-{480,800}.{avif,webp}` | Dendrobates auratus, dendrobate à ventre tacheté | Dendrobates auratus - Goldbaumsteiger 203695198.jpg | snail_hiker | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Dendrobates_auratus_-_Goldbaumsteiger_203695198.jpg |
| `animals/dendrobates-azureus-{480,800}.{avif,webp}` | Dendrobates azureus, dendrobate bleu | Dendrobates azureus qtl1.jpg | Quartl | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Dendrobates_azureus_qtl1.jpg |
| `animals/edible-frog-{480,800}.{avif,webp}` | Pelophylax kl. esculentus, grenouille verte | Edible frog (Pelophylax esculentus).jpg | Petar Milošević | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Edible_frog_(Pelophylax_esculentus).jpg |
| `animals/crested-newt-{480,800}.{avif,webp}` | Triturus cristatus, triton crêté | Kammmolchmaennchen.jpg | Rainer Theuer. | Domaine public | https://commons.wikimedia.org/wiki/File:Kammmolchmaennchen.jpg |
| `animals/alpine-newt-{480,800}.{avif,webp}` | Ichthyosaura alpestris, triton alpestre | Bergmolch Ichthyosaura alpestris.jpg | Holger Krisp | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Bergmolch_Ichthyosaura_alpestris.jpg |
| `animals/glass-frog-{480,800}.{avif,webp}` | Hyalinobatrachium valerioi, grenouille de verre | Hyalinobatrachium valerioi 399304213.jpg | Nick Tobler (Cowturtle) | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Hyalinobatrachium_valerioi_399304213.jpg |
| `animals/ameerega-trivittata-{480,800}.{avif,webp}` | Ameerega trivittata, grenouille venimeuse de l'Amazone | Ameerega trivittata 257603527.jpg | Kristof Zyskowski | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Ameerega_trivittata_257603527.jpg |
| `animals/sailfin-molly-{480,800}.{avif,webp}` | Poecilia latipinna, molly voile | Poecilia latipinna 170400954.jpg | Tia Offner | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Poecilia_latipinna_170400954.jpg |
| `animals/blue-gourami-{480,800}.{avif,webp}` | Trichogaster trichopterus, gourami bleu (Commons : Trichopodus trichopterus) | Trichopodus trichopterus (3 spot gourami, Philippines) 01.jpg | Obsidian Soul | CC0 | https://commons.wikimedia.org/wiki/File:Trichopodus_trichopterus_(3_spot_gourami,_Philippines)_01.jpg |
| `animals/cockatoo-cichlid-{480,800}.{avif,webp}` | Apistogramma cacatuoides | Apistogramma cacatuoides.jpg | Redspider | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Apistogramma_cacatuoides.jpg |
| `animals/buenos-aires-tetra-{480,800}.{avif,webp}` | Hyphessobrycon anisitsi, tétras de Buenos Aires (forme albinos) | Hyphessobrycon anisitsi albus.jpg | Astellar87 | Domaine public | https://commons.wikimedia.org/wiki/File:Hyphessobrycon_anisitsi_albus.jpg |
| `animals/orange-knee-tarantula-{480,800}.{avif,webp}` | Brachypelma auratum, tarentule mexicaine à genoux oranges | Spiders Genova - Brachypelma auratum.jpg | Syrio | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Spiders_Genova_-_Brachypelma_auratum.jpg |
| `animals/pinktoe-tarantula-{480,800}.{avif,webp}` | Avicularia avicularia, tarentule à pattes roses | Avicularia avicularia.jpg | BhaalPriestess | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Avicularia_avicularia.jpg |
| `animals/salmon-tarantula-{480,800}.{avif,webp}` | Lasiodora parahybana, tarentule saumonée | Spiders Genova - Lasiodora parahybana.jpg | Syrio | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Spiders_Genova_-_Lasiodora_parahybana.jpg |
| `animals/brown-snail-{480,800}.{avif,webp}` | Helix pomatia, escargot de Bourgogne | Helix pomatia 2026 G1.jpg | George Chernilevsky | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Helix_pomatia_2026_G1.jpg |
