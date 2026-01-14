import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../auth/[...nextauth]";
import { ApiSportsV2 } from "../../../../../../lib/api-sports-api-v2";
import { RugbyAPI } from "../../../../../../lib/api-rugby-v1";
import { API_CONFIG } from "../../../../../../lib/api-config";

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
    
    // Use appropriate API key based on sport type
    const apiKey = isRugby ? (API_CONFIG.rugbyApiKey || API_CONFIG.apiSportsApiKey) : API_CONFIG.apiSportsApiKey;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: isRugby 
          ? "API-RUGBY or API-FOOTBALL key not configured for Rugby competitions" 
          : "API-FOOTBALL key not configured for Football competitions" 
      });
    }

    const competitionId = parseInt(req.query.id as string);
    if (isNaN(competitionId)) {
      return res.status(400).json({ error: "Invalid competition ID" });
    }

    console.log(`[COMPETITION DETAILS] Fetching details for competition ${competitionId}, sport: ${sportType}`);
    
    // Use appropriate API based on sport type
    const apiSports = isRugby ? new RugbyAPI(apiKey) : new ApiSportsV2(apiKey);
    
    // Get all seasons (for Football, this works; for Rugby, use getAllValidSeasons)
    let seasons: any[] = [];
    let selectedSeason = null;
    
    if (isRugby) {
      // For Rugby, get all valid seasons with calculated dates
      try {
        const rugbyAPI = apiSports as RugbyAPI;
        seasons = await rugbyAPI.getAllValidSeasons(competitionId);
        console.log(`[COMPETITION DETAILS] Found ${seasons.length} valid Rugby seasons`);
        
        // Set the first season (most recent) as default selected
        if (seasons.length > 0) {
          selectedSeason = seasons[0];
          console.log(`[COMPETITION DETAILS] Default selected season:`, selectedSeason);
        }
      } catch (error) {
        console.error(`[COMPETITION DETAILS] Error getting all valid seasons:`, error);
        // Fallback: try getCurrentOrNextSeason
        try {
          selectedSeason = await apiSports.getCurrentOrNextSeason(competitionId);
          console.log(`[COMPETITION DETAILS] Fallback selected season:`, selectedSeason);
        } catch (fallbackError) {
          console.error(`[COMPETITION DETAILS] Error in fallback:`, fallbackError);
        }
      }
    } else {
      // For Football, use existing logic
      try {
        seasons = await apiSports.getCompetitionSeasons(competitionId);
        console.log(`[COMPETITION DETAILS] Found ${seasons.length} seasons`);
      } catch (error) {
        console.warn(`[COMPETITION DETAILS] Error fetching seasons:`, error);
      }
      
      try {
        selectedSeason = await apiSports.getCurrentOrNextSeason(competitionId);
        console.log(`[COMPETITION DETAILS] Selected season:`, selectedSeason);
      } catch (error) {
        console.error(`[COMPETITION DETAILS] Error getting current/next season:`, error);
      }
    }
    
    // Determine if there's an ongoing season
    const now = new Date();
    let isOngoing = false;
    if (selectedSeason && selectedSeason.start && selectedSeason.end) {
      const start = new Date(selectedSeason.start);
      const end = new Date(selectedSeason.end);
      isOngoing = start <= now && now <= end;
    } else if (seasons.length > 0) {
      const ongoingSeason = seasons.find(s => {
        if (!s.start || !s.end) return false;
        const start = new Date(s.start);
        const end = new Date(s.end);
        return start <= now && now <= end;
      });
      isOngoing = !!ongoingSeason;
    }
    
    res.status(200).json({ 
      competitionId,
      seasons,
      selectedSeason: selectedSeason || null,
      isOngoing,
      attribution: apiSports.getAttributionText()
    });
  } catch (error) {
    console.error('Error fetching competition details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch competition details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

