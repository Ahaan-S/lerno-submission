import { chat, resolveModel } from "@/lib/ai/llm";
import type { ContentBlock } from "@/lib/ai/llm";
import type { AttachmentMeta } from "@/lib/database.types";
import { SUBJECT_LABELS } from "@/lib/chapters";

export interface RewriterContext {
  /** The user message immediately before the current one (not the current message) */
  lastUserMessage?: string;
  /**
   * The last AI response — passed as first 200 chars + last 200 chars.
   * First chars: captures what topic was being explained.
   * Last chars: captures "would you like to learn more about X?" endings.
   */
  lastAssistantMessage?: string;
}

export interface RewriterResult {
  /** Clean, keyword-rich NCERT-aligned query for embedding + full-text search */
  query: string;
  /**
   * How many chunks to retrieve (min 5, max 12).
   * 5 for simple factual questions.
   * 7-8 for medium single-concept questions.
   * 10-12 for broad multi-part questions.
   */
  k: number;
  /**
   * When true, the message is purely conversational (greeting, thanks, casual chat)
   * and Qdrant retrieval should be skipped entirely.
   */
  skipSearch?: boolean;
  /** Direct reply to use when skipSearch is true (avoids a second LLM call). */
  directAnswer?: string;
  /** Why retrieval was skipped (useful for analytics/debug). */
  skipReason?: "greeting" | "acknowledgement" | "meta" | "general_knowledge";
  /** Keyword/phrase that triggered skip_search. */
  skipTrigger?: string | null;
  /**
   * Populated only when `subjectOptions` is passed: the detected subject slug,
   * or null if the message is non-academic / doesn't match any subject.
   */
  detectedSubject?: string | null;
}

function buildInstantSkipAnswer(reason: "greeting" | "acknowledgement" | "meta"): string {
  if (reason === "greeting") {
    return "Hey! I am here. Ask me any study question and I will help right away.";
  }
  if (reason === "acknowledgement") {
    return "Great. Share your next question whenever you are ready.";
  }
  return "I am Lerno AI Tutor. I can explain concepts, solve questions step by step, make quick notes, and help with NCERT-based study prep.";
}

function detectInstantSkipIntent(userMessage: string): {
  reason: "greeting" | "acknowledgement" | "meta";
  trigger: string;
} | null {
  const normalized = userMessage.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;

  const greetingPatterns: Array<{ re: RegExp; trigger: string }> = [
    { re: /^(hi|hello|hey|hii|heyy)\b/, trigger: "greeting" },
    { re: /^(good morning|good afternoon|good evening)\b/, trigger: "good greeting" },
    { re: /^(namaste|namaskar)\b/, trigger: "namaste" },
  ];
  for (const p of greetingPatterns) {
    if (p.re.test(normalized)) return { reason: "greeting", trigger: p.trigger };
  }

  const ackPatterns: Array<{ re: RegExp; trigger: string }> = [
    { re: /^(ok|okay|okk|kk)\b/, trigger: "ok" },
    { re: /^(thanks|thank you|thx|ty)\b/, trigger: "thanks" },
    { re: /^(got it|understood|noted|cool|alright|all right)\b/, trigger: "acknowledgement" },
    { re: /^(thik hai|theek hai)\b/, trigger: "thik hai" },
  ];
  for (const p of ackPatterns) {
    if (p.re.test(normalized)) return { reason: "acknowledgement", trigger: p.trigger };
  }

  const metaPatterns: Array<{ re: RegExp; trigger: string }> = [
    { re: /\b(who are you)\b/, trigger: "who are you" },
    { re: /\b(what can you do)\b/, trigger: "what can you do" },
    { re: /\b(how can you help)\b/, trigger: "how can you help" },
    { re: /\b(are you (an )?ai)\b/, trigger: "are you ai" },
  ];
  for (const p of metaPatterns) {
    if (p.re.test(normalized)) return { reason: "meta", trigger: p.trigger };
  }

  return null;
}

/**
 * Rewrites a student's casual/Hinglish query into a clean retrieval query,
 * and estimates how many chunks are needed (K) based on question complexity.
 *
 * Attachment-aware:
 *   - Images: passed as vision blocks using the vision model so the rewriter
 *     can actually see the question paper / diagram and generate a targeted query.
 *   - PDFs: first 1000 chars of extracted text are injected into the message so
 *     the rewriter knows what the document is about.
 *
 * Returns { query, k }. Falls back to { query: original, k: 5 } on any error.
 */
