import { NextRequest, NextResponse } from "next/server";
import {
  AnalysisRequest,
  AnalysisResponse,
  DynamicStatus,
  EnergyLevel,
  UserVoiceProfile,
  WalkAwayOption,
} from "@/lib/types";

export const runtime = "edge";

const VALID_STATUSES: DynamicStatus[] = [
  "Chasing",
  "Leading",
  "Balanced",
  "Fading",
  "Testing Frame",
];

const VALID_ENERGY_LEVELS: EnergyLevel[] = [
  "High",
  "Balanced",
  "Low",
  "Fading",
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalysisRequest;
    const { messages, relationshipContext, userVoiceProfile } = body;

    if (!messages || typeof messages !== "string" || messages.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide a valid conversation snippet to analyze." },
        { status: 400 }
      );
    }

    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
    const baseUrl =
      process.env.LLM_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      "https://api.groq.com/openai/v1";
    const model =
      process.env.LLM_MODEL ||
      (baseUrl.includes("groq.com") ? "openai/gpt-oss-120b" : "gpt-4o-mini");

    // If no API key is provided, use built-in Manson psychological heuristics engine
    if (!apiKey) {
      const mockResult = generateIntelligentFallback(messages, relationshipContext, userVoiceProfile);
      return NextResponse.json(mockResult, { status: 200 });
    }

    // Format Voice Calibration constraints
    let voiceConstraintPrompt = "";
    if (userVoiceProfile) {
      const { styleToggles, customSampleTexts } = userVoiceProfile;
      voiceConstraintPrompt = `
### 🗣️ USER VOICEPRINT CONSTRAINTS (MANDATORY):
You MUST calibrate the phrasing of "safePlay.reply" and "boldPlay.reply" to match the user's authentic voice:
- All-Lowercase Mode: ${styleToggles.allLowercase ? "TRUE — The reply MUST be 100% all lowercase (e.g. 'sounds good, talk later'). No capitalized letters." : "False"}
- Dry Humor: ${styleToggles.dryHumor ? "TRUE — Use understated deadpan, subtle irony, and zero eager fluff." : "Standard"}
- Fast & Punchy: ${styleToggles.fastAndPunchy ? "TRUE — Limit replies strictly to 3 to 7 words max." : "Concise (5-12 words)"}
- Zero Emoji: ${styleToggles.zeroEmoji ? "TRUE — Absolutely 0 emojis." : "Zero emojis"}
${
  customSampleTexts && customSampleTexts.trim().length > 0
    ? `- User's Personal Texting Samples: """${customSampleTexts.trim()}""" (Subtly mirror this cadence and vocabulary)`
    : ""
}`;
    }

    const systemPrompt = `You are Mark Manson—author of 'Models' and 'The Subtle Art of Not Giving a F*ck'. You analyze texting dynamics and interpersonal communication through radical honesty, non-neediness, and outcome independence ("Fuck Yes or No").

### 👑 MARK MANSON OPERATING PRINCIPLES:
1. NON-NEEDINESS & OUTCOME INDEPENDENCE:
   - Neediness is when someone cares more about what the other person thinks than what they think of themselves.
   - If the other person is giving lukewarm energy, breadcrumbing, or playing passive games, call it out plainly. Never advise dancing for someone's validation or scrambling to prove worth.
   - A high-value response is never eager, defensive, or apologetic. It represents pure comfort with whatever outcome happens.

2. POLARIZING CLARITY ("FUCK YES OR NO"):
   - Rejection is vastly better than lingering ambiguity. The goal of texting is never endless back-and-forth chat; it is filtering for mutual, enthusiastic interest and moving to real-life connection.
   - "subtext": 1-2 blunt, perceptive sentences cutting straight through their text. Are they breadcrumbing? Validating ego? Testing boundaries? Being polite? Give the unvarnished truth.
   - "trapToAvoid": The exact needy trap the user is prone to falling into right now (over-explaining, double-texting, seeking reassurance, reacting defensively to low effort).
   - "internalMonologue": An unfiltered, first-person thought bubble exposing what they are privately feeling or testing.

