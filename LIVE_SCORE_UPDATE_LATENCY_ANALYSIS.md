# Analyse de Latence : Mise à Jour des Scores en Direct

## 📋 Résumé Exécutif

Cette analyse détaille le temps nécessaire pour qu'une mise à jour de l'API provider (api-sports.io) soit visible dans les cartes de jeu sur le dashboard.

**Délai total estimé : 30-60 secondes** (selon la configuration du scheduler)

---

## 🔄 Flux de Données Complet

### Étape 1 : Mise à Jour depuis l'API Provider → Base de Données

**Endpoint appelé :** `POST /api/update-live-scores` (Football) ou `POST /api/update-live-scores-rugby` (Rugby)

**Fréquence :** Dépend de la configuration du scheduler externe (cron job)
- **Typique :** Toutes les 30 secondes à 2 minutes
- **Recommandé :** Toutes les 30 secondes pour des mises à jour quasi-temps réel

**Processus :**
1. Le scheduler externe appelle l'endpoint de mise à jour
2. L'endpoint vérifie s'il y a des jeux `LIVE` dans la DB
3. Si oui, appelle l'API provider (api-sports.io)
4. Compare les données et met à jour la base de données PostgreSQL
5. **⚠️ IMPORTANT :** L'endpoint ne déclenche PAS automatiquement le refresh frontend

**Temps estimé :**
- Appel API provider : 500ms - 2s (selon le nombre de jeux)
- Mise à jour DB : 100ms - 500ms
- **Total Étape 1 : 600ms - 2.5s**

---

### Étape 2 : Déclenchement du Refresh Frontend (SSE)

**Endpoint appelé :** `POST /api/trigger-frontend-refresh`

**⚠️ PROBLÈME IDENTIFIÉ :** 
- Les endpoints `update-live-scores` et `update-live-scores-rugby` **ne déclenchent PAS automatiquement** le refresh frontend
- Le scheduler doit appeler **séparément** `/api/trigger-frontend-refresh` après avoir mis à jour les scores
- Si cette étape est oubliée, les utilisateurs ne verront pas les mises à jour jusqu'au prochain refresh manuel ou SSE

**Processus :**
1. Le scheduler appelle `/api/trigger-frontend-refresh` après avoir mis à jour les scores
2. L'endpoint envoie un signal SSE à tous les clients connectés via `broadcastGameCardsRefresh()`
3. Le signal est envoyé instantanément via Server-Sent Events (SSE)

**Temps estimé :**
- Appel endpoint : 10ms - 50ms
- Broadcast SSE : < 10ms (instantané pour les clients connectés)
- **Total Étape 2 : 10ms - 60ms**

---

### Étape 3 : Réception du Signal SSE → Refresh Frontend

**Composant :** `hooks/useLiveScores.ts`

**Processus :**
1. Le client reçoit le signal SSE via `EventSource('/api/refresh-games-cards')`
2. Le hook `useLiveScores` détecte le signal et appelle `checkLiveScores()`
3. `checkLiveScores()` appelle la fonction `refreshGameData` du dashboard

**Temps estimé :**
- Réception SSE : < 10ms (instantané)
- Détection du signal : < 10ms
- **Total Étape 3 : < 20ms**

---

### Étape 4 : Fetch des Données Mises à Jour

**Endpoints appelés :**
- `GET /api/user/dashboard-betting-games` (pour les jeux à venir)
- `GET /api/user/games-of-day` (pour les matchs du jour)

**Processus :**
1. Le dashboard appelle les deux endpoints en parallèle (`Promise.all`)
2. Les endpoints interrogent la base de données PostgreSQL
3. Les données sont retournées au frontend

**Temps estimé :**
- Requête DB : 50ms - 200ms
- Sérialisation JSON : 10ms - 50ms
- Réseau (client → serveur) : 50ms - 200ms (selon la latence)
- **Total Étape 4 : 110ms - 450ms**

---

### Étape 5 : Mise à Jour de l'UI

**Composant :** `pages/dashboard.tsx`

**Processus :**
1. Les données sont reçues et mises à jour dans le state React
2. React re-render les composants affectés
3. Les cartes de jeu sont mises à jour visuellement

**Temps estimé :**
- Mise à jour state : < 10ms
- Re-render React : 10ms - 50ms
- **Total Étape 5 : 10ms - 60ms**

---

## ⏱️ Délai Total

### Scénario Optimal (Scheduler toutes les 30 secondes)

```
Étape 1 : Mise à jour DB         600ms - 2.5s
Étape 2 : Broadcast SSE           10ms - 60ms
Étape 3 : Réception SSE           < 20ms
Étape 4 : Fetch données           110ms - 450ms
Étape 5 : Mise à jour UI          10ms - 60ms
─────────────────────────────────────────────
Temps de traitement :              740ms - 3.1s

+ Délai scheduler (max) :          30s
─────────────────────────────────────────────
DÉLAI TOTAL MAXIMUM :              ~30-33 secondes
```

### Scénario Typique (Scheduler toutes les 2 minutes)

