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

function extractCleanTranscription(rawText: string): string {
  if (!rawText) return "";

  // 1. If closed think tag exists and has text after it
  if (rawText.includes("</think>")) {
    const after = rawText.split("</think>")[1].trim();
    if (after.length > 20) return after;
  }

  // 2. If it's inside think block, extract quotes or list items from think block
  const lines = rawText.split("\n");
  const extractedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('- "') ||
      trimmed.startsWith('* "') ||
      trimmed.includes("Bubble:") ||
      trimmed.includes("Text:") ||
      trimmed.includes("Content:") ||
      trimmed.includes("Header:")
    ) {
      const cleaned = trimmed
        .replace(/^[-*•]\s*/, "")
        .replace(/^(Bubble|Text|Content|Header|Chat Bubble|Sender\/Label|Label|Sender):\s*/i, "")
        .replace(/^"|"$/g, "")
        .trim();
      if (
        cleaned.length > 0 &&
        !cleaned.toLowerCase().includes("analyze the image") &&
        !cleaned.toLowerCase().includes("transcription strategy") &&
        !cleaned.toLowerCase().includes("identify the text")
      ) {
        extractedLines.push(cleaned);
      }
    }
  }

  if (extractedLines.length > 0) {
    return extractedLines.join("\n");
  }

  // Fallback: strip think tags if any, or return raw
  return (
    rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() ||
    rawText.replace(/<\/?think>/gi, "").trim()
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalysisRequest;
    const { messages, imageBase64, relationshipContext, userVoiceProfile } = body;

    const apiKey =
      process.env.LLM_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GROQ_API_KEY;
    const baseUrl =
      process.env.LLM_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      "https://api.groq.com/openai/v1";
    const textModel = process.env.LLM_MODEL || "openai/gpt-oss-120b";
    const fallbackTextModel = "openai/gpt-oss-20b";

    const visionModels = [
      process.env.VISION_MODEL || "qwen/qwen3.6-27b",
      "llama-3.2-11b-vision-preview",
      "llama-3.2-90b-vision-preview",
    ];

    let conversationText = (messages || "").trim();

    // 1. REAL VISION OCR PIPELINE (Groq Multimodal Vision)
    if (imageBase64 && imageBase64.startsWith("data:image/")) {
      console.log("Vision OCR payload length:", imageBase64.length);

      if (!apiKey) {
        return NextResponse.json(
          { error: "LLM_API_KEY is not configured on the server to run Vision OCR." },
          { status: 500 }
        );
      }

      let visionSuccess = false;
      let lastVisionError = "";

      for (const vModel of visionModels) {
        try {
          console.log(`Attempting Vision OCR with model: ${vModel}`);
          for (let attempt = 0; attempt <= 1; attempt++) {
            const visionResponse = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: vModel,
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: `You are an expert OCR transcription engine. Accurately transcribe all chat bubbles, sender names, and timestamps from this screenshot in their original language (German, English, Spanish, Arabic, etc.).
CRITICAL BUBBLE ORIENTATION:
- Left-side bubbles (gray/white/incoming) = "Them: [message]"
- Right-side bubbles (blue/green/outgoing) = "You: [message]"
- If the other person writes a name (e.g. "Abdu"), they are addressing the user.
Return ONLY the transcribed text dialogue without markdown commentary.`,
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: imageBase64,
                        },
                      },
                    ],
                  },
                ],
                temperature: 0.1,
                max_tokens: 500,
              }),
            });

            if (visionResponse.status === 429 && attempt === 0) {
              console.warn(`Vision model ${vModel} rate limited (429). Auto-waiting 1.8s before retry...`);
              await new Promise((resolve) => setTimeout(resolve, 1800));
              continue;
            }

            const visionJson = await visionResponse.json();
            console.log(`Groq Vision Response (${vModel}):`, JSON.stringify(visionJson).slice(0, 300));

            if (visionResponse.ok && visionJson.choices?.[0]?.message?.content) {
              const rawContent = visionJson.choices[0].message.content;
              const cleaned = extractCleanTranscription(rawContent);
              if (cleaned && cleaned.trim().length > 0) {
                conversationText = cleaned.trim();
                visionSuccess = true;
                console.log("Vision OCR successfully transcribed:", conversationText.slice(0, 150));
                break;
              }
            } else {
              lastVisionError = visionJson.error?.message || `HTTP ${visionResponse.status}`;
            }
            break;
          }
          if (visionSuccess) break;
        } catch (vErr: any) {
          console.error(`Vision model ${vModel} error:`, vErr);
          lastVisionError = vErr.message;
        }
      }

      if (!visionSuccess || !conversationText) {
        // DO NOT silently return mock fallback for image uploads!
        return NextResponse.json(
          {
            error: `Vision OCR failed to parse the screenshot: ${
              lastVisionError || "No readable text detected in image"
            }. Please ensure the image is clear or paste the text snippet directly.`,
          },
          { status: 400 }
        );
      }
    }

    if (!conversationText || conversationText.length === 0) {
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

    const systemPrompt = `You are "Decoded", an elite behavioral psychologist, dating strategist, and interpersonal subtext analyzer. You analyze texting dynamics and interpersonal communication through radical honesty, non-neediness, and outcome independence ("Fuck Yes or No").

### 👑 CORE BEHAVIORAL PRINCIPLES:

1. 🎯 SENDER & USER FRAME STATUS CLASSIFICATION (CRITICAL):
   - "status" in the JSON schema strictly represents the USER'S frame position in the UI:
     * "Leading" -> (UI renders "You Hold Frame"): Classify as "Leading" whenever the OTHER person is chasing, sending desperate pleas, long paragraphs, apologies, or begging while the user remains composed, grounded, and concise.
     * "Chasing" -> (UI renders "You Are Chasing"): ONLY use this if the USER is the one desperately double-texting, over-explaining, or begging for validation.
     * "Balanced" -> (UI renders "Balanced Frame"): Mutual equal investment and cadence.
     * "Testing Frame" -> (UI renders "Testing Frame"): Other person is shit-testing or testing boundaries.
     * "Fading" -> (UI renders "Interest Fading"): Other person is pulling away, giving cold one-word replies, or ghosting.
   - When the other person is begging or pleading ("bitte abdu... ich bettelt"), the USER is in the "Leading" (You Hold Frame) position!

2. 🧠 "internalMonologue" REPRESENTS THE OTHER PERSON:
   - "internalMonologue" MUST be the OTHER PERSON'S raw, unfiltered internal thoughts and emotions as they text the user (e.g. "ich kann ohne ihn nicht sein, es ist mir so peinlich zu betteln aber ich brauche ihn"). NEVER write the user's thoughts here.

3. 🇩🇪 GERMAN GRAMMAR & IDIOMATIC INTEGRITY (MANDATORY):
   - Every German reply MUST be a grammatically complete, natural sentence. NEVER drop necessary verbs or truncate clauses under word constraints (e.g. write "lass uns erst mal Abstand halten" or "lass uns beiden erst mal etwas Abstand geben", NEVER cut off verbs to produce broken phrases like "lass uns erstmal abstand").
   - In farewell/closure contexts, ALWAYS use the correct idiom "ich wünsche dir trotzdem alles Gute" (with "Gute" ending in -e), NEVER "alles gut".
   - Ensure all verbs and separable particles (e.g. "runterkommen", "abstand nehmen", "telefonieren") are fully present and idiomatic.

4. 🇩🇪 GERMAN COLLOQUIAL & EMOTIONAL RECOGNITION:
   - Phrases like "es probieren", "wieder zusammenkommen", "gib mir eine chance", "betteln", "ich halt es nicht aus", "ich kann nicht ohne dich" ALWAYS signify romantic reconciliation / an ex begging to get back together.
   - NEVER misinterpret "probieren" or "versuch" as trying a new casual date or activity! It is literally pleading to restart a broken relationship.

5. 🔍 SCREENSHOT EVIDENCE OVERRIDES UI TOGGLES:
   - If the transcribed conversation clearly shows an ex dynamic, breakup pleading, or emotional crisis, IGNORE any generic UI toggle (e.g. if the user left "Talking Stage" selected) and prioritize the actual chat evidence.

6. 💬 HIGH-EQ GERMAN RESPONSE PLAYBOOK:
   - When an ex is pleading/begging, generate mature, high-status German replies:
     * Safe Play (Holding frame / calm composure): e.g. "hey, danke dir. lass uns da jetzt keinen druck machen und erst mal runterkommen." or "ich schätze deine ehrlichkeit, aber lass uns beiden erst mal etwas abstand geben."
     * Bold Play (Decisive boundary / finality): e.g. "wir drehen uns im kreis. betteln bringt nichts und ändert nichts an der situation." or "das ist vorbei, ich wünsche dir trotzdem alles Gute."
   - NEVER generate confused, robotic, or naive responses like "kannst du mir genauer sagen, was du meinst?" or "ich bin nicht dein problem".

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

    const userPrompt = `Relationship Context: ${relationshipContext || "Not specified"}
Conversation Snippet:
"""
${conversationText}
"""

Analyze this snippet with psychological accuracy and generate the structured JSON payload. Remember: If the conversation is in German or another language, generate safePlay.reply and boldPlay.reply in that language!`;

    let response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: textModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok && textModel !== fallbackTextModel) {
      console.warn(`Primary text model ${textModel} failed (${response.status}). Retrying with fallback: ${fallbackTextModel}`);
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: fallbackTextModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.6,
          response_format: { type: "json_object" },
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Upstream LLM error:", response.status, errorText);
      return NextResponse.json(
        { error: `LLM Reasoning Engine failed (${response.status}): ${errorText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json(
        { error: "Empty response from reasoning model." },
        { status: 500 }
      );
    }

    const cleanedJson = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanedJson) as Partial<AnalysisResponse>;

    let safeReply = parsed.safePlay?.reply || "haha all good, catch you around";
    let boldReply = parsed.boldPlay?.reply || "let's skip the small talk. drink this week?";
    if (userVoiceProfile?.styleToggles?.allLowercase) {
      safeReply = safeReply.toLowerCase();
      boldReply = boldReply.toLowerCase();
    }

    const sanitizedResponse: AnalysisResponse = {
      subtext:
        parsed.subtext ||
        "They are communicating with strong underlying subtext and testing emotional boundaries.",
      status: VALID_STATUSES.includes(parsed.status as DynamicStatus)
        ? (parsed.status as DynamicStatus)
        : "Testing Frame",
      energyLevel: VALID_ENERGY_LEVELS.includes(parsed.energyLevel as EnergyLevel)
        ? (parsed.energyLevel as EnergyLevel)
        : "Balanced",
      trapToAvoid:
        parsed.trapToAvoid ||
        "Do not over-invest or react emotionally before understanding the frame dynamic.",
      internalMonologue:
        parsed.internalMonologue ||
        "I want to see how they respond when I reach out like this.",
      safePlay: {
        reply: safeReply,
        reasoning:
          parsed.safePlay?.reasoning ||
          "Demonstrates grounded composure, relieves pressure, and maintains frame.",
        timing: parsed.safePlay?.timing || "Match their response delay",
      },
      boldPlay: {
        reply: boldReply,
        reasoning:
          parsed.boldPlay?.reasoning ||
          "Directly addresses the dynamic with radical honesty and clarity.",
        risk: parsed.boldPlay?.risk || "Forces immediate transparency.",
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
      transcribedText: conversationText,
    };

    return NextResponse.json(sanitizedResponse, { status: 200 });
  } catch (error: any) {
    console.error("Analysis route error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process psychological analysis. Please try again." },
      { status: 500 }
    );
  }
}
