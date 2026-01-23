# Logging Migration Guide

This document outlines the migration from `console.log/error/warn` to structured logging using Pino.

## Overview

We've migrated from console logging to structured logging using Pino for better:
- **Production safety**: Sensitive data is automatically redacted
- **Log levels**: Proper debug/info/warn/error levels
- **Structured data**: JSON logs in production, pretty logs in development
- **Performance**: Pino is one of the fastest Node.js loggers

## Logger Usage

### Import the logger

```typescript
import log from '../../lib/logger';
```

### Basic Usage

```typescript
// Debug (only in development)
log.debug('Processing request', { userId: user.id, action: 'login' });

// Info (general information)
log.info('User logged in successfully', { userId: user.id });

// Warning (something unexpected but handled)
log.warn('Rate limit approaching', { userId: user.id, requests: 45 });

// Error (with error object)
log.error('Failed to process payment', error, { userId: user.id, amount: 100 });
```

### Child Loggers (for modules)

For modules that need context on all logs:

```typescript
import log from '../../lib/logger';

const logger = log.child({ service: 'FootballDataAPI' });

// All logs from this logger will include { service: 'FootballDataAPI' }
logger.info('Fetching matches'); // Automatically includes service context
```

## Migration Patterns

### Before (console.log)
```typescript
console.log('[AUTH] User found:', { id: user.id, email: user.email });
console.error('[AUTH] Invalid password for user:', user.email);
```

### After (structured logging)
```typescript
log.debug('User found for authentication', { userId: user.id, email: user.email });
log.warn('Authentication failed: invalid password', { userId: user.id, email: user.email });
```

### Key Changes

1. **Remove prefixes**: No need for `[AUTH]`, `[ADMIN]` etc. - use child loggers or context
2. **Structured data**: Pass objects as second parameter, not string interpolation
3. **Sensitive data**: Email/passwords are automatically redacted
4. **Error objects**: Pass Error objects as second parameter to `log.error()`

## Files Already Migrated

- ✅ `lib/logger.ts` - Logger implementation
- ✅ `lib/api-config.ts` - API configuration
- ✅ `lib/football-data-api.ts` - Football API client
- ✅ `pages/api/auth/[...nextauth].ts` - Authentication
- ✅ `pages/api/admin/users/index.ts` - Admin users API

## Remaining Files to Migrate

To find remaining console statements:

```bash
grep -r "console\.\(log\|error\|warn\)" pages/api lib --exclude-dir=node_modules
```

### Priority Files

1. **High Priority** (production-critical):
   - `pages/api/update-live-scores-v2.ts` (97 console statements)
   - `pages/api/update-live-scores-rugby.ts` (80 console statements)
   - `pages/api/update-live-scores.ts` (33 console statements)
   - `pages/api/generate-news.ts` (8 console statements)

2. **Medium Priority**:
   - All other API routes in `pages/api/`
   - Library files in `lib/`

3. **Low Priority**:
   - Scripts in `scripts/` (can keep console for CLI output)
   - Test/debug files (can keep console)

## Environment Variables

Add to `.env`:

```env
# Log level: debug, info, warn, error
# Default: debug in development, info in production
LOG_LEVEL=info
```

## Production Considerations

- Logs are automatically filtered by level in production
- Sensitive fields (passwords, tokens, API keys) are redacted
- JSON format in production for log aggregation tools
- Pretty format in development for readability

## Best Practices

1. **Use appropriate log levels**:
   - `debug`: Detailed info for debugging (development only)
   - `info`: General informational messages
   - `warn`: Warnings that don't break functionality
   - `error`: Errors that need attention

2. **Include context**:
   ```typescript
   // Good
   log.error('Failed to create user', error, { userId: user.id, email: user.email });
   
   // Bad
   log.error('Failed to create user', error);
   ```

3. **Don't log sensitive data**:
   - Passwords, tokens, API keys are automatically redacted
   - But still avoid logging them in context objects when possible

4. **Use child loggers for modules**:
   ```typescript
   const logger = log.child({ service: 'PaymentService' });
   // All logs automatically include service context
   ```

## Testing

After migration, verify:
1. Logs appear correctly in development (pretty format)
2. Logs are structured JSON in production
3. Sensitive data is redacted
4. Log levels work correctly
