# How to Manually Trigger API V2

## Quick Start

### Step 1: Activate V2 in `.env`

```bash
# In your .env file
API-FOOTBALL="4566def856552f272899067d1ae64d8f"
USE_API_V2=true
```

### Step 2: Restart Your Server

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

### Step 3: Trigger the API

#### Option A: Using curl (Terminal)

```bash
curl -X POST http://localhost:3000/api/update-live-scores \
  -H "Content-Type: application/json"
```

#### Option B: Using the Script

```bash
chmod +x scripts/trigger-api-v2.sh
./scripts/trigger-api-v2.sh
```

#### Option C: Using Browser/Postman

- **URL**: `http://localhost:3000/api/update-live-scores`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**: (empty)

#### Option D: Using Node.js Script

```bash
node scripts/trigger-api-v2.js
```

## Verify V2 is Active

Check the server logs when you start the server. You should see:

```
🔧 API Configuration: Using V2 (api-sports.io)
```

When you trigger the API, you should see:

```
✅ Loaded API V2 handler (api-sports.io)
🔄 Updating live scores with API-Sports.io (V2)...
```

## Expected Response

A successful response should look like:

```json
{
  "success": true,
  "message": "Successfully updated X games with API-Sports.io data",
  "updatedGames": [...],
  "apiVersion": "V2",
  "attribution": "Data provided by api-sports.io"
}
```

## Troubleshooting

### Error: "API V2 handler not available"

**Solution**: The V2 handler file doesn't exist yet. You need to create:
- `pages/api/update-live-scores-v2.ts`

### Error: "USE_API_V2 is enabled but API-FOOTBALL is not set"

**Solution**: Add `API-FOOTBALL=your_key` to your `.env` file.

### Error: "Configuration error"

**Solution**: Check your `.env` file has both:
- `API-FOOTBALL=your_key`
- `USE_API_V2=true`

### Still Using V1?

**Check**:
1. Is `USE_API_V2=true` in `.env`? (not `USE_API_V2="true"` or `USE_API_V2='true'`)
2. Did you restart the server after changing `.env`?
3. Check server logs for: `🔧 API Configuration: Using V1/V2`

## Testing with the Test Games

After creating the test games (Brentford vs Tottenham, Sunderland vs Manchester City):

1. Wait until 21:00 (or set game time to now)
2. Trigger the API V2
3. Check if scores and chronometer are updated

## Production

In production, the API is typically triggered by:
- A cron job / scheduler
- A webhook
- Manual trigger via admin panel

The same endpoint works: `POST /api/update-live-scores`

