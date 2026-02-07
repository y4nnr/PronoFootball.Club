# Review: Production Scripts Configuration

## 📋 Configuration Actuelle (PM2)

D'après la sortie `pm2 describe`, voici la configuration actuelle :

### 1. `live-score-updater` (ID: 3)
- **Fréquence :** Toutes les 10 secondes (`*/10 * * * * *`)
- **Script :** `/root/dev/PronoFootball.Club/scripts/update_games.sh`
- **Status :** Online (mais 63232 restarts - à investiguer)
- **Uptime :** 1s (redémarre fréquemment)

### 2. `prono-live-worker` (ID: 1)
- **Fréquence :** Continu (pas de cron)
- **Script :** `/root/dev/PronoFootball.Club/scripts/game-status-worker.js`
- **Status :** Online
- **Uptime :** 2 jours
- **Fonction :** Gère les transitions `UPCOMING → LIVE` basées sur la date

---

## ⚠️ Points d'Attention

### 1. **Nombre de Restarts Élevé**

Le processus `live-score-updater` a **63232 restarts**, ce qui indique un problème :

**Causes possibles :**
- Le script se termine avec un code d'erreur
- Le script prend trop de temps (> 10 secondes) et est tué par PM2
- Erreur dans le script bash
- Problème de connexion réseau

**Action requise :**
```bash
# Vérifier les logs
pm2 logs live-score-updater --lines 100

# Vérifier le script
cat /root/dev/PronoFootball.Club/scripts/update_games.sh
```

### 2. **Vérification du Script `update_games.sh`**

Le script doit appeler **3 endpoints** dans l'ordre :

1. ✅ `POST /api/update-live-scores` (Football)
2. ✅ `POST /api/update-live-scores-rugby` (Rugby)
3. ⚠️ **`POST /api/trigger-frontend-refresh`** (CRITIQUE - à vérifier)

**Si l'étape 3 est manquante :**
- Les scores sont mis à jour en DB ✅
- Mais les utilisateurs ne voient pas les changements ❌
- Jusqu'à ce qu'ils rechargent la page manuellement

---

## 🔍 Vérification Requise

### 1. Vérifier le Contenu du Script

Sur le serveur de production, exécutez :
```bash
cat /root/dev/PronoFootball.Club/scripts/update_games.sh
```

**Le script doit contenir :**
```bash
# 1. Update Football
curl -X POST http://localhost:3000/api/update-live-scores

# 2. Update Rugby
curl -X POST http://localhost:3000/api/update-live-scores-rugby

# 3. Trigger frontend refresh (CRITICAL)
curl -X POST http://localhost:3000/api/trigger-frontend-refresh
```

### 2. Vérifier les Logs

```bash
# Logs récents
pm2 logs live-score-updater --lines 50

# Logs d'erreur
pm2 logs live-score-updater --err --lines 50
```

**Cherchez :**
- Messages d'erreur
- Timeouts
- Codes HTTP non-200
- Messages confirmant l'appel à `trigger-frontend-refresh`

### 3. Tester Manuellement

```bash
# Tester chaque endpoint
curl -X POST http://localhost:3000/api/update-live-scores
curl -X POST http://localhost:3000/api/update-live-scores-rugby
curl -X POST http://localhost:3000/api/trigger-frontend-refresh
```

---

## 📝 Script Recommandé

J'ai créé un script d'exemple : `scripts/update_games.sh.example`

**Caractéristiques :**
- ✅ Appelle les 3 endpoints dans l'ordre
- ✅ Gère les erreurs avec `set -e`
- ✅ Logging détaillé avec timestamps
- ✅ Affiche le nombre de jeux mis à jour
- ✅ Affiche le nombre de clients notifiés
- ✅ Utilise `jq` pour parser les réponses JSON

**Pour l'utiliser :**
```bash
# Sur le serveur de production
cp /root/dev/PronoFootball.Club/scripts/update_games.sh.example /root/dev/PronoFootball.Club/scripts/update_games.sh
chmod +x /root/dev/PronoFootball.Club/scripts/update_games.sh

# Redémarrer PM2
pm2 restart live-score-updater
```

---

## 🎯 Délai de Latence Actuel

Avec un scheduler toutes les **10 secondes**, le délai maximum devrait être :

```
Temps de traitement :    740ms - 3.1s
+ Délai scheduler (max) :  10s
─────────────────────────────────────
DÉLAI TOTAL MAXIMUM :     ~10-13 secondes
```

**C'est excellent !** Mais seulement si :
1. ✅ Le script appelle bien `trigger-frontend-refresh`
2. ✅ Le script ne crash pas (problème des 63232 restarts)
3. ✅ Les endpoints répondent rapidement

---

## 🔧 Actions Immédiates

1. **Vérifier le script actuel :**
   ```bash
   cat /root/dev/PronoFootball.Club/scripts/update_games.sh
   ```

2. **Vérifier les logs :**
   ```bash
   pm2 logs live-score-updater --lines 100
   ```

3. **Si le script ne contient pas `trigger-frontend-refresh` :**
   - Ajouter l'appel (voir `scripts/update_games.sh.example`)
   - Redémarrer PM2

4. **Si le script crash :**
   - Vérifier les erreurs dans les logs
   - Corriger le script
   - Tester manuellement avant de redémarrer PM2

---

## 📊 Métriques à Surveiller

Après correction, surveillez :
- **Restarts :** Devrait être proche de 0 (ou seulement lors des redémarrages serveur)
- **Uptime :** Devrait être stable (pas de redémarrages fréquents)
- **Logs :** Devrait montrer des appels réussis toutes les 10 secondes
- **Latence utilisateur :** Les scores devraient apparaître dans les 10-13 secondes
