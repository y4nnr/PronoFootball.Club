/**
 * OpenAI Team Matcher
 * 
 * Uses OpenAI to match team names when rule-based matching fails or has low confidence.
 * This is a fallback mechanism for edge cases where team names have variations,
 * abbreviations, or different naming conventions.
 */

interface Team {
  id: string;
  name: string;
  shortName?: string | null;
}

interface TeamMatch {
  external: string;
  db: Team | null;
  confidence: number;
  reasoning?: string;
}

interface MatchRequest {
  // External API data
  externalHome: string;
  externalAway: string;
  externalDate: string | null;
  externalCompetition: string | null;
  
  // Our database games to match against
  dbGames: Array<{
    id: string;
    homeTeam: { id: string; name: string; shortName?: string | null };
    awayTeam: { id: string; name: string; shortName?: string | null };
    date: string | null;
    competition: { name: string };
  }>;
  
  // All available teams (for backward compatibility and team matching)
  dbTeams: Team[];
}

// Simple in-memory cache (could be upgraded to Redis in production)
const matchCache = new Map<string, MatchResult>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(externalHome: string, externalAway: string, externalDate: string | null, dbGameIds: string[]): string {
  const sortedIds = [...dbGameIds].sort().join(',');
  const dateStr = externalDate ? externalDate.split('T')[0] : 'no-date';
  return `${externalHome}|${externalAway}|${dateStr}|${sortedIds}`;
}

/**
 * Match teams using OpenAI as a fallback
 * Batches multiple matches in a single API call for efficiency
 */
