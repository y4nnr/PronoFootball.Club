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
  externalHome: string;
  externalAway: string;
  dbTeams: Team[];
}

interface MatchResult {
  homeMatch: { team: Team; confidence: number } | null;
  awayMatch: { team: Team; confidence: number } | null;
  reasoning?: string;
}

// Simple in-memory cache (could be upgraded to Redis in production)
const matchCache = new Map<string, MatchResult>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(externalHome: string, externalAway: string, dbTeamIds: string[]): string {
  const sortedIds = [...dbTeamIds].sort().join(',');
  return `${externalHome}|${externalAway}|${sortedIds}`;
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
        homeMatch: null,
        awayMatch: null,
      });
    });
    return results;
  }

  // Check cache first
  const uncachedRequests: MatchRequest[] = [];
  const cacheKeys: string[] = [];

  for (const req of requests) {
    const dbTeamIds = req.dbTeams.map(t => t.id).sort();
    const cacheKey = getCacheKey(req.externalHome, req.externalAway, dbTeamIds);
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
    const dbTeamsList = uncachedRequests[0].dbTeams; // All requests should have same dbTeams
    const dbTeamsText = dbTeamsList.map(t => 
      `- "${t.name}"${t.shortName ? ` (${t.shortName})` : ''}`
    ).join('\n');

    const matchPairs = uncachedRequests.map((req, idx) => 
      `${idx + 1}. External API: "${req.externalHome}" vs "${req.externalAway}"`
    ).join('\n');

    const prompt = `You are a team name matching assistant for a sports betting platform.

I need you to match external API team names with database team names. The external API names may have variations, abbreviations, or different formatting.

Database teams available:
${dbTeamsText}

External API team pairs to match:
${matchPairs}

For each pair, return a JSON array with this exact format:
[
  {
    "pair": 1,
    "homeMatch": {"name": "exact database team name", "confidence": 0.0-1.0},
    "awayMatch": {"name": "exact database team name", "confidence": 0.0-1.0},
    "reasoning": "brief explanation"
  },
  ...
]

Rules:
- Match confidence should be 0.0-1.0 (1.0 = perfect match, 0.0 = no match)
- Only return matches with confidence >= 0.85 (85%) - we need HIGH confidence to guarantee 100% match
- If no good match with confidence >= 0.85, set the match to null
- Use exact database team names (case-sensitive)
- Consider abbreviations, nicknames, and common variations
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
      homeMatch: { name: string; confidence: number } | null;
      awayMatch: { name: string; confidence: number } | null;
      reasoning?: string;
    }>;
    
    try {
      aiMatches = JSON.parse(jsonContent) as Array<{
        pair: number;
        homeMatch: { name: string; confidence: number } | null;
        awayMatch: { name: string; confidence: number } | null;
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

      // Find matching DB teams
      console.log(`   🔍 OpenAI returned for pair ${i + 1}:`);
      console.log(`      Home: ${aiResult.homeMatch ? `${aiResult.homeMatch.name} (${(aiResult.homeMatch.confidence * 100).toFixed(1)}%)` : 'null'}`);
      console.log(`      Away: ${aiResult.awayMatch ? `${aiResult.awayMatch.name} (${(aiResult.awayMatch.confidence * 100).toFixed(1)}%)` : 'null'}`);
      console.log(`      Available DB teams: ${req.dbTeams.map(t => t.name).join(', ')}`);
      
      // Trust OpenAI more - accept matches with confidence >= 0.85 (85%)
      // OpenAI is used as a fallback when rule-based matching has low confidence, so we trust its judgment
      const MIN_OPENAI_CONFIDENCE = 0.85; // 85% - high confidence threshold for OpenAI
      const homeMatch = aiResult.homeMatch && aiResult.homeMatch.confidence >= MIN_OPENAI_CONFIDENCE
        ? req.dbTeams.find(t => t.name === aiResult.homeMatch!.name)
        : null;
      
      const awayMatch = aiResult.awayMatch && aiResult.awayMatch.confidence >= MIN_OPENAI_CONFIDENCE
        ? req.dbTeams.find(t => t.name === aiResult.awayMatch!.name)
        : null;
      
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
        homeMatch: homeMatch
          ? { team: homeMatch, confidence: aiResult.homeMatch.confidence }
          : null,
        awayMatch: awayMatch
          ? { team: awayMatch, confidence: aiResult.awayMatch.confidence }
          : null,
        reasoning: aiResult.reasoning,
      };
      
      console.log(`   ✅ Final result: home=${homeMatch ? homeMatch.name : 'null'}, away=${awayMatch ? awayMatch.name : 'null'}`);

      results.set(`${req.externalHome}|${req.externalAway}`, result);

      // Cache the result
      const dbTeamIds = req.dbTeams.map(t => t.id).sort();
      const cacheKey = getCacheKey(req.externalHome, req.externalAway, dbTeamIds);
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
        homeMatch: null,
        awayMatch: null,
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
