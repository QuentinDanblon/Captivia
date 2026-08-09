#!/usr/bin/env python3
"""Ajoute les cles i18n Module A (medications, vetAppointments) a fr.json
et propage les cles manquantes aux 5 autres locales (valeur FRANCAISE en placeholder).
Insertion alphabetique parmi les freres, ordre existant preserve, indent 2, CRLF."""
import json
import bisect
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "messages"

NEW_ANIMALS = {
    "medications": {
        "add": "Ajouter un traitement",
        "active": "Actif",
        "delete": "Supprimer",
        "dose": "Dose",
        "endDate": "Date de fin",
        "frequency": "Fréquence",
        "frequencyDaily": "Quotidien",
        "frequencyEveryXHours": "Toutes les X heures",
        "frequencyWeekly": "Hebdomadaire",
        "inactive": "Arrêté",
        "intervalHours": "Intervalle (heures)",
        "name": "Nom du médicament",
        "noData": "Aucun traitement enregistré.",
        "notes": "Notes",
        "premiumRequired": "Traitements médicaux disponibles avec l'abonnement Premium",
        "startDate": "Date de début",
        "stop": "Arrêter",
        "title": "Traitements",
        "unit": "Unité",
    },
    "vetAppointments": {
        "add": "Ajouter un RDV",
        "cancel": "Annuler",
        "date": "Date et heure",
        "delete": "Supprimer",
        "location": "Lieu",
        "markDone": "Marquer fait",
        "noData": "Aucun rendez-vous vétérinaire.",
        "notes": "Notes",
        "reason": "Motif",
        "reminderJ1": "Rappel J-1",
        "reminderJ7": "Rappel J-7",
        "reminders": "Rappels",
        "statusCancelled": "Annulé",
        "statusDone": "Fait",
        "statusScheduled": "À venir",
        "title": "RDV vétérinaires",
        "vetName": "Vétérinaire",
    },
}


# Cles restaurees : presentes dans le working tree avant checkout (travail precedent non committe)
RESTORE = {
    "animals": {
        "nameRequired": "Le nom est obligatoire.",
        "deleteHealthRecord": "Supprimer l'entrée du carnet de santé",
    },
    "premiumLock": {
        "qrCodeError": "Impossible de générer le QR code. Vérifiez votre connexion.",
    },
    "notifications": {
        "comingSoon": "Bientôt disponible",
    },
}


def insert_sorted(dst: dict, key: str, value) -> None:
    """Insere key/value dans dst en position alphabetique (les cles existantes
    sont deja triees) sans reordonner les autres cles."""
    if key in dst:
        return
    keys = list(dst.keys())
    idx = bisect.bisect_left(keys, key)
    new = {}
    for i, k in enumerate(keys):
        if i == idx:
            new[key] = value
        new[k] = dst[k]
    if idx >= len(keys):
        new[key] = value
    dst.clear()
    dst.update(new)


def merge_missing(src: dict, dst: dict) -> None:
    """Ajoute recursivement dans dst toutes les cles de src manquantes (valeur src)."""
    for k, v in src.items():
        if k not in dst:
            insert_sorted(dst, k, v)
        elif isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge_missing(v, dst[k])


def dump(path: Path, data: dict) -> None:
    text = json.dumps(data, ensure_ascii=False, indent=2).replace("\n", "\r\n")
    path.write_bytes((text + "\r\n").encode("utf-8"))


# 1) fr.json : insertion des nouvelles sections + restauration des cles manquantes
fr_path = BASE / "fr.json"
fr = json.loads(fr_path.read_text(encoding="utf-8"))
merge_missing(RESTORE, fr)
animals = fr.setdefault("animals", {})
for section, payload in NEW_ANIMALS.items():
    if section not in animals:
        insert_sorted(animals, section, payload)
    else:
        # met a jour les valeurs manquantes dans la section existante
        merge_missing(payload, animals[section])
dump(fr_path, fr)
print("fr.json OK")

# 2) propagation aux autres locales (valeur francaise en placeholder)
for loc in ["de", "es", "it", "pt", "en"]:
    p = BASE / f"{loc}.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    merge_missing(fr, data)
    dump(p, data)
    print(f"{loc}.json OK")