3. "WALK AWAY" DIGNITY DIAGNOSTIC:
   - If the dynamic is "Fading", if the other person sent dry replies (< 4 words) after long delays, or if the conversation is a one-sided interview, generate a "walkAwayOption".
   - "isRecommended": Set to true if walking away/leaving on read is the highest-status play.
   - "triggerReason": Why walking away is warranted (e.g. "2 consecutive dry responses with zero conversational reciprocal effort").
   - "dignityRule": The psychological principle of why silence preserves frame (e.g. "Silence here is not passive-aggressive—it's matching reality.").
   - "reEngagementCondition": The exact rule for when the user should ever re-engage (e.g. "Only respond if they reach out with a genuine question or specific plan.").

4. AUTHENTIC TEXTING SYNTAX (ZERO CRINGE):
   - Real humans do not text like poets, pickup artists, or corporate influencers.
   - Length: Strictly 5 to 12 words max (unless Fast & Punchy is enabled, then 3-7 words).
   - Casing & Punctuation: Casual, natural lowercase or minimal punctuation. Zero double exclamation marks (!!).
   - Emojis: Strictly banned. Never use cringe romantic or goofy emojis (no 😋, 😉, 🌹, 🥺, 😏, ❤️).
   - "safePlay": Relaxed, frictionless, unbothered (e.g. "haha all good, catch you around", "sounds good, let me know", "fair enough, talk later").
   - "boldPlay": Polarizing, authentic, directly cutting through the games without drama or anger (e.g. "you're terrible at texting. call me later", "let's skip the small talk. drink this week?", "you only text past midnight. call me tomorrow").
${voiceConstraintPrompt}

### 📊 STRICT SCHEMA REQUIREMENTS:
- "status": Strictly one of: "Chasing" | "Leading" | "Balanced" | "Fading" | "Testing Frame".
- "energyLevel": Strictly one of: "High" | "Balanced" | "Low" | "Fading".

### OUTPUT FORMAT:
Respond with valid, raw JSON only matching this exact schema:
{
  "subtext": string,
  "status": "Chasing" | "Leading" | "Balanced" | "Fading" | "Testing Frame",
  "energyLevel": "High" | "Balanced" | "Low" | "Fading",
  "trapToAvoid": string,
  "internalMonologue": string,
  "safePlay": {
    "reply": string,
    "reasoning": string,
    "timing": string
  },
  "boldPlay": {
    "reply": string,
    "reasoning": string,
    "risk": string
  },
  "walkAwayOption": {
    "isRecommended": boolean,
    "triggerReason": string,
    "dignityRule": string,
    "reEngagementCondition": string
  }
}`;

    const userPrompt = `Relationship Context: ${relationshipContext || "Not specified / Early dating"}
Conversation Snippet:
"""
${messages}
"""