```
Temps de traitement :              740ms - 3.1s
+ Délai scheduler (max) :          120s
─────────────────────────────────────────────
DÉLAI TOTAL MAXIMUM :              ~120-123 secondes (2 minutes)
```

---

## 🔍 Points d'Attention

### 1. **Dépendance au Scheduler Externe**

Le délai principal dépend de la fréquence d'appel du scheduler :
- **30 secondes** : Délai max ~30-33 secondes ✅ Recommandé
- **2 minutes** : Délai max ~2 minutes ⚠️ Acceptable mais moins réactif
- **5 minutes** : Délai max ~5 minutes ❌ Trop lent pour du "live"

### 2. **Refresh Frontend Non Automatique**

**⚠️ CRITIQUE :** Les endpoints `update-live-scores` ne déclenchent PAS automatiquement le refresh frontend.

**Solution requise :**
Le scheduler doit appeler **deux endpoints** :
```bash
# 1. Mettre à jour les scores
POST /api/update-live-scores
POST /api/update-live-scores-rugby

# 2. Déclencher le refresh frontend
POST /api/trigger-frontend-refresh
```

**Si cette étape est oubliée :**
- Les scores sont mis à jour dans la DB ✅
- Mais les utilisateurs ne voient pas les changements ❌
- Jusqu'à ce qu'ils rechargent la page manuellement ou qu'un autre signal SSE soit envoyé

### 3. **SSE Connection Status**

Le système utilise Server-Sent Events (SSE) pour notifier les clients :
- **Avantage :** Pas de polling côté client, économise la bande passante
- **Inconvénient :** Si la connexion SSE est perdue, l'utilisateur ne recevra pas les mises à jour
- **Fallback :** Le hook `useLiveScores` a un fallback qui fetch `/api/user/games-of-day` si la fonction refresh n'est pas disponible

### 4. **Cache et Headers**

Les endpoints utilisent `cache: 'no-store'` pour éviter le cache :
- ✅ `/api/user/dashboard-betting-games` : `cache: 'no-store'`
- ✅ `/api/user/games-of-day` : `cache: 'no-store'`
- ✅ `/api/update-live-scores` : Headers `Cache-Control: no-store`

**Pas de problème de cache identifié.**

---

## 📊 Recommandations

### 1. **Optimiser la Fréquence du Scheduler**

**Recommandation :** Appeler les endpoints toutes les **30 secondes** pendant les matchs en direct.

**Justification :**
- Les matchs de football/rugby évoluent rapidement
- 30 secondes est un bon compromis entre réactivité et charge serveur
- Les API providers (api-sports.io) supportent cette fréquence

### 2. **Automatiser le Refresh Frontend**

**Recommandation :** Modifier les endpoints `update-live-scores` pour déclencher automatiquement le refresh frontend.

**Code suggéré :**
```typescript
// Dans update-live-scores-v2.ts et update-live-scores-rugby.ts
// Après avoir mis à jour les jeux, ajouter :

if (updatedGames.length > 0) {
  try {
    const { broadcastGameCardsRefresh } = await import('./refresh-games-cards');
    broadcastGameCardsRefresh();
    console.log('✅ Frontend refresh triggered automatically');
  } catch (error) {
    console.error('⚠️ Failed to trigger frontend refresh:', error);
    // Ne pas faire échouer la requête si le refresh échoue
  }
}
```

**Avantages :**
- ✅ Pas besoin d'appeler `/api/trigger-frontend-refresh` séparément
- ✅ Moins de risque d'oubli
- ✅ Refresh automatique dès qu'il y a des mises à jour

### 3. **Monitoring et Logs**

**Recommandation :** Ajouter des logs pour tracer le délai total.

**Métriques à suivre :**
- Temps entre l'appel API provider et la mise à jour DB
- Temps entre la mise à jour DB et le signal SSE
- Temps entre le signal SSE et le refresh frontend
- Nombre de clients connectés via SSE

### 4. **Fallback pour SSE Perdu**

**Recommandation :** Ajouter un polling de secours si la connexion SSE est perdue.

**Code suggéré :**
```typescript
// Dans useLiveScores.ts
useEffect(() => {
  if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
    // Fallback: Polling toutes les 60 secondes si SSE est perdu
    const fallbackInterval = setInterval(() => {
      checkLiveScores();
    }, 60000);
    return () => clearInterval(fallbackInterval);
  }
}, [connectionStatus, checkLiveScores]);
```

---

## 🎯 Conclusion

**Délai actuel : 30-120 secondes** (selon la configuration du scheduler)

**Bottleneck principal :** La fréquence d'appel du scheduler externe

**Améliorations possibles :**
1. ✅ Réduire l'intervalle du scheduler à 30 secondes
2. ✅ Automatiser le refresh frontend dans les endpoints de mise à jour
3. ✅ Ajouter un fallback polling si SSE est perdu
4. ✅ Monitoring des métriques de latence

**Impact attendu :** Réduction du délai à **30-35 secondes maximum** avec les optimisations.
