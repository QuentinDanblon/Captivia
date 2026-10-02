#!/bin/bash
#
# Sauvegarde PostgreSQL de Captivia : dump au format custom (déjà compressé), vérification
# d'intégrité, rotation (14 derniers dumps conservés).
#
# Usage   : DATABASE_URL='<URL Neon DIRECTE>' bash scripts/backup-db.sh
# Produit : backups/captivia-YYYYMMDD-HHMMSS.dump (dossier ignoré par git)
#
# Stratégie :
#   - pg_dump --format=custom --no-owner depuis DATABASE_URL (URL Neon DIRECTE, sans « -pooler ») ;
#   - le paramètre ?schema=… (ajouté par Prisma, refusé par libpq) est retiré de l'URL ;
#     les autres paramètres (sslmode=require, channel_binding…) sont conservés ;
#   - l'URL contient le mot de passe : elle n'est JAMAIS affichée ;
#   - le dump n'est PAS chiffré par ce script : le workflow .github/workflows/backup.yml le
#     chiffre avec age avant tout envoi. Ne jamais stocker un dump en clair hors de la machine.
#
# Version du client : pg_dump doit être de version >= celle du serveur (Neon : PostgreSQL 17
# par défaut) sinon « server version mismatch ».
#
# Restauration : scripts/restore-db.sh (voir docs/RUNBOOK.md §3).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=lib/db-url.sh source-path=SCRIPTDIR
source "$SCRIPT_DIR/lib/db-url.sh"

BACKUP_DIR="$REPO_ROOT/backups"
KEEP=14
DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erreur : DATABASE_URL non fourni." >&2
  exit 1
fi
refuse_pooled_url "$DATABASE_URL"

mkdir -p "$BACKUP_DIR"

OUT="$BACKUP_DIR/captivia-$(date +%Y%m%d-%H%M%S).dump"
TEMP_DUMP="$OUT.tmp"

# Ne jamais laisser de dump partiel (le dump final n'est créé qu'après vérification).
trap 'rm -f "$TEMP_DUMP"' EXIT

CLEAN_URL="$(strip_schema_param "$DATABASE_URL")"

echo "🗄️  Sauvegarde de la base → $OUT"
echo "🐘 pg_dump en format custom (--no-owner), client : $(pg_dump --version)"
pg_dump --format=custom --no-owner --dbname="$CLEAN_URL" --file="$TEMP_DUMP"

echo "🔍 Vérification d'intégrité du dump…"
if ! pg_restore --list "$TEMP_DUMP" >/dev/null; then
  echo "❌ Erreur : dump invalide ou corrompu." >&2
  exit 1
fi
echo "✅ Vérification OK"

mv "$TEMP_DUMP" "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "✅ Sauvegarde terminée : $OUT ($SIZE)"

# Rotation : ne conserver que les $KEEP dumps les plus récents. Les noms contiennent la date
# (AAAAMMJJ-HHMMSS) : l'ordre alphabétique du glob est donc l'ordre chronologique.
shopt -s nullglob
dumps=("$BACKUP_DIR"/captivia-*.dump)
excess=$((${#dumps[@]} - KEEP))
if [ "$excess" -gt 0 ]; then
  for ((i = 0; i < excess; i++)); do
    echo "🧹 Suppression (rotation > $KEEP) : ${dumps[$i]}"
    rm -f "${dumps[$i]}"
  done
fi

echo "📦 Sauvegardes conservées ($KEEP max) : $((${#dumps[@]} - (excess > 0 ? excess : 0)))"
