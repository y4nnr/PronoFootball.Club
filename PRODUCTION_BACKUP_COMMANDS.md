# Production Database Backup Commands

## Option 1: Backup avec pg_dump (Recommandé)

```bash
# Créer un backup avec timestamp
pg_dump $DATABASE_URL > backup_before_v3_migration_$(date +%Y%m%d_%H%M%S).sql

# OU si DATABASE_URL n'est pas défini, utilisez les paramètres directement:
pg_dump -h your_host -U your_user -d your_database > backup_before_v3_migration_$(date +%Y%m%d_%H%M%S).sql
```

## Option 2: Backup compressé (pour grandes bases de données)

```bash
pg_dump $DATABASE_URL | gzip > backup_before_v3_migration_$(date +%Y%m%d_%H%M%S).sql.gz
```

## Option 3: Backup avec format custom (permet restauration sélective)

```bash
pg_dump -Fc $DATABASE_URL > backup_before_v3_migration_$(date +%Y%m%d_%H%M%S).dump
```

## Vérification du backup

```bash
# Vérifier la taille du fichier
ls -lh backup_before_v3_migration_*.sql

# Vérifier le contenu (premières lignes)
head -20 backup_before_v3_migration_*.sql
```

## Restauration (si nécessaire)

```bash
# Restaurer depuis un backup SQL
psql $DATABASE_URL < backup_before_v3_migration_YYYYMMDD_HHMMSS.sql

# OU restaurer depuis un backup compressé
gunzip < backup_before_v3_migration_YYYYMMDD_HHMMSS.sql.gz | psql $DATABASE_URL

# OU restaurer depuis un backup custom
pg_restore -d $DATABASE_URL backup_before_v3_migration_YYYYMMDD_HHMMSS.dump
```

## Notes importantes

- Le backup peut prendre plusieurs minutes selon la taille de la base de données
- Assurez-vous d'avoir suffisamment d'espace disque
- Stockez le backup dans un endroit sûr (pas seulement sur le serveur)
- Vérifiez que le backup s'est bien créé avant de continuer
