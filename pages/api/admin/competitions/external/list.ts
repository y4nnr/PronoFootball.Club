import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]";
import { ApiSportsV2 } from "../../../../../lib/api-sports-api-v2";
import { RugbyAPI } from "../../../../../lib/api-rugby-v1";
import { API_CONFIG } from "../../../../../lib/api-config";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  // Check if the user is authenticated and is an admin
  if (!session || typeof session.user !== 'object' || session.user === null || !('role' in session.user) || typeof (session.user as { role: string }).role !== 'string' || (session.user as { role: string }).role.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Only allow V2 API
  if (!API_CONFIG.useV2) {
    return res.status(400).json({ error: "This endpoint is only available with API V2 enabled" });
  }

  try {
    // Get sport type from query parameter (default to FOOTBALL)
    const sportType = (req.query.sportType as string) || 'FOOTBALL';
    const isRugby = sportType === 'RUGBY';
    
    console.log(`[EXTERNAL COMPETITIONS] Fetching competitions for sport: ${sportType} (isRugby: ${isRugby})`);
    
    // Use appropriate API key based on sport type
    // Note: Both may use the same key, but different endpoints (rugby vs football)
    const apiKey = isRugby ? (API_CONFIG.rugbyApiKey || API_CONFIG.apiSportsApiKey) : API_CONFIG.apiSportsApiKey;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: isRugby 
          ? "API-RUGBY or API-FOOTBALL key not configured for Rugby competitions" 
          : "API-FOOTBALL key not configured for Football competitions" 
      });
    }
    
    // Use appropriate API based on sport type (different endpoints even if same key)
    const apiSports = isRugby ? new RugbyAPI(apiKey) : new ApiSportsV2(apiKey);
    
    console.log(`[EXTERNAL COMPETITIONS] Using ${isRugby ? 'RugbyAPI' : 'ApiSportsV2'} with endpoint: ${isRugby ? 'v3.rugby.api-sports.io' : 'v3.football.api-sports.io'}`);
    
    // Get all competitions (no country filter to get everything)
    console.log(`[EXTERNAL COMPETITIONS] Calling getCompetitions() for ${isRugby ? 'Rugby' : 'Football'}`);
    let allCompetitions: any[];
    try {
      allCompetitions = await apiSports.getCompetitions();
    } catch (error) {
      console.error(`[EXTERNAL COMPETITIONS] Error fetching competitions:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Check if it's a rate limit error
      if (errorMessage.includes('request limit') || errorMessage.includes('rate limit')) {
        return res.status(429).json({ 
          error: 'API rate limit exceeded',
          message: 'You have reached the daily request limit for the Rugby API. Please try again tomorrow or upgrade your plan.',
          details: errorMessage
        });
      }
      return res.status(500).json({ 
        error: 'Failed to fetch competitions',
        details: errorMessage
      });
    }
    console.log(`[EXTERNAL COMPETITIONS] Received ${allCompetitions.length} competitions from API`);
    if (allCompetitions.length > 0) {
      console.log(`[EXTERNAL COMPETITIONS] Sample competitions:`, allCompetitions.slice(0, 5).map((c: any) => ({
        id: c.id,
        name: c.name,
        country: c.country
      })));
    }
    
    // Extract unique countries and identify international competitions
    const countriesSet = new Set<string>();
    const internationalCompetitions: any[] = [];
    const localCompetitions: any[] = [];
    
    // Common international competition names/keywords
    const internationalKeywords = [
      'champions league', 'europa league', 'europa conference', 'world cup', 
      'euro', 'copa america', 'africa cup', 'asia cup', 'confederations cup',
      'club world cup', 'super cup', 'nations league', 'olympic', 'fifa',
      'uefa', 'conmebol', 'caf', 'afc', 'concacaf', 'ofc'
    ];
    
    for (const comp of allCompetitions) {
      const compNameLower = comp.name.toLowerCase();
      const isInternational = internationalKeywords.some(keyword => 
        compNameLower.includes(keyword)
      ) || comp.country === '' || comp.country === 'World';
      
      if (isInternational) {
        internationalCompetitions.push(comp);
      } else {
        localCompetitions.push(comp);
        if (comp.country) {
          countriesSet.add(comp.country);
        }
      }
    }
    
    // Sort countries alphabetically
    const countries = Array.from(countriesSet).sort();
    
    // Group competitions by country
    const competitionsByCountry: Record<string, any[]> = {};
    for (const comp of localCompetitions) {
      const country = comp.country || 'Other';
      if (!competitionsByCountry[country]) {
        competitionsByCountry[country] = [];
      }
      competitionsByCountry[country].push(comp);
    }
    
    console.log(`[EXTERNAL COMPETITIONS] Grouped competitions by country. Countries:`, Object.keys(competitionsByCountry));
    if (competitionsByCountry['France']) {
      console.log(`[EXTERNAL COMPETITIONS] France competitions (${competitionsByCountry['France'].length}):`, 
        competitionsByCountry['France'].slice(0, 5).map((c: any) => ({ name: c.name, country: c.country }))
      );
    }
    
    res.status(200).json({ 
      competitions: allCompetitions,
      internationalCompetitions,
      localCompetitions,
      competitionsByCountry,
      countries,
      attribution: apiSports.getAttributionText()
    });
  } catch (error) {
    console.error('Error fetching external competitions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch external competitions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

