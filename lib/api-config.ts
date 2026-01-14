/**
 * API Configuration - Feature Flag System
 * 
 * Simple way to switch between API V1 (football-data.org) and V2 (api-sports.io)
 * 
 * Usage:
 * - Set USE_API_V2=true in .env to use V2
 * - Set USE_API_V2=false or omit to use V1 (default)
 * 
 * This allows easy switching without code changes
 */

export const API_CONFIG = {
  // Feature flag: true = use V2 (api-sports.io), false = use V1 (football-data.org)
  useV2: process.env.USE_API_V2 === 'true',
  
  // API Keys
  footballDataApiKey: process.env.FOOTBALL_DATA_API_KEY,
  apiSportsApiKey: process.env['API-FOOTBALL'], // Note: hyphen in env var name
  rugbyApiKey: process.env['API-RUGBY'], // Rugby API key (can be same as API-FOOTBALL)
  
  // Logging
  get activeVersion(): 'V1' | 'V2' {
    return this.useV2 ? 'V2' : 'V1';
  },
  
  // Validation
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (this.useV2) {
      if (!this.apiSportsApiKey) {
        errors.push('USE_API_V2 is enabled but API-FOOTBALL is not set');
      }
    } else {
      if (!this.footballDataApiKey) {
        errors.push('USE_API_V2 is disabled but FOOTBALL_DATA_API_KEY is not set');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Log current configuration on module load
if (process.env.NODE_ENV !== 'test') {
  console.log(`🔧 API Configuration: Using ${API_CONFIG.activeVersion} (${API_CONFIG.useV2 ? 'api-sports.io' : 'football-data.org'})`);
  
  const validation = API_CONFIG.validate();
  if (!validation.valid) {
    console.error('❌ API Configuration errors:', validation.errors);
  }
}

