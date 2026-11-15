import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 8000;
const DAILY_LIMIT = 10;

function gatewayError(status, provider) {
  if (status === 401) return provider === "groq" ? "Aahana free AI provider key is invalid. Please check the server configuration." : "AI service authentication is not ready. Please try again later.";
  if (status === 402 || status === 403) return provider === "groq" ? "Aahana free AI provider rejected this request. Please check the provider account and model access." : "AI service billing verification or credits are required before Aahana can respond.";
  if (status === 429) return "The AI service is busy. Please wait a moment and try again.";
  return "Aahana could not reach the AI service. Please try again.";
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to use Aahana." }, { status: 401 });
  }

  if (process.env.AAHANA_AI_ENABLED !== "true") {
    return NextResponse.json({ error: "Aahana AI is not enabled yet." }, { status: 503 });
  }

  // Basic mode uses Groq's no-card Free tier only. Never fall back to paid Vercel AI Gateway.
  const provider = (process.env.AAHANA_AI_PROVIDER || "groq").toLowerCase();
  const isGroq = provider === "groq";
  const providerKey = isGroq
    ? process.env.GROQ_API_KEY
    : (request.headers.get("x-vercel-oidc-token") || process.env.VERCEL_OIDC_TOKEN);
  const model = process.env.AAHANA_MODEL || (isGroq ? "openai/gpt-oss-120b" : "");
  if (!providerKey || !model) {
    const code = !providerKey ? (isGroq ? "MISSING_GROQ_API_KEY" : "MISSING_GATEWAY_AUTH") : "MISSING_MODEL";
    console.error("Aahana AI configuration missing:", { provider, keyPresent: Boolean(providerKey), modelPresent: Boolean(model) });
    return NextResponse.json({
      error: !providerKey ? "Aahana free AI provider key is not connected yet." : "Aahana Vercel AI Gateway authentication token is missing.",
      code,
    }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const prompt = typeof body?.message === "string" ? body.message.trim() : "";
  const image = body?.image && typeof body.image === "object" ? body.image : null;
  const imageDataUrl = typeof image?.dataUrl === "string" ? image.dataUrl : "";
  const imageMatch = imageDataUrl.match(/^data:(image\\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (image && (!imageMatch || imageDataUrl.length > 2_850_000)) {
    return NextResponse.json({ error: "Please attach one PNG, JPEG or WebP image under 2 MB." }, { status: 400 });
  }
  const mode = ["solve", "create", "write", "build", "improve"].includes(body?.mode) ? body.mode : "solve";
  const requestedConversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
  const requestedProjectId = typeof body?.projectId === "string" ? body.projectId : null;

  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: `Your message must be between 1 and ${MAX_PROMPT_LENGTH} characters.` }, { status: 400 });
  }

  let projectId = requestedProjectId;
  if (projectId) {
    const { data: ownedProject, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .neq("status", "archived")
      .maybeSingle();
    if (projectError || !ownedProject) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  let conversationId = requestedConversationId;
  let createdConversation = false;

  if (conversationId) {
    const { data: existing, error } = await supabase
      .from("conversations")
      .select("id, project_id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !existing) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    const updates = { mode, updated_at: new Date().toISOString() };
    if (projectId) updates.project_id = projectId;
    else projectId = existing.project_id || null;
    await supabase.from("conversations").update(updates).eq("id", conversationId).eq("user_id", user.id);
  } else {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, mode, project_id: projectId, title: prompt.slice(0, 72) || "New conversation" })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: "Could not create your conversation." }, { status: 500 });
    }
    conversationId = created.id;
    createdConversation = true;
  }

  const { data: savedUserMessage, error: messageError } = await supabase.from("messages").insert({
    user_id: user.id,
    conversation_id: conversationId,
    role: "user",
    content: image ? `${prompt}\\n[Image attached: ${imageMatch[1]}]` : prompt,
  }).select("id").single();

  if (messageError || !savedUserMessage) {
    if (createdConversation) await supabase.from("conversations").delete().eq("id", conversationId);
    return NextResponse.json({ error: "Could not save your message." }, { status: 500 });
  }

  const { data: quota, error: quotaError } = await supabase.rpc("reserve_my_ai_request", { p_daily_limit: DAILY_LIMIT });
  const quotaRow = Array.isArray(quota) ? quota[0] : quota;

  if (quotaError || !quotaRow?.allowed) {
    await supabase.from("messages").delete().eq("id", savedUserMessage.id).eq("user_id", user.id);
    if (createdConversation) await supabase.from("conversations").delete().eq("id", conversationId);
    const used = quotaRow?.requests_used ?? DAILY_LIMIT;
    return NextResponse.json({
      error: quotaError ? "Usage limits could not be checked. Please try again." : `You've reached today's limit of ${DAILY_LIMIT} AI requests.`,
      requestsUsed: used,
      requestsLimit: DAILY_LIMIT,
    }, { status: quotaError ? 503 : 429 });
  }

  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (historyError || !history?.length) {
    await supabase.rpc("release_my_ai_request");
    return NextResponse.json({ error: "Could not load conversation context." }, { status: 500 });
  }

  // Keep the most recent context, not the first 20 messages in a long conversation.
  // Bound prompt size so older conversations cannot create unexpectedly large AI costs.
  const context = [];
  let contextCharacters = 0;
  for (const item of history) {
    if (contextCharacters >= 24000) break;
    const content = String(item.content || "").slice(-Math.max(0, 24000 - contextCharacters));
    if (content) {
      const isCurrentImageMessage = Boolean(image && item.role === "user" && content.includes("[Image attached:"));
      context.push({
        role: item.role,
        content: isCurrentImageMessage
          ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageDataUrl } }]
          : content,
      });
      contextCharacters += content.length;
    }
  }
  context.reverse();

  const systemPrompt = [
    "You are Aahana, a knowledgeable, thoughtful, capable general-purpose AI assistant for people around the world.",
    "Draw on broad learned knowledge across natural sciences, oceans and marine life, climate, geography, space, mathematics, medicine and health education, engineering, computing, AI, technology, history, civics, economics, business, law and policy education, languages, literature, arts, cultures, agriculture, education, careers, and everyday practical life.",
    "Treat every subject as worth answering well, from a simple school question to an advanced technical discussion. Explain concepts clearly at the user's level, define unfamiliar terms, use examples and structured steps when helpful, and adapt to the requested depth and language.",
    "When asked to create exam papers, practice tests, question banks, or key-answer sheets, produce a classroom-ready document: title, class/level, subject, syllabus or topic scope, duration, total marks, clear instructions, balanced sections, question numbering, mark allocation, and an answer key with concise marking points. Verify that section marks add up to the stated total. Match the requested board or curriculum only when the user names it; otherwise label the paper as original practice material, never as an official or leaked paper. Keep the answer key separate from the question paper so it can be printed independently when requested.",
    "When asked to identify an object, place, plant, animal, diagram, document, or image, be precise about what evidence is available. Distinguish confident identification from a likely match, explain visual clues, and ask for a clearer image or context if needed. Never claim to have inspected an image or file that was not actually provided to the model.",
    "For science and technical questions, reason carefully, check units and assumptions, and distinguish established evidence from hypotheses. For calculations, show enough working to make the result checkable.",
    "Be honest about uncertainty, knowledge limits, and information that may have changed. Never invent sources, quotations, statistics, personal facts, current events, or capabilities. If live or location-specific facts are needed and no search tool is available in this request, say that current verification is needed rather than presenting guesses as current facts.",
    "Respect privacy: do not claim to know private information about people, infer sensitive personal traits, or expose personal data. Discuss public figures using reliable public information and distinguish public facts from speculation.",
    "Do not pretend to know the signed-in user personally unless verified profile or saved-memory context is explicitly supplied in this request. Do not invent or silently create memories.",
    "Be clear, practical, respectful, and direct. Do not claim to have taken actions or accessed systems unless tools actually did so.",
    `The selected mode is: ${mode}. Match your response to this mode: solve, create, write, build or improve.`,
    "Ask only for information essential to completing the task. Prefer useful, accurate answers over generic encouragement.",
  ].join(" ");

  let upstream;
  try {
    const endpoint = isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://ai-gateway.vercel.sh/v1/chat/completions";
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: image && isGroq ? (process.env.AAHANA_VISION_MODEL || "qwen/qwen3.8-27b") : model,
        stream: true,
        ...(isGroq ? { max_completion_tokens: 1200 } : { max_tokens: 1200 }),
        messages: [
          { role: "system", content: systemPrompt },
          ...context,
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    await supabase.rpc("release_my_ai_request");
    return NextResponse.json({ error: "Aahana could not connect to the AI service. Please try again." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    await supabase.rpc("release_my_ai_request");
    const gatewayRequestId = upstream.headers.get("x-request-id") || upstream.headers.get("x-vercel-id") || null;
    const responseText = await upstream.text().catch(() => "");
    const safeDetail = responseText.replace(/[\r\n\t]+/g, " ").slice(0, 500);
    console.error("Aahana AI Gateway rejected request:", {
      status: upstream.status,
      requestId: gatewayRequestId,
      detail: safeDetail,
    });
    const code = upstream.status === 401 ? "GATEWAY_UNAUTHORIZED"
      : upstream.status === 402 ? "GATEWAY_PAYMENT_REQUIRED"
      : upstream.status === 403 ? "GATEWAY_FORBIDDEN"
      : upstream.status === 429 ? "GATEWAY_RATE_LIMITED"
      : "GATEWAY_UPSTREAM_ERROR";
    return NextResponse.json({
      error: gatewayError(upstream.status, provider),
      code,
      gatewayStatus: upstream.status,
      requestId: gatewayRequestId,
    }, { status: upstream.status === 429 ? 429 : 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let fullReply = "";

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      let finished = false;

      const handleLine = (line) => {
        if (!line.startsWith("data:")) return;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") return;
        try {
          const payload = JSON.parse(data);
          const delta = payload.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            fullReply += delta;
            controller.enqueue(encoder.encode(delta));
          }
        } catch {
          // Ignore non-JSON keepalive or metadata frames.
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) handleLine(line.replace(/\r$/, ""));
        }
        buffer += decoder.decode();
        if (buffer) handleLine(buffer.replace(/\r$/, ""));
        finished = true;

        if (fullReply.trim()) {
          const { error: saveError } = await supabase.rpc("save_ai_reply", {
            p_conversation_id: conversationId,
            p_content: fullReply.slice(0, 16000),
          });
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
          if (saveError) console.error("Aahana reply persistence failed:", saveError.message);
        }
        controller.close();
      } catch (error) {
        console.error("Aahana stream failed:", error?.message || "unknown error");
        if (!finished) controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    async cancel() {
      await reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Conversation-Id": conversationId,
      "X-Requests-Used": String(quotaRow.requests_used),
      "X-Requests-Limit": String(quotaRow.requests_limit),
    },
  });
}
