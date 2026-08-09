# -*- coding: utf-8 -*-
"""Propagation des cles i18n Module C (measurements, vaccinations, carnet)
vers les 6 locales : valeurs FR en placeholder, cles triees, indent 2, CRLF."""
import json
import os

BASE = r'C:/Users/Quent/Documents/Captivia/Captivia/frontend/messages'
LOCALES = ['fr', 'en', 'de', 'es', 'it', 'pt']

MEASUREMENTS = {
    'add': 'Ajouter une mesure',
    'date': 'Date',
    'delete': 'Supprimer',
    'deleteConfirm': 'Supprimer cette mesure ?',
    'edit': 'Modifier la mesure',
    'heightCm': 'Taille (cm)',
    'heightInvalid': 'Taille invalide',
    'noData': 'Aucune mesure enregistrée.',
    'notes': 'Notes',
    'premiumRequired': "Suivi du poids et des mesures disponible avec l'abonnement Premium",
    'title': 'Poids & mesures',
    'weightInvalid': 'Poids invalide',
    'weightKg': 'Poids (kg)',
}

VACCINATIONS = {
    'add': 'Ajouter un vaccin',
    'batchNumber': 'N° de lot',
    'date': 'Date',
    'delete': 'Supprimer',
    'deleteConfirm': 'Supprimer cette vaccination ?',
    'dueSoon': 'Rappel le',
    'edit': 'Modifier le vaccin',
    'name': 'Nom du vaccin',
    'nextDue': 'Prochain rappel',
    'noData': 'Aucune vaccination enregistrée.',
    'notes': 'Notes',
    'overdue': 'Rappel du',
    'premiumRequired': "Carnet de vaccinations disponible avec l'abonnement Premium",
    'title': 'Vaccinations',
    'vetName': 'Vétérinaire',
}

CARNET = {
    'export': 'Exporter le carnet (JSON)',
    'exportError': "Erreur lors de l'export du carnet.",
    'exportSuccess': 'Carnet de santé exporté.',
    'premiumRequired': "L'export du carnet est disponible avec l'abonnement Premium",
}


def sort_dict(d):
    return {k: sort_dict(v) if isinstance(v, dict) else v for k, v in sorted(d.items())}


for loc in LOCALES:
    path = os.path.join(BASE, f'{loc}.json')
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    animals = data.setdefault('animals', {})
    animals['measurements'] = dict(MEASUREMENTS)
    animals['vaccinations'] = dict(VACCINATIONS)
    animals['carnet'] = dict(CARNET)
    data = sort_dict(data)
    raw = json.dumps(data, ensure_ascii=False, indent=2)
    raw = raw.replace('\n', '\r\n') + '\r\n'
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(raw)
    print(f'{loc}.json updated ({len(raw)} bytes)')
