# 🧪 Tâches de Test - Ce Soir

## 📋 Checklist de Test

### 1. ⚽ Test API Football - Scores en Direct & Chronomètre (CE SOIR - Ligue 1)

#### Préparation
- [ ] Vérifier que le match Ligue 1 est dans la base de données avec `status: 'UPCOMING'`
- [ ] Vérifier que le match a un `externalId` (si déjà importé)
- [ ] Vérifier que `USE_API_V2=true` dans `.env` (pour utiliser api-sports.io)

#### Pendant le Match
- [ ] **Déclencher l'API Football manuellement** :
  ```bash
  curl -X POST http://localhost:3000/api/update-live-scores
  ```
  Ou depuis le navigateur : `POST /api/update-live-scores`

- [ ] **Vérifier dans les logs serveur** :
  - [ ] Les matchs en direct sont récupérés depuis l'API (api-sports.io V2)
  - [ ] Les scores sont mis à jour (`liveHomeScore`, `liveAwayScore`)
  - [ ] Le chronomètre est mis à jour (`elapsedMinute`)
  - [ ] Le statut est mis à jour (`status: LIVE`, `externalStatus: HT, 1H, 2H, etc.`)

- [ ] **Vérifier dans la base de données** :
  - [ ] `liveHomeScore` et `liveAwayScore` sont mis à jour
  - [ ] `elapsedMinute` est mis à jour (ex: 45, 60, etc.)
  - [ ] `status` passe de `UPCOMING` à `LIVE`
  - [ ] `externalStatus` est mis à jour (HT, 1H, 2H, etc.)

- [ ] **Vérifier dans l'UI Dashboard** :
  - [ ] Le badge "Live" apparaît sur la carte du match
  - [ ] Le chronomètre s'affiche (ex: "45'")
  - [ ] Les scores en direct s'affichent
  - [ ] Le statut "HT" s'affiche correctement pendant la mi-temps

#### Après le Match
- [ ] **Déclencher l'API Football à nouveau** :
  ```bash
  curl -X POST http://localhost:3000/api/update-live-scores
  ```

- [ ] **Vérifier** :
  - [ ] Le statut passe de `LIVE` à `FINISHED`
  - [ ] Les scores finaux sont mis à jour (`homeScore`, `awayScore`)
  - [ ] Les points des paris sont calculés automatiquement
  - [ ] Le match n'apparaît plus comme "Live" dans l'UI

---

### 2. 🏉 Test API Rugby - Scores en Direct & Chronomètre (DEMAIN)

#### Préparation
- [ ] Vérifier qu'un match Rugby est prévu demain
- [ ] Vérifier que le match est dans la base de données avec `status: 'UPCOMING'`
- [ ] Vérifier que le match a un `externalId` (si déjà importé)

#### Pendant le Match (Demain)
- [ ] **Déclencher l'API Rugby manuellement** :
  ```bash
  curl -X POST http://localhost:3000/api/update-live-scores-rugby
  ```
  Ou depuis le navigateur : `POST /api/update-live-scores-rugby`

- [ ] **Vérifier dans les logs serveur** :
  - [ ] Les matchs en direct sont récupérés depuis l'API
  - [ ] Les scores sont mis à jour (`liveHomeScore`, `liveAwayScore`)
  - [ ] Le chronomètre est mis à jour (`elapsedMinute`)
  - [ ] Le statut est mis à jour (`status: LIVE`, `externalStatus: HT, 1H, 2H, etc.`)

- [ ] **Vérifier dans la base de données** :
  - [ ] `liveHomeScore` et `liveAwayScore` sont mis à jour
  - [ ] `elapsedMinute` est mis à jour (ex: 45, 60, etc.)
  - [ ] `status` passe de `UPCOMING` à `LIVE`
  - [ ] `externalStatus` est mis à jour (HT, 1H, 2H, etc.)

- [ ] **Vérifier dans l'UI Dashboard** :
  - [ ] Le badge "Live" apparaît sur la carte du match
  - [ ] Le chronomètre s'affiche (ex: "45'")
  - [ ] Les scores en direct s'affichent
  - [ ] Le statut "HT" s'affiche correctement pendant la mi-temps

#### Après le Match (Demain)
- [ ] **Déclencher l'API Rugby à nouveau** :
  ```bash
  curl -X POST http://localhost:3000/api/update-live-scores-rugby
  ```

- [ ] **Vérifier** :
  - [ ] Le statut passe de `LIVE` à `FINISHED`
  - [ ] Les scores finaux sont mis à jour (`homeScore`, `awayScore`)
  - [ ] Les points des paris sont calculés automatiquement
  - [ ] Le match n'apparaît plus comme "Live" dans l'UI

---

### 3. 📰 Test Génération de News - Multi-Compétitions

#### Préparation
- [ ] Vérifier que vous avez au moins 2 compétitions actives
- [ ] Vérifier que des matchs sont terminés (`status: FINISHED`) pour chaque compétition
- [ ] Vérifier que tous les matchs d'une journée sont finis (condition pour générer les news)

#### Génération des News
- [ ] **Déclencher la génération de news** :
  ```bash
  curl -X GET "http://localhost:3000/api/generate-news?generate=true"
  ```
  Ou depuis le navigateur : `GET /api/generate-news?generate=true`

