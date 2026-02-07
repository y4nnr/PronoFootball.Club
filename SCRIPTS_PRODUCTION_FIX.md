# Fix: Script de Production `update_games.sh`

## 🔴 Problème Identifié

Le processus PM2 `live-score-updater` a **63232 restarts**, ce qui indique que le script crash à chaque exécution.

**Causes possibles :**
1. Le script se termine avec un code d'erreur (non-0)
2. Le script prend trop de temps (> 10 secondes) et est tué par PM2
3. Erreur dans le script bash (syntaxe, commande manquante, etc.)
4. Problème de connexion réseau

## ✅ Solution : Script Optimisé

J'ai créé un nouveau script `scripts/update_games.sh` qui :

### Caractéristiques

1. **Gestion d'erreurs robuste** :
   - `set -euo pipefail` : Exit sur erreur, variables non définies, échecs de pipe
   - Timeout de 8 secondes par requête (scheduler toutes les 10s)
   - Ne crash pas sur les erreurs non-critiques

2. **Appels aux 3 endpoints requis** :
   - ✅ `POST /api/update-live-scores` (Football)
   - ✅ `POST /api/update-live-scores-rugby` (Rugby)
   - ✅ `POST /api/trigger-frontend-refresh` (CRITIQUE - toujours appelé)

3. **Logging détaillé** :
   - Timestamps sur chaque ligne
   - Messages clairs pour chaque étape
   - Gestion des erreurs avec messages explicites

4. **Robustesse** :
   - Ne crash pas si un endpoint retourne une erreur non-critique
   - Continue même si un endpoint timeout
   - Toujours appelle le refresh frontend (même si les updates échouent)

## 📋 Déploiement

### 1. Copier le Script sur le Serveur

```bash
# Sur votre machine locale (si vous avez accès)
scp scripts/update_games.sh root@srv848550:/root/dev/PronoFootball.Club/scripts/

# OU sur le serveur directement
cd /root/dev/PronoFootball.Club
git pull origin main  # Pour récupérer le nouveau script
```

### 2. Vérifier les Permissions

```bash
chmod +x /root/dev/PronoFootball.Club/scripts/update_games.sh
```

### 3. Tester le Script Manuellement

```bash
# Tester une exécution
/root/dev/PronoFootball.Club/scripts/update_games.sh

# Vérifier les logs
tail -f /root/.pm2/logs/live-score-updater-out.log
tail -f /root/.pm2/logs/live-score-updater-error.log
```

### 4. Redémarrer PM2

```bash
# Redémarrer le processus
pm2 restart live-score-updater

# Vérifier qu'il ne crash plus
pm2 logs live-score-updater --lines 50

# Surveiller les restarts
pm2 describe live-score-updater
```

## 🔍 Vérification

### Vérifier que le Script Fonctionne

```bash
# Vérifier les logs récents
pm2 logs live-score-updater --lines 100

# Vérifier les restarts (devrait rester stable)
pm2 describe live-score-updater
# "restarts" devrait rester à 63232 (ou augmenter très lentement, pas à chaque exécution)

# Vérifier l'uptime (devrait être stable)
pm2 describe live-score-updater
# "uptime" devrait être > 1 minute
```

### Vérifier que les Endpoints Sont Appelés

Les logs devraient montrer :
```
[YYYY-MM-DD HH:MM:SS] 📡 Calling POST http://localhost:3000/api/update-live-scores...
[YYYY-MM-DD HH:MM:SS] ✅ Football: HTTP 200, X game(s) updated
[YYYY-MM-DD HH:MM:SS] 📡 Calling POST http://localhost:3000/api/update-live-scores-rugby...
[YYYY-MM-DD HH:MM:SS] ✅ Rugby: HTTP 200, X game(s) updated
[YYYY-MM-DD HH:MM:SS] 📡 Calling POST http://localhost:3000/api/trigger-frontend-refresh...
[YYYY-MM-DD HH:MM:SS] ✅ Frontend refresh: HTTP 200, X client(s) notified
[YYYY-MM-DD HH:MM:SS] ✅ Update cycle complete
```

## ⚙️ Configuration

### Variables d'Environnement (Optionnel)

Le script utilise des variables d'environnement avec des valeurs par défaut :

```bash
# BASE_URL (défaut: http://localhost:3000)
export BASE_URL="http://localhost:3000"

# TIMEOUT (défaut: 8 secondes)
export TIMEOUT="8"
```

### PM2 Ecosystem (Optionnel)

Si vous voulez configurer les variables d'environnement dans PM2 :

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'live-score-updater',
    script: './scripts/update_games.sh',
    cron_restart: '*/10 * * * * *',
    env: {
      BASE_URL: 'http://localhost:3000',
      TIMEOUT: '8'
    }
  }]
};
```

## 🐛 Dépannage

### Le Script Crash Encore

1. **Vérifier les logs d'erreur** :
   ```bash
   pm2 logs live-score-updater --err --lines 100
   ```

2. **Vérifier que `jq` est installé** :
   ```bash
   which jq
   # Si absent, installer :
   apt-get install jq  # Debian/Ubuntu
   yum install jq      # CentOS/RHEL
   ```

3. **Tester le script manuellement** :
   ```bash
   bash -x /root/dev/PronoFootball.Club/scripts/update_games.sh
   ```

### Les Endpoints Ne Répondent Pas

1. **Vérifier que le serveur Next.js est en cours d'exécution** :
   ```bash
   curl http://localhost:3000/api/health  # Si vous avez un endpoint health
   ```

2. **Vérifier les logs du serveur Next.js** pour voir si les endpoints sont appelés

3. **Vérifier la configuration BASE_URL** :
   ```bash
   # Le script utilise http://localhost:3000 par défaut
   # Si votre serveur écoute sur un autre port, définir BASE_URL
   ```

### Le Refresh Frontend Ne Fonctionne Pas

1. **Vérifier que l'endpoint existe** :
   ```bash
   curl -X POST http://localhost:3000/api/trigger-frontend-refresh
   ```

2. **Vérifier les logs du serveur** pour voir si le broadcast SSE fonctionne

3. **Vérifier que les clients sont connectés** (via les logs du serveur)

## 📊 Métriques à Surveiller

Après le déploiement, surveillez :

- **Restarts** : Devrait rester stable (pas d'augmentation constante)
- **Uptime** : Devrait être > 1 minute (pas de redémarrages fréquents)
- **Logs** : Devrait montrer des appels réussis toutes les 10 secondes
- **Latence utilisateur** : Les scores devraient apparaître dans les 10-13 secondes

## ✅ Checklist de Déploiement

- [ ] Copier le script sur le serveur
- [ ] Vérifier les permissions (`chmod +x`)
- [ ] Tester manuellement le script
- [ ] Vérifier les logs PM2
- [ ] Redémarrer le processus PM2
- [ ] Surveiller les restarts (devrait rester stable)
- [ ] Vérifier que les endpoints sont appelés (via logs)
- [ ] Vérifier que le refresh frontend fonctionne (test utilisateur)