export async function rewriteQueryForRetrieval(
  userMessage: string,
  grade: number | string,
  subject: string,
  context?: RewriterContext,
  attachments?: AttachmentMeta[],
  /** When provided, the rewriter also detects which subject the message belongs to */
  subjectOptions?: string[]
): Promise<RewriterResult> {
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;

  const contextBlock =
    context?.lastUserMessage || context?.lastAssistantMessage
      ? `PREVIOUS EXCHANGE (for resolving follow-up questions only):
${context.lastUserMessage ? `Last student message: "${context.lastUserMessage.slice(0, 150)}"` : ""}
${context.lastAssistantMessage ? `Last AI response (excerpt): "${context.lastAssistantMessage}"` : ""}`
      : "";

  const imageAttachments = (attachments ?? []).filter((a) => a.type.startsWith("image/"));
  const pdfAttachments = (attachments ?? []).filter(
    (a) => a.type === "application/pdf" && a.extracted_text
  );
  const hasImages = imageAttachments.length > 0;
  const hasAnyAttachments = (attachments ?? []).length > 0;
  const detectingSubject = subjectOptions && subjectOptions.length > 0;

  // Ultra-fast path for obvious non-academic chat: skip model call entirely.
  // This preserves instant responsiveness for greetings/acks/meta questions.
  if (!hasAnyAttachments) {
    const instantSkip = detectInstantSkipIntent(userMessage);
    if (instantSkip) {
      const directAnswer = buildInstantSkipAnswer(instantSkip.reason);
      return {
        query: userMessage || subject,
        k: 5,
        skipSearch: true,
        directAnswer,
        skipReason: instantSkip.reason,
        skipTrigger: instantSkip.trigger,
        ...(detectingSubject && { detectedSubject: null }),
      };
    }
  }

  // Build the user content block sent to the rewriter.
  // For images: multimodal — include the actual image so the model can see what's being asked.
  // For PDFs: prepend extracted text so the model knows the document content.
  // For plain text: unchanged.
  let userContent: string | ContentBlock[];

  if (hasImages) {
    const blocks: ContentBlock[] = [];

    const textLines: string[] = [];
    if (userMessage) textLines.push(userMessage);
    textLines.push(
      "Look at the attached image(s). Identify the specific topic, concept, or question being asked about. Use that to generate the retrieval query."
    );
    for (const pdf of pdfAttachments) {
      textLines.push(`[Document: "${pdf.name}"]\n${pdf.extracted_text!.slice(0, 800)}`);
    }
    blocks.push({ type: "text", text: textLines.join("\n\n") });

    for (const img of imageAttachments) {
      blocks.push({ type: "image_url", image_url: { url: img.url, detail: "low" } });
    }

    userContent = blocks;
  } else if (pdfAttachments.length > 0) {
    const pdfContext = pdfAttachments
      .map((p) => `[Document: "${p.name}"]\n${p.extracted_text!.slice(0, 1000)}`)
      .join("\n\n");
    userContent = userMessage ? `${userMessage}\n\n${pdfContext}` : pdfContext;
  } else {
    userContent = userMessage;
  }

  // Use vision model when images are present — lite model cannot see images.
  // Temperature 0 + jsonMode = deterministic, strictly-formatted JSON output.
  const modelOverride = hasImages ? resolveModel(true) : undefined;
  const subjectDetectionBlock = detectingSubject
    ? `
SUBJECT DETECTION (included because the user hasn't selected a subject):
You must also identify which subject this message belongs to from this list: ${subjectOptions!.join(", ")}.
- If the message is academic, set "subject" to the matching slug (e.g. "math", "science").
- If the message is a greeting, joke, casual chat, or clearly not a school topic, set "subject" to null.
- The "query" and "k" fields must still be filled even when "subject" is null (use the message as-is for query).

Extend the JSON output to include these fields too:
{"query":"...","k":<number>,"subject":"<slug>|null","skip_search":true|false,"direct_answer":"...","skip_reason":"greeting|acknowledgement|meta|general_knowledge|null","skip_trigger":"...|null"}
`
    : "";

  const jsonFormat = detectingSubject
    ? `{"query":"<rewritten English query>","k":<number>,"subject":"<slug or null>","skip_search":true|false,"direct_answer":"<short answer if skip_search=true else empty>","skip_reason":"greeting|acknowledgement|meta|general_knowledge|null","skip_trigger":"<keyword/phrase>|null"}`
    : `{"query":"<rewritten English query>","k":<number>,"skip_search":true|false,"direct_answer":"<short answer if skip_search=true else empty>","skip_reason":"greeting|acknowledgement|meta|general_knowledge|null","skip_trigger":"<keyword/phrase>|null"}`;

  const systemPrompt = `You are a search query optimizer for an Indian school education platform (${subjectLabel || `Grade ${grade}`}, Grade ${grade}).

REQUIRED OUTPUT — respond with ONLY this JSON, nothing else:
${jsonFormat}

EXAMPLES:

Student says: "photosynthesis kya hota hai"
→ {"query": "process of photosynthesis light reactions dark reactions chlorophyll", "k": 7, "skip_search": false}

Student says: "tell me about acids"
→ {"query": "acids properties types examples indicators pH scale reactions", "k": 10, "skip_search": false}

Student says: "what about copper sulphide" (Context: previous conversation was about extraction of metals)
→ {"query": "extraction of copper from copper sulphide ore roasting smelting refining", "k": 10, "skip_search": false}

Student says: "yes explain more" (Context: AI was explaining Ohm's law)
→ {"query": "Ohm law relationship voltage current resistance derivation applications", "k": 10, "skip_search": false}

Student says: "What is the chemical formula of baking soda"
→ {"query": "chemical formula baking soda sodium bicarbonate NaHCO3 properties", "k": 5, "skip_search": false}

Student says: "ans q 8" (with an image of a question paper showing a question about Newton's laws)
→ {"query": "Newton second law force mass acceleration problems", "k": 7, "skip_search": false}

Student says: "hi" / "hello" / "hey" / "good morning"
→ {"query":"hi","k":5,"skip_search":true,"direct_answer":"Hey! I am here. Ask me any study question and I will help right away.","skip_reason":"greeting","skip_trigger":"hi"}

Student says: "thanks" / "okay" / "got it" / "ok" / "thik hai" / "shukriya"
→ {"query":"thanks","k":5,"skip_search":true,"direct_answer":"Great. Share your next question whenever you are ready.","skip_reason":"acknowledgement","skip_trigger":"thanks"}

Student says: "who are you" / "what can you do" / "are you an AI"
→ {"query":"who are you","k":5,"skip_search":true,"direct_answer":"I am Lerno AI Tutor. I can explain concepts, solve questions step by step, make quick notes, and help with NCERT-based study prep.","skip_reason":"meta","skip_trigger":"who are you"}

Student says: "What is 2+2?"
→ {"query":"what is 2+2","k":5,"skip_search":true,"direct_answer":"2 + 2 = 4.","skip_reason":"general_knowledge","skip_trigger":"2+2"}

${contextBlock ? contextBlock + "\n" : ""}${hasImages ? "IMPORTANT: The student has attached an image (question paper, diagram, or textbook page). Look at it carefully. Identify the specific concept or question being asked. Base the retrieval query on what you actually see in the image.\n" : ""}${subjectDetectionBlock}
REWRITING RULES:
- The CURRENT student message is the primary input — rewrite based on it first
- Translate Hindi/Hinglish to English
- Use proper scientific/historical/technical terminology
- Remove filler words and conversational language
- ALWAYS add related technical keywords that would help find textbook content
- Maximum 20 words
- Do NOT include subject name, grade, or "NCERT" — the search is already filtered
- Only use previous exchange context if current message is genuinely ambiguous on its own (e.g. "what about X?", "yes", "explain more")
- If the current message is self-contained — ignore context entirely

K RULES:
- K=5: Simple factual ("What is NaCl?", "Define photosynthesis", "Who was Gandhi?")
- K=7: Single concept explanation ("Explain Ohm's law", "How does osmosis work?")
- K=10: Multi-concept or comparative ("Compare mitosis meiosis", "Types of chemical reactions")
- K=12: Broad multi-category ("Extraction of all metals", "Entire water cycle", "All types of soil")
- Minimum 5, maximum 12

SKIP_SEARCH RULES:
- Set skip_search to true for:
  1) pure greetings/acknowledgments/meta-chat, OR
  2) very basic general-knowledge or arithmetic facts that do not need textbook retrieval
- Set skip_search to false for academic questions that may benefit from NCERT grounding
- When in doubt, set skip_search to false
- skip_search is very rarely true; most messages should have skip_search: false
- If skip_search=true, "direct_answer" is REQUIRED (1-4 short sentences, plain text, no markdown)
- If skip_search=false, set "direct_answer" to empty string and skip_reason/skip_trigger to null

CRITICAL: Your output must be ONLY the JSON object. No markdown. No code fences. No explanation. No preamble. Just the JSON.`;

  try {
    const rewriteMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userContent },
    ];
    const baseOpts = {
      temperature: 0,
      jsonMode: true as const,
      ...(modelOverride && { model: modelOverride }),
    };

    let raw: string;
    try {
      raw = await chat(rewriteMessages, baseOpts);
    } catch (firstErr) {
      const emsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      const modelMissing =
        emsg.includes("404") ||
        emsg.includes("not found") ||
        emsg.includes("NotFound") ||
        emsg.includes("was not found");
      if (modelMissing) {
        console.warn(
          "[query-rewriter] Rewriter model unavailable in this region — retrying with main flash model:",
          emsg.slice(0, 160)
        );
        raw = await chat(rewriteMessages, {
          ...baseOpts,
          model: resolveModel(false),
        });
      } else {
        throw firstErr;
      }
    }

    const cleaned = raw.trim();

    try {
      const parsed = JSON.parse(cleaned) as {
        query?: string;
        k?: number;
        subject?: string | null;
        skip_search?: boolean;
        direct_answer?: string;
        skip_reason?: "greeting" | "acknowledgement" | "meta" | "general_knowledge" | null;
        skip_trigger?: string | null;
      };
      const query =
        typeof parsed.query === "string" && parsed.query.length >= 3
          ? parsed.query
          : userMessage || subject;
      const k =
        typeof parsed.k === "number"
          ? Math.min(12, Math.max(5, Math.round(parsed.k)))
          : 5;
      const skipSearch = parsed.skip_search === true;
      const skipReason =
        parsed.skip_reason === "greeting" ||
        parsed.skip_reason === "acknowledgement" ||
        parsed.skip_reason === "meta" ||
        parsed.skip_reason === "general_knowledge"
          ? parsed.skip_reason
          : undefined;
      const skipTrigger = typeof parsed.skip_trigger === "string" && parsed.skip_trigger.trim().length > 0
        ? parsed.skip_trigger.trim().slice(0, 80)
        : null;
      const directAnswer =
        skipSearch
          ? (
              typeof parsed.direct_answer === "string" && parsed.direct_answer.trim().length > 0
                ? parsed.direct_answer.trim()
                : buildInstantSkipAnswer(skipReason === "greeting" || skipReason === "acknowledgement" || skipReason === "meta" ? skipReason : "meta")
            )
          : "";

      // When subject detection was requested, extract and validate the detected subject
      let detectedSubject: string | null | undefined;
      if (detectingSubject) {
        const raw = parsed.subject;
        detectedSubject = (typeof raw === "string" && subjectOptions!.includes(raw)) ? raw : null;
      }

      // Detect if model echoed back the input unchanged — common failure mode with lite models
      const normalizedInput = userMessage.trim().toLowerCase().replace(/[?.!,]+$/g, "");
      const normalizedOutput = query.trim().toLowerCase().replace(/[?.!,]+$/g, "");
      if (normalizedOutput === normalizedInput && normalizedInput.length > 0 && !skipSearch) {
        console.warn(
          `[query-rewriter] Model returned unchanged query — retrieval may be suboptimal | input: "${normalizedInput}"`
        );
      }

      console.log(
        `[query-rewriter] "${userMessage.slice(0, 60)}"${hasImages ? " +img" : ""}${pdfAttachments.length ? " +pdf" : ""} → "${query}" | k: ${k}${skipSearch ? " | SKIP_SEARCH" : ""}${detectedSubject !== undefined ? ` | subject: ${detectedSubject ?? "null (non-academic)"}` : ""} | model: ${modelOverride ?? "GEMINI_LITE_MODEL"}`
      );
      return {
        query,
        k,
        skipSearch,
        ...(skipSearch && { directAnswer, skipReason, skipTrigger }),
        ...(detectingSubject && { detectedSubject }),
      };
    } catch {
      // LLM returned plain text instead of JSON — use it as the query with default K
      const fallbackQuery = cleaned.length >= 3 ? cleaned : userMessage || subject;
      console.warn(`[query-rewriter] JSON parse failed, using plain text as query | raw: "${cleaned.slice(0, 80)}"`);
      return { query: fallbackQuery, k: 5, ...(detectingSubject && { detectedSubject: null }) };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota =
      msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("Quota exceeded");
    if (isQuota) {
      console.warn("[query-rewriter] LLM quota/rate limit — using original text for retrieval (no rewrite)");
    } else {
      console.warn("[query-rewriter] Rewrite failed — using original message:", msg.slice(0, 200));
    }
    return { query: userMessage || subject, k: 5, ...(detectingSubject && { detectedSubject: null }) };
  }
}