- [ ] **Vérifier dans les logs serveur** :
  - [ ] Les compétitions actives sont détectées
  - [ ] Les matchs finis sont trouvés pour chaque compétition
  - [ ] Les news sont générées pour chaque compétition (si conditions remplies)
  - [ ] Les news sont stockées en base de données

- [ ] **Vérifier dans la base de données** :
  ```sql
  SELECT * FROM "News" ORDER BY "matchDayDate" DESC;
  ```
  - [ ] Des news existent pour chaque compétition active
  - [ ] Maximum 2 news par compétition (les 2 dernières)

#### Affichage dans le Widget
- [ ] **Rafraîchir le dashboard** et vérifier :
  - [ ] Le widget News affiche les news de toutes les compétitions actives
  - [ ] Maximum 8 news au total (2 par compétition, jusqu'à 4 compétitions)
  - [ ] Les news sont triées par date (plus récentes en premier)
  - [ ] Chaque news affiche le logo et le nom de la compétition
  - [ ] Le bouton "Voir plus" fonctionne et mène à `/news`

#### Page Complète des News
- [ ] **Aller sur `/news`** et vérifier :
  - [ ] Toutes les news de toutes les compétitions sont affichées
  - [ ] Les news sont groupées par date
  - [ ] Les dates sont triées (plus récentes en premier)

---

### 4. 🎯 Test Affichage Compétition dans les Cartes

#### Dashboard
- [ ] **Vérifier les cartes de match sur le dashboard** :
  - [ ] Les cartes "Matchs à venir" affichent le logo et nom de la compétition
  - [ ] Les cartes "Matchs du jour" affichent le logo et nom de la compétition
  - [ ] Le logo s'affiche correctement (ou placeholder si absent)

#### Page de Betting
- [ ] **Aller sur `/betting/[id]`** et vérifier :
  - [ ] Les cartes du carousel affichent la compétition (logo + nom)
  - [ ] La compétition est bien visible (taille, style)
  - [ ] La compétition n'apparaît PAS dans l'UI principale (formulaire de pari)

#### Page de Compétition
- [ ] **Aller sur `/competitions/[id]`** et vérifier :
  - [ ] Les cartes de match n'affichent PAS la compétition (normal, on est déjà sur la page de la compétition)

---

## 📝 Commandes Rapides

```bash
# API Football (CE SOIR - Ligue 1)
curl -X POST http://localhost:3000/api/update-live-scores

# API Rugby (DEMAIN)
curl -X POST http://localhost:3000/api/update-live-scores-rugby

# Génération News
curl -X GET "http://localhost:3000/api/generate-news?generate=true"

# Mode Debug News
curl -X GET "http://localhost:3000/api/generate-news?generate=true&debug=true"
```

---

## 🐛 Points d'Attention

### API Live Scores
- ⚠️ **Football** : utiliser `/api/update-live-scores` (route vers V2 si `USE_API_V2=true`)
- ⚠️ **Rugby** : utiliser `/api/update-live-scores-rugby` (endpoint séparé)
- ⚠️ Le chronomètre peut ne pas se mettre à jour en temps réel si l'API externe ne le fait pas
- ⚠️ Vérifier que `externalId` est bien stocké lors de l'import pour des lookups plus fiables

### News
- ⚠️ Les news ne sont générées que si TOUS les matchs d'une journée sont `FINISHED`
- ⚠️ Si OpenAI n'est pas configuré, un fallback simple est utilisé
- ⚠️ Les news sont filtrées par compétitions actives de l'utilisateur connecté

### Compétition dans les Cartes
- ⚠️ Si une compétition n'a pas de logo, un placeholder avec initiales est affiché
- ⚠️ Les noms longs de compétition sont tronqués avec `truncate`

---

## 📝 Notes de Debug

### Mode Debug pour News
```bash
curl -X GET "http://localhost:3000/api/generate-news?generate=true&debug=true"
```

### Vérifier les Logs
- Logs serveur : chercher `[RUGBY API]`, `[GENERATE-NEWS]`, `[UPDATE LOGOS]`
- Logs frontend : console du navigateur pour les erreurs d'affichage

### Commandes Utiles
```bash
# API Football (Ligue 1 ce soir)
curl -X POST http://localhost:3000/api/update-live-scores

# API Rugby (demain)
curl -X POST http://localhost:3000/api/update-live-scores-rugby

# Vérifier les matchs en base
npx prisma studio

# Vérifier les news en base
SELECT * FROM "News" ORDER BY "matchDayDate" DESC LIMIT 10;

# Vérifier les compétitions actives
SELECT id, name, status FROM "Competition" WHERE status IN ('ACTIVE', 'UPCOMING');
```

---

## ✅ Critères de Succès

### Ce Soir (Football)
- [ ] ✅ Les scores Football (Ligue 1) se mettent à jour en direct
- [ ] ✅ Le chronomètre Football s'affiche et se met à jour
- [ ] ✅ Les news sont générées pour toutes les compétitions actives
- [ ] ✅ Le widget News affiche jusqu'à 8 news (2 par compétition)
- [ ] ✅ Les cartes de match affichent la compétition correctement

### Demain (Rugby)
- [ ] ✅ Les scores Rugby se mettent à jour en direct
- [ ] ✅ Le chronomètre Rugby s'affiche et se met à jour

### Général
- [ ] ✅ Aucune erreur dans les logs serveur
- [ ] ✅ Aucune erreur dans la console du navigateur

