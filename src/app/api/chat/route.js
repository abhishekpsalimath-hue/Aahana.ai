import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 8000;
const DAILY_LIMIT = 10;

function gatewayError(status) {
  if (status === 401) return "AI service authentication is not ready. Please try again later.";
  if (status === 402 || status === 403) return "AI service billing verification or credits are required before Aahana can respond.";
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

  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const model = process.env.AAHANA_MODEL;
  if (!oidcToken || !model) {
    return NextResponse.json({ error: "Aahana's AI connection is not configured yet." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const prompt = typeof body?.message === "string" ? body.message.trim() : "";
  const mode = ["solve", "create", "write", "build", "improve"].includes(body?.mode) ? body.mode : "solve";
  const requestedConversationId = typeof body?.conversationId === "string" ? body.conversationId : null;

  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: `Your message must be between 1 and ${MAX_PROMPT_LENGTH} characters.` }, { status: 400 });
  }

  let conversationId = requestedConversationId;
  let createdConversation = false;

  if (conversationId) {
    const { data: existing, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !existing) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    await supabase.from("conversations").update({ mode, updated_at: new Date().toISOString() }).eq("id", conversationId);
  } else {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, mode, title: prompt.slice(0, 72) || "New conversation" })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: "Could not create your conversation." }, { status: 500 });
    }
    conversationId = created.id;
    createdConversation = true;
  }

  const { error: messageError } = await supabase.from("messages").insert({
    user_id: user.id,
    conversation_id: conversationId,
    role: "user",
    content: prompt,
  });

  if (messageError) {
    if (createdConversation) await supabase.from("conversations").delete().eq("id", conversationId);
    return NextResponse.json({ error: "Could not save your message." }, { status: 500 });
  }

  const { data: quota, error: quotaError } = await supabase.rpc("reserve_my_ai_request", { p_daily_limit: DAILY_LIMIT });
  const quotaRow = Array.isArray(quota) ? quota[0] : quota;

  if (quotaError || !quotaRow?.allowed) {
    await supabase.from("messages").delete().eq("conversation_id", conversationId).eq("role", "user").eq("content", prompt).order?.("created_at");
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
    .order("created_at", { ascending: true })
    .limit(20);

  if (historyError || !history?.length) {
    return NextResponse.json({ error: "Could not load conversation context." }, { status: 500 });
  }

  const systemPrompt = [
    "You are Aahana, a thoughtful, capable general-purpose AI assistant.",
    "Help across personal, educational, creative, business, technical and professional domains.",
    "Be clear, practical and honest. Do not claim to have taken actions or accessed systems unless tools actually did so.",
    "Adapt your response to the selected mode: solve, create, write, build or improve.",
    "Ask only for information essential to completing the task. Prefer useful next steps over generic encouragement.",
  ].join(" ");

  let upstream;
  try {
    upstream = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 1200,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((item) => ({ role: item.role, content: item.content })),
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    return NextResponse.json({ error: "Aahana could not connect to the AI service. Please try again." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: gatewayError(upstream.status) }, { status: upstream.status === 429 ? 429 : 502 });
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