export async function matchTeamsWithOpenAI(
  requests: MatchRequest[],
  apiKey: string | null
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>();

  if (!apiKey || requests.length === 0) {
      // Return null matches if no API key
      requests.forEach(req => {
        results.set(`${req.externalHome}|${req.externalAway}`, {
          gameId: null,
          homeMatch: null,
          awayMatch: null,
          overallConfidence: null,
        });
      });
    return results;
  }

  // Check cache first
  const uncachedRequests: MatchRequest[] = [];
  const cacheKeys: string[] = [];

  for (const req of requests) {
    const dbGameIds = req.dbGames.map(g => g.id).sort();
    const cacheKey = getCacheKey(req.externalHome, req.externalAway, req.externalDate, dbGameIds);
    cacheKeys.push(cacheKey);

    const cached = matchCache.get(cacheKey);
    if (cached) {
      results.set(`${req.externalHome}|${req.externalAway}`, cached);
    } else {
      uncachedRequests.push(req);
    }
  }

  if (uncachedRequests.length === 0) {
    return results; // All from cache
  }

  // Batch all uncached requests in a single API call
  try {
    // Build the prompt with full game context
    const matchPairs = uncachedRequests.map((req, idx) => {
      const externalDateStr = req.externalDate 
        ? new Date(req.externalDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Date unknown';
      
      const dbGamesText = req.dbGames.map((game, gameIdx) => {
        const gameDateStr = game.date 
          ? new Date(game.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
          : 'Date unknown';
        return `    Game ${gameIdx + 1}: "${game.homeTeam.name}" vs "${game.awayTeam.name}"\n` +
               `      Competition: ${game.competition.name}\n` +
               `      Date/Time: ${gameDateStr}\n` +
               `      Game ID: ${game.id}`;
      }).join('\n');
      
      return `${idx + 1}. External API Match:\n` +
             `   Teams: "${req.externalHome}" vs "${req.externalAway}"\n` +
             `   Competition: ${req.externalCompetition || 'Unknown'}\n` +
             `   Date/Time: ${externalDateStr}\n` +
             `   \n` +
             `   Our Database Games to match against:\n${dbGamesText}`;
    }).join('\n\n');

    const prompt = `You are a game matching assistant for a sports betting platform.

I need you to determine if an external API match corresponds to one of our database games. You must consider ALL factors: team names, date/time, and competition.

For each external API match, compare it with our database games and determine:
1. Which database game (if any) matches the external API match
2. The confidence level (0.0-1.0) that they are the same game
3. Which teams from the external API correspond to which teams in the database game

External API Matches and Our Database Games:
${matchPairs}

For each external API match, return a JSON array with this exact format:
[
  {
    "pair": 1,
    "gameId": "database-game-id-if-matched-or-null",
    "homeMatch": {"name": "exact database team name", "confidence": 0.0-1.0},
    "awayMatch": {"name": "exact database team name", "confidence": 0.0-1.0},
    "overallConfidence": 0.0-1.0,
    "reasoning": "brief explanation of why this match was chosen or rejected"
  },
  ...
]

Rules:
- Match confidence should be 0.0-1.0 (1.0 = perfect match, 0.0 = no match)
- Only return matches with overallConfidence >= 0.6 (60%) - lowered threshold for testing
- Consider ALL factors together: team names, date/time (within same day is good, same hour is better), and competition name
- If teams match but date is very different (>7 days), reject the match (likely different season/game)
- If teams match but competition is clearly different, reject the match
- Use exact database team names (case-sensitive) from the game you matched
- Consider abbreviations, nicknames, and common variations in team names
- If no good match with overallConfidence >= 0.6, set gameId to null and matches to null
- Be very confident in your matches - this is critical for a betting platform
- Return ONLY valid JSON, no other text

Return the JSON array now:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using same model as news generation
        temperature: 0.1, // Low temperature for consistent matching
        max_tokens: 2000, // Enough for multiple matches
        messages: [
          {
            role: 'system',
            content: 'You are a precise team name matching assistant. Return only valid JSON arrays.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', errorText);
      console.error(`❌ OpenAI API status: ${response.status}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices?: { message?: { content?: string | null } }[];
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    console.log(`📝 OpenAI raw response length: ${content?.length || 0} characters`);
    if (!content) {
      console.error('❌ OpenAI returned empty response');
      console.error('❌ OpenAI response data:', JSON.stringify(data, null, 2));
      throw new Error('Empty response from OpenAI');
    }

    // Parse JSON response (handle markdown code blocks if present)
    let jsonContent = content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
      console.log(`📝 Extracted JSON from OpenAI response (${jsonContent.length} chars)`);
    } else {
      console.log(`⚠️ No JSON array found in OpenAI response, using full content`);
    }

    let aiMatches: Array<{
      pair: number;
      gameId: string | null;
      homeMatch: { name: string; confidence: number } | null;
      awayMatch: { name: string; confidence: number } | null;
      overallConfidence: number | null;
      reasoning?: string;
    }>;
    
    try {
      aiMatches = JSON.parse(jsonContent) as Array<{
        pair: number;
        gameId: string | null;
        homeMatch: { name: string; confidence: number } | null;
        awayMatch: { name: string; confidence: number } | null;
        overallConfidence: number | null;
        reasoning?: string;
      }>;
      console.log(`✅ Parsed ${aiMatches.length} matches from OpenAI response`);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      console.error('❌ JSON content:', jsonContent.substring(0, 500));
      throw new Error(`Failed to parse OpenAI JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // Map AI results back to requests
    for (let i = 0; i < uncachedRequests.length; i++) {
      const req = uncachedRequests[i];
      const aiResult = aiMatches.find(m => m.pair === i + 1);

      if (!aiResult) {
        results.set(`${req.externalHome}|${req.externalAway}`, {
          homeMatch: null,
          awayMatch: null,
        });
        continue;
      }

      // Find matching DB teams from the matched game
      console.log(`   🔍 OpenAI returned for pair ${i + 1}:`);
      console.log(`      Game ID: ${aiResult.gameId || 'null'}`);
      console.log(`      Overall Confidence: ${aiResult.overallConfidence ? (aiResult.overallConfidence * 100).toFixed(1) + '%' : 'null'}`);
      console.log(`      Home: ${aiResult.homeMatch ? `${aiResult.homeMatch.name} (${(aiResult.homeMatch.confidence * 100).toFixed(1)}%)` : 'null'}`);
      console.log(`      Away: ${aiResult.awayMatch ? `${aiResult.awayMatch.name} (${(aiResult.awayMatch.confidence * 100).toFixed(1)}%)` : 'null'}`);
      console.log(`      Reasoning: ${aiResult.reasoning || 'N/A'}`);
      
      // Trust OpenAI more - accept matches with overallConfidence >= 0.6 (60%)
      // OpenAI is used as a fallback when rule-based matching has low confidence, so we trust its judgment
      // Lowered to 0.6 for testing - can be raised back to 0.85 once verified
      const MIN_OPENAI_CONFIDENCE = 0.6; // 60% - lowered threshold for testing
      
      // If OpenAI found a gameId and has high overall confidence, use that game's teams
      let homeMatch: Team | null = null;
      let awayMatch: Team | null = null;
      
      if (aiResult.gameId && aiResult.overallConfidence && aiResult.overallConfidence >= MIN_OPENAI_CONFIDENCE) {
        // Find the matched game
        const matchedGame = req.dbGames.find(g => g.id === aiResult.gameId);
        if (matchedGame) {
          // Use teams from the matched game
          if (aiResult.homeMatch && aiResult.homeMatch.name === matchedGame.homeTeam.name) {
            homeMatch = { id: matchedGame.homeTeam.id, name: matchedGame.homeTeam.name, shortName: matchedGame.homeTeam.shortName || null };
          } else if (aiResult.homeMatch && aiResult.homeMatch.name === matchedGame.awayTeam.name) {
            // Teams might be swapped
            homeMatch = { id: matchedGame.awayTeam.id, name: matchedGame.awayTeam.name, shortName: matchedGame.awayTeam.shortName || null };
          }
          
          if (aiResult.awayMatch && aiResult.awayMatch.name === matchedGame.awayTeam.name) {
            awayMatch = { id: matchedGame.awayTeam.id, name: matchedGame.awayTeam.name, shortName: matchedGame.awayTeam.shortName || null };
          } else if (aiResult.awayMatch && aiResult.awayMatch.name === matchedGame.homeTeam.name) {
            // Teams might be swapped
            awayMatch = { id: matchedGame.homeTeam.id, name: matchedGame.homeTeam.name, shortName: matchedGame.homeTeam.shortName || null };
          }
        }
      } else {
        // Fallback to team name matching if no gameId or low confidence
        homeMatch = aiResult.homeMatch && aiResult.homeMatch.confidence >= MIN_OPENAI_CONFIDENCE
          ? req.dbTeams.find(t => t.name === aiResult.homeMatch!.name) || null
          : null;
        
        awayMatch = aiResult.awayMatch && aiResult.awayMatch.confidence >= MIN_OPENAI_CONFIDENCE
          ? req.dbTeams.find(t => t.name === aiResult.awayMatch!.name) || null
          : null;
      }
      
      if (aiResult.homeMatch && aiResult.homeMatch.confidence >= MIN_OPENAI_CONFIDENCE && !homeMatch) {
        console.log(`   ⚠️ OpenAI home match "${aiResult.homeMatch.name}" not found in DB teams (confidence: ${(aiResult.homeMatch.confidence * 100).toFixed(1)}%)`);
      }
      if (aiResult.awayMatch && aiResult.awayMatch.confidence >= MIN_OPENAI_CONFIDENCE && !awayMatch) {
        console.log(`   ⚠️ OpenAI away match "${aiResult.awayMatch.name}" not found in DB teams (confidence: ${(aiResult.awayMatch.confidence * 100).toFixed(1)}%)`);
      }
      if (aiResult.homeMatch && aiResult.homeMatch.confidence < MIN_OPENAI_CONFIDENCE) {
        console.log(`   ⚠️ OpenAI home match confidence ${(aiResult.homeMatch.confidence * 100).toFixed(1)}% is below ${(MIN_OPENAI_CONFIDENCE * 100).toFixed(0)}% threshold`);
      }
      if (aiResult.awayMatch && aiResult.awayMatch.confidence < MIN_OPENAI_CONFIDENCE) {
        console.log(`   ⚠️ OpenAI away match confidence ${(aiResult.awayMatch.confidence * 100).toFixed(1)}% is below ${(MIN_OPENAI_CONFIDENCE * 100).toFixed(0)}% threshold`);
      }

      const result: MatchResult = {
        gameId: aiResult.gameId || null,
        homeMatch: homeMatch && aiResult.homeMatch
          ? { team: homeMatch, confidence: aiResult.homeMatch.confidence }
          : null,
        awayMatch: awayMatch && aiResult.awayMatch
          ? { team: awayMatch, confidence: aiResult.awayMatch.confidence }
          : null,
        overallConfidence: aiResult.overallConfidence || null,
        reasoning: aiResult.reasoning,
      };
      
      console.log(`   ✅ Final result: gameId=${result.gameId || 'null'}, overallConfidence=${result.overallConfidence ? (result.overallConfidence * 100).toFixed(1) + '%' : 'null'}, home=${homeMatch ? homeMatch.name : 'null'}, away=${awayMatch ? awayMatch.name : 'null'}`);

      results.set(`${req.externalHome}|${req.externalAway}`, result);

      // Cache the result
      const dbGameIds = req.dbGames.map(g => g.id).sort();
      const cacheKey = getCacheKey(req.externalHome, req.externalAway, req.externalDate, dbGameIds);
      matchCache.set(cacheKey, result);

      // Clean old cache entries (simple cleanup - could be improved)
      if (matchCache.size > 1000) {
        const oldestKey = matchCache.keys().next().value;
        matchCache.delete(oldestKey);
      }
    }

    console.log(`✅ OpenAI matched ${uncachedRequests.length} team pairs (${requests.length - uncachedRequests.length} from cache)`);

  } catch (error) {
    console.error('Error matching teams with OpenAI:', error);
      // Return null matches on error (fallback to rule-based)
      uncachedRequests.forEach(req => {
        results.set(`${req.externalHome}|${req.externalAway}`, {
          gameId: null,
          homeMatch: null,
          awayMatch: null,
          overallConfidence: null,
        });
      });
  }

  return results;
}

/**
 * Clear the match cache (useful for testing or when teams are updated)
 */
export function clearMatchCache(): void {
  matchCache.clear();
}