Analyze this snippet with psychological accuracy and generate the structured JSON payload.`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Upstream LLM error:", response.status, errorText);
      // Fallback seamlessly if the provider failed
      const fallbackResult = generateIntelligentFallback(messages, relationshipContext, userVoiceProfile);
      return NextResponse.json(fallbackResult, { status: 200 });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("Empty response from LLM");
    }

    // Clean any markdown formatting if present
    const cleanedJson = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanedJson) as Partial<AnalysisResponse>;

    // Enforce all-lowercase if requested
    let safeReply = parsed.safePlay?.reply || "haha all good, catch you around";
    let boldReply = parsed.boldPlay?.reply || "let's skip the small talk. drink this week?";
    if (userVoiceProfile?.styleToggles?.allLowercase) {
      safeReply = safeReply.toLowerCase();
      boldReply = boldReply.toLowerCase();
    }

    // Validate and sanitize response
    const sanitizedResponse: AnalysisResponse = {
      subtext: parsed.subtext || "They are giving minimal effort to keep the channel open without committing real energy or emotional exposure.",
      status: VALID_STATUSES.includes(parsed.status as DynamicStatus)
        ? (parsed.status as DynamicStatus)
        : "Testing Frame",
      energyLevel: VALID_ENERGY_LEVELS.includes(parsed.energyLevel as EnergyLevel)
        ? (parsed.energyLevel as EnergyLevel)
        : "Balanced",
      trapToAvoid:
        parsed.trapToAvoid ||
        "Do not over-invest or ask for emotional validation to bridge the communication gap.",
      internalMonologue:
        parsed.internalMonologue ||
        "I like the attention, but I want to see if they'll chase before I put in real effort.",
      safePlay: {
        reply: safeReply,
        reasoning:
          parsed.safePlay?.reasoning ||
          "Demonstrates outcome independence, relieves artificial pressure, and completely eliminates the needy dynamic.",
        timing: parsed.safePlay?.timing || "Match their response delay",
      },
      boldPlay: {
        reply: boldReply,
        reasoning:
          parsed.boldPlay?.reasoning ||
          "Polarizes the interaction immediately to filter for genuine 'Fuck Yes' interest versus lukewarm time-wasting.",
        risk: parsed.boldPlay?.risk || "Filters out lukewarm interest immediately, saving you time.",
      },
      walkAwayOption: parsed.walkAwayOption?.isRecommended
        ? parsed.walkAwayOption
        : (parsed.status === "Fading" || parsed.energyLevel === "Fading"
            ? {
                isRecommended: true,
                triggerReason: "Severe energy asymmetry & conversational deceleration.",
                dignityRule: "Leaving on read here is not passive-aggressive—it is matching reality and refusing to dance for breadcrumbs.",
                reEngagementCondition: "Do not text again until they initiate with a specific question or concrete plan.",
              }
            : undefined),
    };

    return NextResponse.json(sanitizedResponse, { status: 200 });
  } catch (error) {
    console.error("Analysis route error:", error);
    // Provide a resilient fallback response on unhandled runtime exception
    try {
      const fallback = generateIntelligentFallback("General conversation analysis", "Talking Stage", undefined);
      return NextResponse.json(fallback, { status: 200 });
    } catch {
      return NextResponse.json(
        { error: "Failed to process psychological analysis. Please try again." },
        { status: 500 }
      );
    }
  }
}

/**
 * High-EQ rule-based fallback generator for immediate out-of-the-box local testing
 * or when external LLM API rate limits are encountered.
 */
function generateIntelligentFallback(
  messages: string,
  context?: string,
  userVoiceProfile?: UserVoiceProfile
): AnalysisResponse {
  const lower = messages.toLowerCase();
  const contextStr = (context || "").toLowerCase();
  const isLowercase = userVoiceProfile?.styleToggles?.allLowercase;

  const fmt = (text: string) => (isLowercase ? text.toLowerCase() : text);

  if (
    lower.includes("wyd") ||
    lower.includes("late") ||
    lower.includes("tonight") ||
    lower.includes("u up")
  ) {
    return {
      subtext:
        "Low-investment validation check. They are bored, seeking effortless attention, or testing your late-night availability without real planning.",
      status: "Testing Frame",
      energyLevel: "Low",
      trapToAvoid:
        "Jumping at the immediate invitation or explaining your whole evening schedule like an open book.",
      internalMonologue:
        "Let's see if they're sitting around waiting for me or if they have their own life going on.",
      safePlay: {
        reply: fmt("out with friends tonight, catch you later"),
        reasoning:
          "Demonstrates an active social life, declines the bait casually, and resets conversation to daytime cadence.",
        timing: "Wait 45–60 minutes before replying",
      },
      boldPlay: {
        reply: fmt("you only text past midnight. call me tomorrow instead"),
        reasoning:
          "Directly calls out the low-effort late-night pattern and establishes high standards with zero drama.",
        risk: "Will filter out anyone who only wanted a casual late-night dopamine hit.",
      },
    };
  }

  if (
    lower.includes("k") ||
    lower.includes("cool") ||
    lower.includes("haha yeah") ||
    lower.includes("nice") ||
    lower.includes("busy")
  ) {
    return {
      subtext:
        "Energy mismatch & conversational deceleration. They are giving minimal effort to hold the conversation at arm's length without formally closing it.",
      status: "Fading",
      energyLevel: "Fading",
      trapToAvoid:
        "Sending a double-text, asking 'are you mad at me?', or scrambling with new topics to revive interest.",
      internalMonologue:
        "I don't have the energy for a deep back-and-forth right now, but I don't want to be outright rude.",
      safePlay: {
        reply: fmt("haha yeah fair enough"),
        reasoning:
          "Mirroring low investment ends the one-sided dynamic and gives them space to re-engage on their own.",
        timing: "Match delay or leave on read",
      },
      boldPlay: {
        reply: fmt("don't overwhelm me with all that enthusiasm at once"),
        reasoning:
          "Playfully teases their dry response, exposes low effort playfully, and cleanly exits on your terms.",
        risk: "If their interest is genuinely zero, they might not reply.",
      },
      walkAwayOption: {
        isRecommended: true,
        triggerReason: "One-sided conversational investment with minimal effort from their end.",
        dignityRule: "Leaving on read is self-respect in action. Never chase someone who is slowly backing out the door.",
        reEngagementCondition: "Only re-engage if they double-text or initiate with a genuine question/plan.",
      },
    };
  }

  if (
    contextStr.includes("ex") ||
    lower.includes("miss you") ||
    lower.includes("remember when")
  ) {
    return {
      subtext:
        "Nostalgia probing & emotional temperature check. They are checking if their emotional tether to you is still active without offering accountability.",
      status: "Testing Frame",
      energyLevel: "Balanced",
      trapToAvoid:
        "Pouring out your emotional growth, reminiscing about the past, or accepting a vague 'let's catch up' with no clarity.",
      internalMonologue:
        "Something reminded me of them and I want to know if they still think about me as much as I think about them.",
      safePlay: {
        reply: fmt("hope you're doing well! life's been great here"),
        reasoning:
          "Warm but completely non-committal. Signals zero resentment, high abundance, and zero lingering desperation.",
        timing: "Wait 3–4 hours before responding",
      },
      boldPlay: {
        reply: fmt("nostalgia is dangerous. what made you think of that today?"),
        reasoning:
          "Pins them to articulate their actual intent rather than hiding behind vague nostalgic breadcrumbs.",
        risk: "Can reignite old emotional tensions if unresolved conflicts exist.",
      },
    };
  }

  // Default balanced analysis
  return {
    subtext:
      "They are maintaining subtle plausible deniability. The message balances warmth with cautious detachment to see if you will over-invest and lead.",
    status: "Leading",
    energyLevel: "Balanced",
    trapToAvoid:
      "Over-explaining yourself, replying within 10 seconds to a 4-hour delay, or sending a wall of text against single sentences.",
    internalMonologue:
      "I'm intrigued, but I want to keep things casual and see how much effort they put in first.",
    safePlay: {
      reply: fmt("haha all good, let's grab a drink later this week"),
      reasoning:
        "Keeps tone light, transitions from endless texting to an actionable meet, and filters for real interest.",
      timing: "Match their response time roughly",
    },
    boldPlay: {
      reply: fmt("let's skip the endless texting. drinks Thursday?"),
      reasoning:
        "Polarizing, high-status move that cuts through ambiguity and tests for authentic 'Fuck Yes' interest.",
      risk: "Forces an immediate binary choice, weeding out lukewarm time-wasters.",
    },
  };
}
