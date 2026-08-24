import { NextRequest, NextResponse } from "next/server";
import {
  AnalysisRequest,
  AnalysisResponse,
  DynamicStatus,
  EnergyLevel,
  UserVoiceProfile,
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

function extractJsonBlock(rawText: string): any {
  if (!rawText) return null;

  // 1. Strip think blocks if any
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned.replace(/<\/?think>/gi, "").trim();

  // 2. Extract from markdown fences or first curly bracket
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    const objectMatch = cleaned.match(/(\{[\s\S]*\})/);
    if (objectMatch) {
      cleaned = objectMatch[1].trim();
    }
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalysisRequest;
    const { messages, imageBase64, relationshipContext, userVoiceProfile } = body;

    const apiKey =
      process.env.LLM_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.OPENAI_API_KEY;
    const baseUrl =
      process.env.LLM_BASE_URL ||
      "https://openrouter.ai/api/v1";
    const primaryModel =
      process.env.LLM_MODEL ||
      "thinkingmachines/inkling:free";

    const candidateModels = [
      primaryModel,
      "openai/gpt-4o-mini",
      "openrouter/free",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    if (!apiKey) {
      return NextResponse.json(
        { error: "LLM_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const hasImage = Boolean(imageBase64 && imageBase64.startsWith("data:image/"));
    const conversationText = (messages || "").trim();

    if (!hasImage && conversationText.length === 0) {
      return NextResponse.json(
        { error: "Please provide a valid conversation snippet or upload a readable screenshot." },
        { status: 400 }
      );
    }

    // Format Voice Calibration constraints
    let voiceConstraintPrompt = "";
    if (userVoiceProfile) {
      const { styleToggles, customSampleTexts } = userVoiceProfile;
      voiceConstraintPrompt = `
### 🗣️ USER VOICEPRINT CONSTRAINTS:
You MUST calibrate the phrasing of "safePlay.reply" and "boldPlay.reply" to match the user's authentic voice:
- All-Lowercase: ${styleToggles.allLowercase ? "TRUE — The reply MUST be 100% all lowercase (e.g. 'sounds good, talk later' or 'alles gut, melde mich später')." : "False"}
- Dry Humor: ${styleToggles.dryHumor ? "TRUE — Use understated deadpan, subtle irony, and zero eager fluff." : "Standard"}
- Fast & Punchy: ${styleToggles.fastAndPunchy ? "TRUE — Limit replies strictly to 3 to 7 words max." : "Concise (5-12 words)"}
- Zero Emoji: ${styleToggles.zeroEmoji ? "TRUE — Absolutely 0 emojis." : "Zero emojis"}
${
  customSampleTexts && customSampleTexts.trim().length > 0
    ? `- User's Personal Texting Samples: """${customSampleTexts.trim()}""" (Subtly mirror this cadence and vocabulary)`
    : ""
}`;
    }

    const systemPrompt = `You are "Decoded", an elite behavioral psychologist, dating strategist, and interpersonal subtext analyzer. You analyze texting dynamics through radical honesty, non-neediness, and empirical evidence.

### 🏛️ STRICT EVIDENCE HIERARCHY (ABSOLUTE MANDATE):

1. 🔬 PRIORITY 1 (100% GROUND TRUTH — THE EMPIRICAL TRANSCRIPT OR SCREENSHOT):
   - Derive the behavioral dynamic SOLELY from the actual messages, word count, timestamps, sentiment, and emotional tone in the transcript or screenshot.
   - NEVER force-fit stereotypical assumptions from UI labels (e.g. NEVER assume "Ex" means fading breadcrumbs, "First Date" means logistics, or "Situationship" means mixed signals).
   - Categorize the real-time dynamic strictly based on what is said:
     * High Investment / Emotional Pleading (long essays, begging, apologies, urgency, desperate reconciliation pleas) -> The other person is collapsing frame; the USER holds frame ("Leading").
     * High Interest / Flirting (playful, banter, quick replies, genuine curiosity) -> "Balanced" or "Leading".
     * Neutral / Logistical (confirming times, direct questions, standard chat) -> "Balanced".
     * Low Investment / Fading (dry 1-word replies, multi-day delays, dismissive) -> "Fading".
     * Disrespect / Boundary Crossing (entitlement, insults, excessive guilt-tripping) -> "Testing Frame" or "Fading".

2. 🏷️ PRIORITY 2 (BACKGROUND METADATA ONLY):
   - The Relationship Context tag is secondary background history. It tells you the past label between the two people, NEVER their real-time behavior. It must NEVER override or contradict what is written in the transcript.

3. 🎯 SENDER & USER FRAME STATUS CLASSIFICATION:
   - "status" in the JSON schema strictly represents the USER'S frame position in the UI:
     * "Leading" -> (UI renders "You Hold Frame"): Classify as "Leading" whenever the OTHER person is chasing, sending desperate pleas, long paragraphs, apologies, or begging while the user remains composed, grounded, and concise.
     * "Chasing" -> (UI renders "You Are Chasing"): ONLY use this if the USER is the one desperately double-texting, over-explaining, or begging for validation.
     * "Balanced" -> (UI renders "Balanced Frame"): Mutual equal investment and cadence.
     * "Testing Frame" -> (UI renders "Testing Frame"): Other person is shit-testing or testing boundaries.
     * "Fading" -> (UI renders "Interest Fading"): Other person is pulling away, giving cold one-word replies, or ghosting.

4. 🧠 "internalMonologue" REPRESENTS THE OTHER PERSON:
   - "internalMonologue" MUST capture the OTHER PERSON'S raw, unfiltered emotional calculations, private insecurities, and inner panic as they type to the user. NEVER write the user's thoughts here.

5. 🇩🇪 GERMAN GRAMMAR & IDIOMATIC INTEGRITY (MANDATORY):
   - Every German reply MUST be a grammatically complete, natural sentence. NEVER drop necessary verbs or truncate clauses under word constraints (e.g. write "lass uns erst mal Abstand halten/nehmen", NEVER truncate to incomplete phrases like "lass uns erstmal abstand").
   - In farewell/closure contexts, ALWAYS use the correct idiom "ich wünsche dir trotzdem alles Gute" (with "Gute" ending in -e), NEVER "alles gut".
   - Ensure all verbs and separable particles (e.g. "runterkommen", "abstand nehmen", "telefonieren") are fully present and idiomatic.

6. 💬 ADAPTIVE HIGH-EQ PLAYS:
   - Tailor the Safe Play and Bold Play to directly address the specific emotion and language in the transcript:
     * Safe Play: Calm, unbothered, de-escalating while holding clear personal frame.
     * Bold Play: Decisive, high-status boundary or clear finality without hostility.
   - If the chat is in German, replies must sound 100% natural, modern, and colloquial.
   - If the chat is in English, replies must sound effortless and grounded.

7. ⏱️ STRATEGIC TIMING DISCIPLINE:
   - When the other person is sending desperate, frantic, or pleading messages, NEVER prescribe "immediate" timing.
   - Prescribe composed timing (e.g. "Wait 2–4 hours or reply tomorrow morning so the emotional storm calms down and you do not react from impulse").

8. 🛑 "WALK AWAY" DIGNITY DIAGNOSTIC:
   - If the dynamic is "Fading", or if the other person is manipulative, toxic, or repeatedly low-effort, generate a "walkAwayOption".
   - "isRecommended": Set to true if holding firm boundaries or leaving on read is the highest-status move.
   - "triggerReason": Why holding frame is warranted.
   - "dignityRule": The psychological principle of why holding frame protects dignity.
   - "reEngagementCondition": The exact rule for when the user should ever re-engage.

9. 💬 ZERO-CRINGE SYNTAX CONSTRAINTS:
   - Length: Strictly 5 to 16 words max (ensuring no German verbs or particles are truncated).
   - Casing & Punctuation: Casual, natural modern phrasing. Zero double exclamation marks (!!).
   - Emojis: Strictly banned. Never use cringe romantic emojis (no 😋, 😉, 🌹, 🥺, 😏, ❤️).
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

    let userPromptText = "";
    if (hasImage) {
      userPromptText = `Background Relationship Tag (Secondary Metadata Only): ${relationshipContext || "Not specified"}
Accurately transcribe all chat bubbles, sender names, and timestamps from the attached screenshot in their original language.
Then analyze the conversation with psychological accuracy and generate the structured JSON payload.
Remember: If the chat is in German or another language, generate safePlay.reply and boldPlay.reply in that language!`;
    } else {
      userPromptText = `Empirical Chat Transcript (Primary Ground Truth):
"""
${conversationText}
"""

Background Relationship Tag (Secondary Metadata Only):
${relationshipContext || "Not specified"}

Analyze this transcript with psychological accuracy based on the empirical evidence. Remember: If the conversation is in German or another language, generate safePlay.reply and boldPlay.reply in that language!`;
    }

    let userContent: any;
    if (hasImage) {
      userContent = [
        { type: "text", text: userPromptText },
        { type: "image_url", image_url: { url: imageBase64 } },
      ];
    } else {
      userContent = userPromptText;
    }

    let parsedResult: any = null;
    let lastError = "";

    for (const modelToTry of candidateModels) {
      try {
        console.log(`Calling OpenRouter with model: ${modelToTry}`);
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://decoded.vercel.app",
            "X-Title": "Decoded OS",
          },
          body: JSON.stringify({
            model: modelToTry,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
            temperature: 0.6,
            max_tokens: 1000,
            response_format: { type: "json_object" },
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          lastError = errBody.error?.message || `HTTP ${response.status}`;
          console.warn(`Model ${modelToTry} returned error (${response.status}): ${lastError}`);
          continue;
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (rawContent) {
          parsedResult = extractJsonBlock(rawContent);
          if (parsedResult && parsedResult.subtext && parsedResult.safePlay?.reply) {
            console.log(`Successfully parsed response from model: ${modelToTry}`);
            break;
          }
        }
      } catch (err: any) {
        console.error(`Error calling model ${modelToTry}:`, err);
        lastError = err.message || "Network error";
      }
    }

    if (!parsedResult) {
      return NextResponse.json(
        {
          error: `Failed to decode conversation via OpenRouter: ${lastError || "Could not parse JSON response"}. Please try again.`,
        },
        { status: 500 }
      );
    }

    const sanitizedStatus: DynamicStatus = VALID_STATUSES.includes(parsedResult.status)
      ? parsedResult.status
      : "Balanced";

    const sanitizedEnergy: EnergyLevel = VALID_ENERGY_LEVELS.includes(parsedResult.energyLevel)
      ? parsedResult.energyLevel
      : "Balanced";

    const analysisResponse: AnalysisResponse = {
      subtext: parsedResult.subtext || "Subtext decoded from empirical evidence.",
      status: sanitizedStatus,
      energyLevel: sanitizedEnergy,
      trapToAvoid: parsedResult.trapToAvoid || "Reacting impulsively or forfeiting personal boundaries.",
      internalMonologue: parsedResult.internalMonologue || "Processing interaction dynamic...",
      safePlay: {
        reply: parsedResult.safePlay?.reply || "Alles klar, danke dir.",
        reasoning: parsedResult.safePlay?.reasoning || "Maintains grounded composure and personal frame.",
        timing: parsedResult.safePlay?.timing || "Wait 2–4 hours or reply when calm.",
      },
      boldPlay: {
        reply: parsedResult.boldPlay?.reply || "Lass uns das persönlich klären.",
        reasoning: parsedResult.boldPlay?.reasoning || "Decisive boundary setting.",
        risk: parsedResult.boldPlay?.risk || "May provoke emotional pushback.",
      },
      walkAwayOption: parsedResult.walkAwayOption || {
        isRecommended: false,
        triggerReason: "No immediate boundary breach detected.",
        dignityRule: "Preserve dignity by matching effort.",
        reEngagementCondition: "When mutual respect and effort are restored.",
      },
    };

    return NextResponse.json(analysisResponse);
  } catch (error: any) {
    console.error("API error in /api/analyze:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error occurred while decoding conversation." },
      { status: 500 }
    );
  }
}
