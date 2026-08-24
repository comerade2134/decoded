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

  // 1. Strip think blocks or thought tags
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned.replace(/<\/?think>/gi, "").trim();

  // 2. Extract from markdown fences or first outer curly braces
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
    const parsed = JSON.parse(cleaned);
    // Normalize snake_case keys if returned by certain models
    return {
      subtext: parsed.subtext || parsed.psychological_subtext || parsed.psychologicalSubtext,
      status: parsed.status || parsed.frame_dynamics || parsed.frameDynamics,
      energyLevel: parsed.energyLevel || parsed.energy_level || parsed.energy,
      trapToAvoid: parsed.trapToAvoid || parsed.trap_to_avoid || parsed.needyTrap,
      internalMonologue: parsed.internalMonologue || parsed.internal_monologue || parsed.unfilteredInternalMonologue,
      safePlay: parsed.safePlay || parsed.safe_play || parsed.play1,
      boldPlay: parsed.boldPlay || parsed.bold_play || parsed.play2,
      walkAwayOption: parsed.walkAwayOption || parsed.walk_away_option || parsed.walkAwayPlay,
    };
  } catch {
    return null;
  }
}

async function callOpenAIEndpoint(
  url: string,
  apiKey: string,
  model: string,
  messages: any[],
  extraHeaders: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        ok: false,
        status: response.status,
        error: errBody.error?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return { ok: true, status: 200, data };
  } catch (err: any) {
    return { ok: false, status: 500, error: err.message || "Network error" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalysisRequest;
    const { messages, imageBase64, relationshipContext, userVoiceProfile } = body;

    const geminiKey =
      process.env.GEMINI_API_KEY ||
      (process.env.LLM_API_KEY?.startsWith("AQ.") || process.env.LLM_API_KEY?.startsWith("AIza")
        ? process.env.LLM_API_KEY
        : undefined);

    const openrouterKey =
      process.env.OPENROUTER_API_KEY ||
      (process.env.LLM_API_KEY?.startsWith("sk-or-") ? process.env.LLM_API_KEY : undefined);

    const groqKey =
      process.env.GROQ_API_KEY ||
      (process.env.LLM_API_KEY?.startsWith("gsk_") ? process.env.LLM_API_KEY : undefined);

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

    const messagesPayload = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    let parsedResult: any = null;
    let lastError = "";

    // ==========================================
    // STEP 1: DIRECT GOOGLE GEMINI (NATIVE MULTIMODAL)
    // ==========================================
    if (geminiKey) {
      const geminiModels = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-3.7-flash"];
      for (const gModel of geminiModels) {
        try {
          console.log(`[Cascade Step 1] Calling Google Gemini model: ${gModel}`);
          const res = await callOpenAIEndpoint(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            geminiKey,
            gModel,
            messagesPayload
          );

          if (res.ok && res.data?.choices?.[0]?.message?.content) {
            parsedResult = extractJsonBlock(res.data.choices[0].message.content);
            if (parsedResult && parsedResult.subtext && parsedResult.safePlay?.reply) {
              console.log(`✅ [Step 1: Gemini] Success with model: ${gModel}`);
              break;
            }
          } else {
            lastError = `Gemini (${gModel}): ${res.error}`;
            console.warn(`[Step 1: Gemini] ${gModel} failed (${res.status}): ${res.error}`);
          }
        } catch (e: any) {
          lastError = `Gemini (${gModel}): ${e.message}`;
        }
      }
    }

    // ==========================================
    // STEP 2: OPENROUTER MULTIMODAL FAILOVER
    // ==========================================
    if (!parsedResult && openrouterKey) {
      const openrouterModels = [
        process.env.LLM_MODEL || "thinkingmachines/inkling:free",
        "openai/gpt-4o-mini",
        "google/gemini-2.0-flash-exp:free",
        "openrouter/free",
      ].filter((m, i, arr) => arr.indexOf(m) === i);

      for (const oModel of openrouterModels) {
        try {
          console.log(`[Cascade Step 2] Calling OpenRouter model: ${oModel}`);
          const res = await callOpenAIEndpoint(
            "https://openrouter.ai/api/v1/chat/completions",
            openrouterKey,
            oModel,
            messagesPayload,
            {
              "HTTP-Referer": "https://decoded.vercel.app",
              "X-Title": "Decoded OS",
            }
          );

          if (res.ok && res.data?.choices?.[0]?.message?.content) {
            parsedResult = extractJsonBlock(res.data.choices[0].message.content);
            if (parsedResult && parsedResult.subtext && parsedResult.safePlay?.reply) {
              console.log(`✅ [Step 2: OpenRouter] Success with model: ${oModel}`);
              break;
            }
          } else {
            lastError = `OpenRouter (${oModel}): ${res.error}`;
            console.warn(`[Step 2: OpenRouter] ${oModel} failed (${res.status}): ${res.error}`);
          }
        } catch (e: any) {
          lastError = `OpenRouter (${oModel}): ${e.message}`;
        }
      }
    }

    // ==========================================
    // STEP 3: GROQ MULTIMODAL / REASONING PIPELINE FAILOVER
    // ==========================================
    if (!parsedResult && groqKey) {
      let groqConversationText = conversationText;

      // If image provided and Groq is called, perform fast Vision OCR
      if (hasImage && !groqConversationText) {
        console.log("[Cascade Step 3] Calling Groq Vision OCR (qwen/qwen3.6-27b)...");
        try {
          const ocrRes = await callOpenAIEndpoint(
            "https://api.groq.com/openai/v1/chat/completions",
            groqKey,
            "qwen/qwen3.6-27b",
            [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Transcribe all chat bubbles and senders from this image accurately:
- Left: Them
- Right: You
Return only dialogue.`,
                  },
                  {
                    type: "image_url",
                    image_url: { url: imageBase64 },
                  },
                ],
              },
            ]
          );

          if (ocrRes.ok && ocrRes.data?.choices?.[0]?.message?.content) {
            groqConversationText = ocrRes.data.choices[0].message.content
              .replace(/<think>[\s\S]*?<\/think>/gi, "")
              .trim();
          }
        } catch (ocrErr: any) {
          console.warn("Groq OCR step failed:", ocrErr.message);
        }
      }

      const groqPayload = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Empirical Chat Transcript (Primary Ground Truth):
"""
${groqConversationText || conversationText || "Image chat interaction"}
"""

Background Relationship Tag: ${relationshipContext || "Not specified"}

Analyze this transcript with psychological accuracy.`,
        },
      ];

      const groqModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
      for (const gqModel of groqModels) {
        try {
          console.log(`[Cascade Step 3] Calling Groq Reasoning model: ${gqModel}`);
          const res = await callOpenAIEndpoint(
            "https://api.groq.com/openai/v1/chat/completions",
            groqKey,
            gqModel,
            groqPayload
          );

          if (res.ok && res.data?.choices?.[0]?.message?.content) {
            parsedResult = extractJsonBlock(res.data.choices[0].message.content);
            if (parsedResult && parsedResult.subtext && parsedResult.safePlay?.reply) {
              console.log(`✅ [Step 3: Groq] Success with model: ${gqModel}`);
              break;
            }
          } else {
            lastError = `Groq (${gqModel}): ${res.error}`;
            console.warn(`[Step 3: Groq] ${gqModel} failed (${res.status}): ${res.error}`);
          }
        } catch (e: any) {
          lastError = `Groq (${gqModel}): ${e.message}`;
        }
      }
    }

    // ==========================================
    // ERROR HANDLER: ALL FREE POOLS SATURATED
    // ==========================================
    if (!parsedResult || !parsedResult.subtext) {
      return NextResponse.json(
        {
          error: `All AI provider free tiers (Google Gemini, OpenRouter, Groq) are temporarily saturated or rate-limited: ${lastError || "Could not parse response"}. Please retry in 10 seconds.`,
        },
        { status: 503 }
      );
    }

    const sanitizedStatus: DynamicStatus = VALID_STATUSES.includes(parsedResult.status)
      ? parsedResult.status
      : "Balanced";

    const sanitizedEnergy: EnergyLevel = VALID_ENERGY_LEVELS.includes(parsedResult.energyLevel)
      ? parsedResult.energyLevel
      : "Balanced";

    const safePlayObj = parsedResult.safePlay || {};
    const boldPlayObj = parsedResult.boldPlay || {};
    const walkAwayObj = parsedResult.walkAwayOption || {};

    const analysisResponse: AnalysisResponse = {
      subtext: parsedResult.subtext || "Subtext decoded from empirical evidence.",
      status: sanitizedStatus,
      energyLevel: sanitizedEnergy,
      trapToAvoid: parsedResult.trapToAvoid || "Reacting impulsively or forfeiting personal boundaries.",
      internalMonologue: parsedResult.internalMonologue || "Processing interaction dynamic...",
      safePlay: {
        reply: safePlayObj.reply || "Alles klar, danke dir.",
        reasoning: safePlayObj.reasoning || "Maintains grounded composure and personal frame.",
        timing: safePlayObj.timing || "Wait 2–4 hours or reply when calm.",
      },
      boldPlay: {
        reply: boldPlayObj.reply || "Lass uns das persönlich klären.",
        reasoning: boldPlayObj.reasoning || "Decisive boundary setting.",
        risk: boldPlayObj.risk || "May provoke emotional pushback.",
      },
      walkAwayOption: {
        isRecommended: Boolean(walkAwayObj.isRecommended),
        triggerReason: walkAwayObj.triggerReason || "No immediate boundary breach detected.",
        dignityRule: walkAwayObj.dignityRule || "Preserve dignity by matching effort.",
        reEngagementCondition: walkAwayObj.reEngagementCondition || "When mutual respect and effort are restored.",
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
