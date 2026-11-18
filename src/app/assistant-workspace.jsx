"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSourceFileMimeType, isSupportedSourceFile } from "@/lib/build/source-file-policy.mjs";

const modes = [
  { id: "solve", label: "Solve", hint: "Work through a problem" },
  { id: "create", label: "Create", hint: "Make something new" },
  { id: "write", label: "Write", hint: "Shape your thoughts" },
  { id: "build", label: "Build", hint: "Turn ideas into products" },
  { id: "improve", label: "Improve", hint: "Make it better" },
];

const starters = [
  "Help me think through a difficult decision",
  "Turn this idea into a clear action plan",
  "Write something thoughtful and concise",
  "Help me design an app or website",
];

const spaceStars = [
  { startX: "-26px", startY: "-18px", endX: "-48vw", endY: "-35vh", delay: "-1s", size: "2px" },
  { startX: "34px", startY: "-42px", endX: "52vw", endY: "-38vh", delay: "-5s", size: "2px" },
  { startX: "-18px", startY: "36px", endX: "-55vw", endY: "42vh", delay: "-8s", size: "3px" },
  { startX: "22px", startY: "18px", endX: "54vw", endY: "44vh", delay: "-3s", size: "2px" },
  { startX: "-64px", startY: "-12px", endX: "-58vw", endY: "-8vh", delay: "-10s", size: "2px" },
  { startX: "58px", startY: "8px", endX: "59vw", endY: "12vh", delay: "-6s", size: "3px" },
  { startX: "-12px", startY: "-62px", endX: "-12vw", endY: "-48vh", delay: "-4s", size: "2px" },
  { startX: "14px", startY: "60px", endX: "15vw", endY: "49vh", delay: "-9s", size: "2px" },
  { startX: "-44px", startY: "54px", endX: "-42vw", endY: "50vh", delay: "-7s", size: "2px" },
  { startX: "48px", startY: "-56px", endX: "43vw", endY: "-50vh", delay: "-2s", size: "2px" },
  { startX: "-76px", startY: "22px", endX: "-61vw", endY: "23vh", delay: "-11s", size: "2px" },
  { startX: "74px", startY: "-24px", endX: "62vw", endY: "-20vh", delay: "-12s", size: "3px" },
];

function renderInlineMarkdown(value, prefix) {
  const nodes = [];
  const pattern = /([\x60][^\x60\n]+[\x60]|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[([^\]]+)\]\((https:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) nodes.push(value.slice(lastIndex, match.index));
    const token = match[0];
    if (token.charCodeAt(0) === 96) {
      nodes.push(<code className="inline-code" key={prefix + "-inline-" + key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={prefix + "-strong-" + key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={prefix + "-em-" + key++}>{token.slice(1, -1)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);
      if (link) {
        nodes.push(<a key={prefix + "-link-" + key++} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>);
      } else {
        nodes.push(token);
      }
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) nodes.push(value.slice(lastIndex));
  return nodes;
}

function renderMarkdownText(value, prefix) {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const nodes = [];
  let paragraph = [];
  let listItems = [];
  let listKind = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    nodes.push(<p key={prefix + "-p-" + nodes.length}>{renderInlineMarkdown(paragraph.join("\n"), prefix + "-p-" + nodes.length)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    const List = listKind === "ol" ? "ol" : "ul";
    nodes.push(<List key={prefix + "-list-" + nodes.length}>{listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item, prefix + "-li-" + index)}</li>)}</List>);
    listItems = [];
    listKind = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const Heading = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      nodes.push(<Heading key={prefix + "-heading-" + nodes.length}>{renderInlineMarkdown(heading[2], prefix + "-heading-" + nodes.length)}</Heading>);
      continue;
    }
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextKind = ordered ? "ol" : "ul";
      if (listKind && listKind !== nextKind) flushList();
      listKind = nextKind;
      listItems.push((unordered || ordered)[1]);
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      nodes.push(<blockquote key={prefix + "-quote-" + nodes.length}>{renderInlineMarkdown(quote[1], prefix + "-quote-" + nodes.length)}</blockquote>);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return nodes;
}

function renderAssistantContent(content, onCopyCode) {
  const source = String(content || "");
  const nodes = [];
  const fence = /\x60{3}([a-zA-Z0-9_+.-]*)[ \t]*\n([\s\S]*?)\x60{3}/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = fence.exec(source)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderMarkdownText(source.slice(lastIndex, match.index), "text-" + key++));
    }
    const language = match[1] || "code";
    const code = match[2].replace(/\n$/, "");
    nodes.push(
      <div className="code-block" key={"code-" + key++}>
        <div className="code-toolbar">
          <span>{language}</span>
          <button type="button" onClick={() => onCopyCode?.(code)} aria-label="Copy code">Copy code</button>
        </div>
        <pre><code>{code}</code></pre>
      </div>
    );
    lastIndex = fence.lastIndex;
  }

  if (lastIndex < source.length) {
    nodes.push(...renderMarkdownText(source.slice(lastIndex), "text-" + key++));
  }
  return nodes;
}

function isImageGenerationRequest(value) {
  const text = String(value || "").trim();
  if (!text) return false;

  // Explicit image-generation instructions.
  if (/\b(?:generate|create|draw|paint|illustrate|render|make)\b[\s\S]{0,180}\b(?:image|picture|illustration|artwork|portrait|wallpaper|logo|poster|cover|banner|icon|thumbnail|scene|landscape|cityscape|character|diagram)\b/i.test(text)) return true;
  if (/\b(?:show me|visuali[sz]e|turn this into|text[- ]to[- ]image)\b/i.test(text) && /\b(?:image|picture|art|illustration|render|visual)\b/i.test(text)) return true;
  if (/\b(?:please|can you|could you|i want|i need)\b[\s\S]{0,120}\b(?:generate|create|draw|paint|illustrate|render|make)\b/i.test(text) && /\b(?:image|picture|art|visual|logo|poster|wallpaper)\b/i.test(text)) return true;

  // Finished prompts pasted without an instruction. Require several visual
  // generation cues and a recognizable visual subject to avoid false positives.
  const visualMarkers = [
    /\b(?:photorealistic|ultra[- ]realistic)\b/i,
    /\b(?:cinematic|wide[- ]shot|close[- ]up|wide[- ]angle)\b/i,
    /\b(?:volumetric lighting|depth of field|anamorphic|ray tracing)\b/i,
    /\b(?:8k|4k|high[- ]detail|ultra[- ]detailed)\b/i,
    /\b(?:negative prompt|aspect ratio|text[- ]to[- ]image)\b/i,
    /\b(?:bioluminescent|neon lighting|dramatic lighting|realistic reflections)\b/i,
  ];
  const markerCount = visualMarkers.filter((pattern) => pattern.test(text)).length;
  const hasVisualSubject = /\b(?:city|metropolis|landscape|ocean|underwater|space station|planet|portrait|character|architecture|skyscraper|forest|mountain|vehicle|spaceship|animal|interior|exterior|scene|coral|submarine|building)\b/i.test(text);
  return text.length >= 100 && markerCount >= 2 && hasVisualSubject;
}

function evaluateArithmetic(input) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/^(?:what\s+is|calculate|compute|solve|how\s+much\s+is)\s+/i, "")
    .replace(/[?=]+\s*$/, "")
    .replace(/multiplied\s+by|times|×/g, "*")
    .replace(/divided\s+by|÷/g, "/")
    .replace(/\bplus\b/g, "+")
    .replace(/\bminus\b/g, "-")
    .replace(/\bmodulo\b|\bmod\b/g, "%")
    .trim();
  const compact = normalized.replace(/\s+/g, "");
  if (!compact || !/[+*/%()-]/.test(compact) || !/^[0-9.+*/%()\-]+$/.test(compact)) return null;
  const tokens = compact.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+*/%-]/g) || [];
  if (tokens.join("") !== compact) return null;
  let index = 0;
  function primary() {
    const token = tokens[index++];
    if (token === "(") {
      const value = expression();
      if (tokens[index++] !== ")") throw new Error("Invalid expression");
      return value;
    }
    const value = Number(token);
    if (!token || !Number.isFinite(value)) throw new Error("Invalid number");
    return value;
  }
  function unary() {
    if (tokens[index] === "+") { index++; return unary(); }
    if (tokens[index] === "-") { index++; return -unary(); }
    return primary();
  }
  function term() {
    let value = unary();
    while (["*", "/", "%"].includes(tokens[index])) {
      const operator = tokens[index++];
      const next = unary();
      if ((operator === "/" || operator === "%") && next === 0) throw new Error("Division by zero");
      value = operator === "*" ? value * next : operator === "/" ? value / next : value % next;
    }
    return value;
  }
  function expression() {
    let value = term();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const next = term();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }
  try {
    const result = expression();
    if (index !== tokens.length || !Number.isFinite(result)) return null;
    return Number.isInteger(result) ? String(result) : String(Number(result.toPrecision(12)));
  } catch {
    return null;
  }
}

export default function Home({ userEmail = "", aiEnabled = false }) {
  const router = useRouter();
  const conversationEndRef = useRef(null);
  const [mode, setMode] = useState("solve");
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    if (messages.length) conversationEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);
  useEffect(() => {
    let active = true;
    fetch("/api/build/status")
      .then((response) => response.ok ? response.json() : null)
      .then((status) => { if (active) setBuildEnabled(status?.enabled === true && status?.sandboxIdentityAvailable === true); })
      .catch(() => { if (active) setBuildEnabled(false); })
      .finally(() => { if (active) setBuildStatusLoading(false); });
    return () => { active = false; };
  }, []);
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [buildBusy, setBuildBusy] = useState(false);
  const [buildEntrypoint, setBuildEntrypoint] = useState("src/index.js");
  const [buildEnabled, setBuildEnabled] = useState(false);
  const [buildStatusLoading, setBuildStatusLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [analyzingFileId, setAnalyzingFileId] = useState(null);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [memories, setMemories] = useState([]);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("personal");
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryError, setMemoryError] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [speakingMessage, setSpeakingMessage] = useState(null);
  const voiceLanguages = [
    ["en-IN","English (India)"],["kn-IN","Kannada"],["hi-IN","Hindi"],["ta-IN","Tamil"],["te-IN","Telugu"],["ml-IN","Malayalam"],["mr-IN","Marathi"],["bn-IN","Bengali"],["gu-IN","Gujarati"],["pa-IN","Punjabi"],["ur-IN","Urdu"],["or-IN","Odia"],["as-IN","Assamese"],["en-US","English (US)"],["en-GB","English (UK)"],["es-ES","Spanish"],["fr-FR","French"],["de-DE","German"],["pt-BR","Portuguese"],["ar-SA","Arabic"],["zh-CN","Chinese"],["ja-JP","Japanese"],["ko-KR","Korean"],["ru-RU","Russian"],["it-IT","Italian"]
  ];

  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser. Try a recent version of Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); setError(""); };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) setPrompt((current) => current ? current + " " + transcript : transcript);
    };
    recognition.onerror = () => setError("Voice recognition could not complete. Check microphone permission and try again.");
    recognition.onend = () => setListening(false);
    try { recognition.start(); } catch { setListening(false); setError("Voice input is already active. Please try again."); }
  }

  function speakResponse(text, index) {
    if (!("speechSynthesis" in window)) {
      setError("Spoken responses are not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingMessage === index) { setSpeakingMessage(null); return; }
    const utterance = new SpeechSynthesisUtterance(String(text || ""));
    utterance.lang = voiceLanguage;
    const voices = window.speechSynthesis.getVoices();
    const languagePrefix = voiceLanguage.split("-")[0].toLowerCase();
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase() === voiceLanguage.toLowerCase())
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
    if (matchingVoice) utterance.voice = matchingVoice;
    utterance.onend = () => setSpeakingMessage(null);
    utterance.onerror = () => setSpeakingMessage(null);
    setSpeakingMessage(index);
    window.speechSynthesis.speak(utterance);
  }

  async function toggleMemoryPanel() {
    const opening = !memoryOpen;
    setMemoryOpen(opening);
    if (!opening) return;
    setMemoryLoading(true);
    setMemoryError("");
    try {
      const response = await fetch("/api/memories");
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load private memory.");
      setMemoryEnabled(result.enabled === true);
      setMemories(result.memories || []);
    } catch (err) {
      setMemoryError(err.message || "Could not load private memory.");
    } finally {
      setMemoryLoading(false);
    }
  }

  async function changeMemoryConsent(enabled) {
    setMemoryBusy(true);
    setMemoryError("");
    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: enabled ? "enable" : "disable" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update memory settings.");
      setMemoryEnabled(result.enabled === true);
    } catch (err) {
      setMemoryError(err.message || "Could not update memory settings.");
    } finally {
      setMemoryBusy(false);
    }
  }

  async function saveMemory(event) {
    event.preventDefault();
    if (!memoryDraft.trim() || memoryBusy) return;
    setMemoryBusy(true);
    setMemoryError("");
    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: memoryDraft.trim(), category: memoryCategory }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save memory.");
      setMemories((current) => [result.memory, ...current]);
      setMemoryDraft("");
    } catch (err) {
      setMemoryError(err.message || "Could not save memory.");
    } finally {
      setMemoryBusy(false);
    }
  }

  async function deleteMemory(id) {
    setMemoryBusy(true);
    setMemoryError("");
    try {
      const response = await fetch(`/api/memories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not delete memory.");
      setMemories((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setMemoryError(err.message || "Could not delete memory.");
    } finally {
      setMemoryBusy(false);
    }
  }

  async function clearAllMemories() {
    if (!memories.length || memoryBusy || !window.confirm("Delete every saved memory? This cannot be undone.")) return;
    setMemoryBusy(true);
    setMemoryError("");
    try {
      const response = await fetch("/api/memories?id=all", { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not clear memories.");
      setMemories([]);
    } catch (err) {
      setMemoryError(err.message || "Could not clear memories.");
    } finally {
      setMemoryBusy(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function newConversation() {
    if (busy || imageGenerating) return;
    setPrompt("");
    setMessages([]);
    setConversationId(null);
    setError("");
    setMode("solve");
  }

  async function toggleHistory() {
    const nextOpen = !historyOpen;
    setHistoryOpen(nextOpen);
    if (!nextOpen || history.length) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const historyUrl = selectedProjectId ? `/api/conversations?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/conversations";
      const response = await fetch(historyUrl);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load history.");
      setHistory(result.conversations || []);
    } catch (err) {
      setHistoryError(err.message || "Could not load history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openConversation(id) {
    if (busy) return;
    setHistoryError("");
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not open conversation.");
      setConversationId(result.conversation.id);
      setSelectedProjectId(result.conversation.project_id || null);
      setHistory([]);
      setMode(result.conversation.mode || "solve");
      setMessages((result.messages || []).map(({ role, content }) => ({ role, content })));
      setPrompt("");
      setError("");
      setHistoryOpen(false);
    } catch (err) {
      setHistoryError(err.message || "Could not open conversation.");
    }
  }

  async function toggleProjects() {
    const nextOpen = !projectsOpen;
    setProjectsOpen(nextOpen);
    if (!nextOpen || projects.length) return;
    setProjectsLoading(true);
    setProjectsError("");
    try {
      const response = await fetch("/api/projects");
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load projects.");
      setProjects(result.projects || []);
    } catch (err) {
      setProjectsError(err.message || "Could not load projects.");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function toggleFiles() {
    const nextOpen = !filesOpen;
    setFilesOpen(nextOpen);
    if (!nextOpen) return;
    setFilesLoading(true);
    setFilesError("");
    try {
      const query = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
      const response = await fetch(`/api/files${query}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load files.");
      setFiles(result.files || []);
    } catch (err) {
      setFilesError(err.message || "Could not load files.");
    } finally {
      setFilesLoading(false);
    }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || fileBusy) return;
    setFileBusy(true);
    setFilesError("");
    try {
      const mimeType = getSourceFileMimeType(file.name, file.type);
      const sourceFile = isSupportedSourceFile(file.name, mimeType);
      const allowed = ["application/pdf", "text/plain", "text/markdown", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/json", "text/javascript", "application/javascript", "text/css", "text/html", "text/x-python", "image/png", "image/jpeg", "image/webp"];
      if (!allowed.includes(mimeType) && !sourceFile) throw new Error("This file type is not supported.");
      if (file.size < 1 || file.size > (sourceFile ? 1024 * 1024 : 10 * 1024 * 1024)) {
        throw new Error(sourceFile ? "Project source files must be 1 MB or smaller." : "Files must be between 1 byte and 10 MB.");
      }
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "upload";
      const folder = selectedProjectId || "personal";
      const objectPath = `${user.id}/${folder}/${crypto.randomUUID()}-${safeName}`;
      const { error: storageError } = await supabase.storage.from("aahana-private").upload(objectPath, file, { contentType: mimeType, upsert: false });
      if (storageError) throw new Error("Upload failed. Please try again.");
      const response = await fetch("/api/files", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath, originalFilename: file.name, mimeType, sizeBytes: file.size, projectId: selectedProjectId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        await supabase.storage.from("aahana-private").remove([objectPath]);
        throw new Error(result.error || "Could not save file details.");
      }
      setFiles((items) => [result.file, ...items]);
    } catch (err) {
      setFilesError(err.message || "Upload failed.");
    } finally {
      setFileBusy(false);
    }
  }

  async function openFile(id) {
    const fileTab = window.open("about:blank", "_blank");
    if (!fileTab) {
      setFilesError("Allow pop-ups to open files in a new tab.");
      return;
    }
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(id)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not open file.");
      fileTab.location.href = result.url;
    } catch (err) {
      fileTab.close();
      setFilesError(err.message || "Could not open file.");
    }
  }

  async function analyzeFile(id) {
    if (analyzingFileId || busy) return;
    setAnalyzingFileId(id);
    setFilesError("");
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(id)}/analyze`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not read this document.");
      const isSpreadsheet = result.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const instruction = isSpreadsheet
        ? `Analyse this Excel workbook: ${result.filename}. Treat each SHEET as a separate worksheet. Explain what each sheet contains, identify headers and important fields, summarise key figures, calculate useful totals or comparisons when the extracted values support them, highlight patterns, missing values and unusual entries, and clearly state any assumptions. Do not invent values or claim to have analysed rows that are not included. If the extraction is incomplete, say so.\n\nWORKBOOK DATA:\n`
        : `Please analyse the following uploaded document: ${result.filename}. Summarise its main points, explain important details, identify key facts and any action items, and answer in a clear structure. If the extracted text is incomplete, say so.\n\nDOCUMENT TEXT:\n`;
      setMode("solve");
      setPrompt(instruction + result.text);
      setFilesError(result.truncated ? "Text extracted. The document is long, so only its first section is included. Send the prepared prompt to analyse it." : "Text extracted. Send the prepared prompt to analyse this document.");
    } catch (err) {
      setFilesError(err.message || "Document analysis failed.");
    } finally {
      setAnalyzingFileId(null);
    }
  }

  async function generateImage() {
    const imagePrompt = prompt.trim();
    if (!imagePrompt || imageGenerating || busy || imageFile) return;
    setImageGenerating(true);
    setError("");
    setGeneratedImage(null);
    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not generate the image.");
      if (typeof result.imageDataUrl !== "string" || !result.imageDataUrl.startsWith("data:image/jpeg;base64,")) {
        throw new Error("The image provider returned an invalid image.");
      }
      setGeneratedImage({ dataUrl: result.imageDataUrl, prompt: imagePrompt });
    } catch (err) {
      setError(err.message || "Image generation failed.");
    } finally {
      setImageGenerating(false);
    }
  }

  async function deleteFile(id) {
    const response = await fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setFilesError(result.error || "Could not delete file."); return; }
    setFiles((items) => items.filter((item) => item.id !== id));
  }

  async function createProject(event) {
    event.preventDefault();
    if (busy || !projectName.trim() || projectBusy) return;
    setProjectBusy(true);
    setProjectsError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim(), description: projectDescription.trim(), project_type: "other" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not create project.");
      setProjects((items) => [result.project, ...items]);
      setSelectedProjectId(result.project.id);
      setProjectName("");
      setProjectDescription("");
      setShowProjectForm(false);
      setMessages([]);
      setConversationId(null);
      setHistory([]);
      setHistoryOpen(false);
    } catch (err) {
      setProjectsError(err.message || "Could not create project.");
    } finally {
      setProjectBusy(false);
    }
  }

  function selectProject(id) {
    if (busy || imageGenerating) return;
    setSelectedProjectId(id);
    setConversationId(null);
    setMessages([]);
    setPrompt("");
    setHistory([]);
    setHistoryOpen(false);
    setError("");
  }

  async function archiveProject(id) {
    if (busy) return;
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setProjectsError(result.error || "Could not archive project."); return; }
    setProjects((items) => items.filter((item) => item.id !== id));
    if (selectedProjectId === id) selectProject(null);
  }

  async function runProjectCheck(operation) {
    if (!selectedProjectId || buildBusy || busy || !buildEnabled) return;
    const entrypoint = buildEntrypoint.trim();
    if (operation === "run" && !entrypoint) {
      setError("Enter a project-relative JavaScript or Python file path to run.");
      return;
    }
    const label = operation === "test" ? "Run isolated project tests" : operation === "run" ? `Run ${entrypoint} in isolation` : "Run isolated project build";
    setBuildBusy(true);
    setError("");
    setMessages((current) => [...current,
      { role: "user", content: label },
      { role: "assistant", content: "Preparing your project for an isolated check…" },
    ]);
    try {
      const response = await fetch("/api/build/project", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, operation, ...(operation === "run" ? { entrypoint } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The isolated project check could not start.");
      const output = [
        result.status === "passed" ? "Isolated check passed." : "Isolated check failed.",
        "Operation: " + result.operation,
        "Source files: " + result.sourceFileCount,
        result.exitCode !== undefined ? "Exit code: " + result.exitCode : "",
        result.stdout ? "Output: " + result.stdout : "",
        result.stderr ? "Diagnostics: " + result.stderr : "",
        "This ran in a temporary isolated sandbox. Saved project files were not changed, and nothing was deployed.",
      ].filter(Boolean).join("\n\n");
      setMessages((current) => current.map((item, index) => index === current.length - 1 ? { ...item, content: output } : item));
    } catch (err) {
      setMessages((current) => current.map((item, index) => index === current.length - 1 ? { ...item, content: err.message || "The isolated project check failed." } : item));
    } finally {
      setBuildBusy(false);
    }
  }
  async function copyCodeBlock(code) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      setError("Could not copy this code. Please select it and copy manually.");
    }
  }

  function printAnswerAsPdf(answer) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Allow pop-ups to create a PDF. Then choose Save as PDF in the print dialog.");
      return;
    }
    const escaped = String(answer || "").replace(/[&<>"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
    })[character]);
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html><head><meta charset="utf-8"><title>Aahana document</title>
      <style>
        body{font-family:Arial,sans-serif;color:#171717;max-width:800px;margin:40px auto;padding:0 28px;line-height:1.65}
        h1{font-size:20px;margin-bottom:24px}pre{font:14px/1.7 Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}
        .footer{margin-top:36px;padding-top:12px;border-top:1px solid #ddd;color:#666;font-size:10px}
        @page{size:A4;margin:18mm}
        @media print{body{margin:0;max-width:none;padding:0}}
      </style></head><body><h1>Aahana</h1><pre>${escaped}</pre>
      <div class="footer">Prepared with Aahana AI</div>
      <script>window.onload=()=>{window.focus();window.print();};</script>
      </body></html>`);
    printWindow.document.close();
  }

  async function submitPrompt(event) {
    event.preventDefault();
    const text = prompt.trim();
    if ((!text && !imageFile) || busy || buildBusy || imageGenerating) return;

    if (isImageGenerationRequest(text)) {
      setPrompt("");
      setError("");
      setGeneratedImage(null);
      setImageGenerating(true);
      setMessages((current) => [...current,
        { role: "user", content: text },
        { role: "assistant", content: "Creating your image…" },
      ]);
      try {
        const response = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not generate the image.");
        if (typeof result.imageDataUrl !== "string" || !result.imageDataUrl.startsWith("data:image/jpeg;base64,")) {
          throw new Error("The image provider returned an invalid image.");
        }
        setGeneratedImage({ dataUrl: result.imageDataUrl, prompt: text });
        setMessages((current) => current.map((item, index) =>
          index === current.length - 1 ? { ...item, content: "Your image is ready. You can view it below and download it." } : item
        ));
      } catch (err) {
        setMessages((current) => current.map((item, index) =>
          index === current.length - 1 ? { ...item, content: "I couldn't generate that image." } : item
        ));
        setError(err.message || "Image generation failed.");
      } finally {
        setImageGenerating(false);
      }
      return;
    }

    if (!aiEnabled) {
      const calculation = evaluateArithmetic(text);
      if (calculation === null) {
        setError("The AI connection is not active yet. Basic arithmetic works offline; full AI answers are pending activation.");
        return;
      }
      setPrompt("");
      setError("");
      setMessages((current) => [...current,
        { role: "user", content: text },
        { role: "assistant", content: calculation },
      ]);
      return;
    }

    setPrompt("");
    setError("");
    setBusy(true);
    let imageDataUrl = null;
    if (imageFile) {
      imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read the selected image."));
        reader.readAsDataURL(imageFile);
      }).catch((err) => {
        setError(err.message || "Could not read the selected image.");
        return null;
      });
      if (!imageDataUrl) { setBusy(false); return; }
    }
    const userMessage = { role: "user", content: imageFile ? `${text || "Please identify this image."}\n[Image attached: ${imageFile.name}]` : text };
    const assistantMessage = { role: "assistant", content: "" };
    setImageFile(null);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text || "Please identify and describe this image in detail.", image: imageDataUrl ? { dataUrl: imageDataUrl } : null, mode, conversationId, projectId: selectedProjectId }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        if (response.status >= 500) {
          const calculation = evaluateArithmetic(text);
          if (calculation !== null) {
            setMessages((current) => current.map((item, index) =>
              index === current.length - 1
                ? { ...item, content: calculation }
                : item
            ));
            const diagnostic = result.code ? ` [${result.code}${result.gatewayStatus ? ` / HTTP ${result.gatewayStatus}` : ""}]` : "";
            setError(`Offline calculator used. ${result.error || "The live AI service is unavailable."}${diagnostic}`);
            return;
          }
        }
        throw new Error(result.error || "Aahana couldn't process that request.");
      }

      const nextConversationId = response.headers.get("X-Conversation-Id");
      if (nextConversationId) setConversationId(nextConversationId);

      if (!response.body) throw new Error("The response stream was unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) => current.map((item, index) =>
          index === current.length - 1 ? { ...item, content: answer } : item
        ));
      }
      answer += decoder.decode();
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: answer || "I couldn't generate a response. Please try again." } : item
      ));
      setHistory([]);
    } catch (err) {
      setMessages((current) => {
        const last = current[current.length - 1];
        if (last?.role !== "assistant") return current;
        if (!last.content) return current.slice(0, -1);
        return current.map((item, index) => index === current.length - 1
          ? { ...item, content: item.content + "\n\n[Response interrupted. You can retry your request.]" }
          : item);
      });
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Aahana AI home">
          <span className="brand-word">Aahana</span><span className="brand-ai">AI</span>
        </a>
        <button className="new-chat" type="button" onClick={newConversation}>
          <span aria-hidden="true">＋</span> New conversation
        </button>
        <div className="side-label">WORKSPACE</div>
        <button className={selectedProjectId ? "side-item assistant-nav" : "side-item active assistant-nav"} type="button" onClick={() => selectProject(null)}>✳ <span>Assistant</span></button>
        <a className="side-item muted" href="/learn">✧ <span>Student Mode</span></a>
        <button className={historyOpen ? "side-item active history-toggle" : "side-item muted history-toggle"} type="button" onClick={toggleHistory}>◷ <span>History</span></button>
        {historyOpen && (
          <div className="history-list">
            {historyLoading && <div className="history-empty">Loading conversations…</div>}
            {historyError && <div className="history-empty history-error">{historyError}</div>}
            {!historyLoading && !historyError && history.length === 0 && <div className="history-empty">No saved conversations yet.</div>}
            {history.map((item) => (
              <button className={conversationId === item.id ? "history-entry selected" : "history-entry"} type="button" key={item.id} onClick={() => openConversation(item.id)}>
                <span>{item.title || "New conversation"}</span>
                <small>{item.mode}</small>
              </button>
            ))}
          </div>
        )}
        <button className={projectsOpen ? "side-item active project-toggle" : "side-item muted project-toggle"} type="button" onClick={toggleProjects}>▧ <span>Projects</span></button>
        <button className={filesOpen ? "side-item active project-toggle" : "side-item muted project-toggle"} type="button" onClick={toggleFiles}>⌁ <span>Files</span></button>
        <button className={memoryOpen ? "side-item active project-toggle" : "side-item muted project-toggle"} type="button" onClick={toggleMemoryPanel}>◉ <span>Private memory</span></button>
        {memoryOpen && (
          <div className="history-list memory-panel">
            <div className="history-empty"><strong>Private memory</strong><br />Only used in your signed-in account. Off by default.</div>
            {memoryLoading && <div className="history-empty">Loading memory…</div>}
            <label className="history-entry memory-consent">
              <input type="checkbox" checked={memoryEnabled} disabled={memoryBusy || memoryLoading}
                onChange={(event) => changeMemoryConsent(event.target.checked)} />
              <span>Allow Aahana to use saved memories in my chats</span>
            </label>
            {memoryEnabled && (
              <form className="project-create-form" onSubmit={saveMemory}>
                <textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)}
                  maxLength={1200} rows={3} placeholder="Add a detail you want Aahana to remember…" aria-label="New private memory" />
                <select value={memoryCategory} onChange={(event) => setMemoryCategory(event.target.value)} aria-label="Memory category">
                  <option value="personal">Personal</option><option value="preference">Preference</option>
                  <option value="project">Project</option><option value="goal">Goal</option><option value="other">Other</option>
                </select>
                <button type="submit" disabled={!memoryDraft.trim() || memoryBusy}>{memoryBusy ? "Saving…" : "Save memory"}</button>
              </form>
            )}
            {memoryError && <div className="history-empty history-error">{memoryError}</div>}
            {memoryEnabled && memories.length > 0 && <button className="project-add" type="button" disabled={memoryBusy} onClick={clearAllMemories}>Clear all saved memories</button>}
            {memoryEnabled && memories.map((item) => (
              <div className="history-entry" key={item.id}>
                <span>{item.content}</span><small>{item.category}</small>
                <div className="file-actions"><button type="button" disabled={memoryBusy} onClick={() => deleteMemory(item.id)}>Delete</button></div>
              </div>
            ))}
            {memoryEnabled && !memoryLoading && memories.length === 0 && <div className="history-empty">No saved memories yet.</div>}
            {!memoryEnabled && <div className="history-empty">Memory is off. Aahana will not retrieve saved memories.</div>}
          </div>
        )}
        {filesOpen && (
          <div className="history-list">
            {filesLoading && <div className="history-empty">Loading files…</div>}
            {filesError && <div className="history-empty history-error">{filesError}</div>}
            {!filesLoading && files.length === 0 && <div className="history-empty">No uploaded files in this workspace yet.</div>}
            {files.map((file) => (
              <div className="history-entry" key={file.id}>
                <span title={file.original_filename}>{file.original_filename}</span>
                <small>{file.mime_type}</small>
                <div className="file-actions">
                  {(["application/pdf", "text/plain", "text/markdown", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.mime_type)) ? (
                    <button type="button" onClick={() => analyzeFile(file.id)} disabled={Boolean(analyzingFileId) || busy}>
                      {analyzingFileId === file.id ? "Reading…" : "Analyse"}
                    </button>
                  ) : (
                    <span className="file-analysis-unavailable" title="Analysis for this file type is not available yet">Analysis unavailable</span>
                  )}
                  <button type="button" onClick={() => openFile(file.id)}>Open</button>
                  <button type="button" onClick={() => deleteFile(file.id)}>Delete</button>
                </div>
              </div>
            ))}
            <label className="project-add">
              {fileBusy ? "Uploading…" : "＋ Upload file"}
              <input type="file" hidden disabled={fileBusy} onChange={uploadFile} accept=".pdf,.txt,.md,.csv,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.js,.jsx,.ts,.tsx,.mjs,.cjs,.css,.html,.htm,.json,.py,.toml,.yaml,.yml,.sql" />
            </label>
          </div>
        )}
        {projectsOpen && (
          <div className="project-list">
            {projectsLoading && <div className="history-empty">Loading projects…</div>}
            {projectsError && <div className="history-empty history-error">{projectsError}</div>}
            {!projectsLoading && !projectsError && projects.length === 0 && <div className="history-empty">No projects yet.</div>}
            {projects.map((project) => (
              <div className="project-row" key={project.id}>
                <button className={selectedProjectId === project.id ? "project-entry selected" : "project-entry"} type="button" onClick={() => selectProject(project.id)}>
                  <span>{project.name}</span><small>{project.status}</small>
                </button>
                <button className="project-archive" type="button" aria-label={`Archive ${project.name}`} onClick={() => archiveProject(project.id)}>×</button>
              </div>
            ))}
            {showProjectForm ? (
              <form className="project-create-form" onSubmit={createProject}>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} placeholder="Project name" aria-label="Project name" required />
                <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={500} placeholder="Short description (optional)" aria-label="Project description" rows={2} />
                <div><button type="button" onClick={() => setShowProjectForm(false)}>Cancel</button><button type="submit" disabled={!projectName.trim() || projectBusy}>{projectBusy ? "Saving…" : "Create"}</button></div>
              </form>
            ) : (
              <button className="project-add" type="button" onClick={() => setShowProjectForm(true)}>＋ New project</button>
            )}
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="avatar">A</div>
          <div className="account-copy"><strong>Your workspace</strong><small>{userEmail || "Personal"}</small></div>
          <button className="sign-out" type="button" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <section className="main-panel">
        <div className="space-background" aria-hidden="true">
          {spaceStars.map((star, index) => (
            <span
              className="space-star"
              key={index}
              style={{
                "--start-x": star.startX,
                "--start-y": star.startY,
                "--end-x": star.endX,
                "--end-y": star.endY,
                "--delay": star.delay,
                "--size": star.size,
              }}
            />
          ))}
        </div>
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {selectedProjectId ? (projects.find((item) => item.id === selectedProjectId)?.name || "Project") : "Assistant"}</div>
          <div className="top-actions"><button className="mobile-history-toggle" type="button" onClick={toggleProjects}>Projects</button><button className="mobile-history-toggle" type="button" onClick={toggleHistory}>History</button><button className="mobile-history-toggle" type="button" onClick={toggleFiles}>Files</button><button className="mobile-history-toggle" type="button" onClick={toggleMemoryPanel}>Memory</button><span>Private workspace</span></div>
        </header>
        {projectsOpen && (
          <div className="mobile-project-panel">
            {projectsLoading && <div className="history-empty">Loading projects…</div>}
            {projectsError && <div className="history-empty history-error">{projectsError}</div>}
            {projects.map((project) => <button className="project-entry" type="button" key={project.id} onClick={() => selectProject(project.id)}>{project.name}</button>)}
            <button className="project-add" type="button" onClick={() => setShowProjectForm((value) => !value)}>＋ New project</button>
            {showProjectForm && <form className="project-create-form" onSubmit={createProject}><input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} placeholder="Project name" aria-label="Project name" required /><button type="submit" disabled={!projectName.trim() || projectBusy}>{projectBusy ? "Saving…" : "Create project"}</button></form>}
          </div>
        )}
        {historyOpen && (
          <div className="mobile-history-panel">
            {historyLoading && <div className="history-empty">Loading conversations…</div>}
            {historyError && <div className="history-empty history-error">{historyError}</div>}
            {!historyLoading && !historyError && history.length === 0 && <div className="history-empty">No saved conversations yet.</div>}
            {history.map((item) => (
              <button className="history-entry" type="button" key={item.id} onClick={() => openConversation(item.id)}>
                <span>{item.title || "New conversation"}</span><small>{item.mode}</small>
              </button>
            ))}
          </div>
        )}

        {memoryOpen && (
          <div className="mobile-history-panel memory-panel">
            <div className="history-empty"><strong>Private memory</strong><br />Off by default. Only used in your signed-in account.</div>
            {memoryLoading && <div className="history-empty">Loading memory…</div>}
            <label className="history-entry memory-consent">
              <input type="checkbox" checked={memoryEnabled} disabled={memoryBusy || memoryLoading}
                onChange={(event) => changeMemoryConsent(event.target.checked)} />
              <span>Allow Aahana to use saved memories in my chats</span>
            </label>
            {memoryEnabled && (
              <form className="project-create-form" onSubmit={saveMemory}>
                <textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)}
                  maxLength={1200} rows={3} placeholder="Add a detail you want Aahana to remember…" aria-label="New private memory" />
                <select value={memoryCategory} onChange={(event) => setMemoryCategory(event.target.value)} aria-label="Memory category">
                  <option value="personal">Personal</option><option value="preference">Preference</option>
                  <option value="project">Project</option><option value="goal">Goal</option><option value="other">Other</option>
                </select>
                <button type="submit" disabled={!memoryDraft.trim() || memoryBusy}>{memoryBusy ? "Saving…" : "Save memory"}</button>
              </form>
            )}
            {memoryError && <div className="history-empty history-error">{memoryError}</div>}
            {memoryEnabled && memories.length > 0 && <button className="project-add" type="button" disabled={memoryBusy} onClick={clearAllMemories}>Clear all saved memories</button>}
            {memoryEnabled && memories.map((item) => (
              <div className="history-entry" key={item.id}>
                <span>{item.content}</span><small>{item.category}</small>
                <div className="file-actions"><button type="button" disabled={memoryBusy} onClick={() => deleteMemory(item.id)}>Delete</button></div>
              </div>
            ))}
            {!memoryEnabled && <div className="history-empty">Memory is off. Aahana will not retrieve saved memories.</div>}
          </div>
        )}

        <div className="welcome">
          {!messages.length && (
            <div className="astronaut-float" aria-hidden="true">
              <svg viewBox="0 0 180 180" role="presentation">
                <defs>
                  <linearGradient id="astronautSuit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffaff" /><stop offset="1" stopColor="#b9a6d8" /></linearGradient>
                  <linearGradient id="astronautGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#51466f" /><stop offset="1" stopColor="#171426" /></linearGradient>
                </defs>
                <ellipse cx="91" cy="151" rx="42" ry="8" fill="#b89bfa" opacity=".14" />
                <g transform="rotate(-22 90 88)">
                  <path d="M56 83 38 96 29 116 39 121 57 105" fill="url(#astronautSuit)" stroke="#a994c7" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M119 84 139 93 151 111 142 118 121 104" fill="url(#astronautSuit)" stroke="#a994c7" strokeWidth="3" strokeLinejoin="round" />
                  <rect x="117" y="75" width="23" height="48" rx="9" fill="#a58cc9" stroke="#e9ddff" strokeWidth="2" />
                  <path d="M67 111 61 137 76 141 91 119" fill="url(#astronautSuit)" stroke="#a994c7" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M98 116 107 140 124 137 119 108" fill="url(#astronautSuit)" stroke="#a994c7" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M60 77 Q58 62 70 54 L111 54 Q124 64 121 83 L117 116 Q90 130 63 113Z" fill="url(#astronautSuit)" stroke="#a994c7" strokeWidth="3" />
                  <rect x="70" y="86" width="39" height="17" rx="8" fill="#8e72bb" opacity=".9" />
                  <circle cx="90" cy="58" r="35" fill="url(#astronautSuit)" stroke="#f4ecff" strokeWidth="4" />
                  <circle cx="90" cy="58" r="27" fill="url(#astronautGlass)" stroke="#8f7bb4" strokeWidth="3" />
                  <path d="M73 47 Q83 31 104 39" fill="none" stroke="#d8caff" strokeWidth="4" strokeLinecap="round" opacity=".75" />
                  <circle cx="108" cy="68" r="3" fill="#c7b2ff" opacity=".85" />
                  <path d="M31 117 42 120 38 129 27 126Z M141 116 151 111 157 121 147 128Z" fill="#d7c9ec" stroke="#9c86bd" strokeWidth="2" />
                  <path d="M72 141 81 143 80 149 67 149Z M108 140 120 137 127 145 112 149Z" fill="#d9c9ef" stroke="#9c86bd" strokeWidth="2" />
                  <circle cx="72" cy="90" r="3" fill="#c7aaff" /><circle cx="105" cy="90" r="3" fill="#c7aaff" />
                </g>
                <path d="M25 55l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z M148 42l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#d8c5ff" />
                <circle cx="143" cy="142" r="3" fill="#c7aaff" /><circle cx="38" cy="39" r="2" fill="#fff" />
              </svg>
            </div>
          )}
          <div className="welcome-signal" aria-hidden="true">
            <span className="signal-orbit signal-orbit-one" />
            <span className="signal-orbit signal-orbit-two" />
            <span className="signal-core" />
            <span className="signal-spark signal-spark-one" />
            <span className="signal-spark signal-spark-two" />
          </div>
          <div className="eyebrow"><span /> YOUR THINKING SPACE</div>
          {!messages.length && <>
            <h1>Good ideas<br /><em>start somewhere.</em></h1>
            <p>Think freely. Explore ideas. Build something real.</p>
          </>}

          <div className="mode-row" role="tablist" aria-label="Choose a mode">
            {modes.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={mode === item.id}
                className={mode === item.id ? "mode active-mode" : "mode"}
                onClick={() => setMode(item.id)}>
                {item.label}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <div className="conversation" aria-live="polite">
              {messages.map((item, index) => (
                <article className={item.role === "user" ? "chat-message user-message" : "chat-message assistant-message"} key={index}>
                  <div className="message-heading">
                    <div className="message-role">{item.role === "user" ? "YOU" : "Aahana"}</div>
                    {item.role === "assistant" && item.content && (
                      <div className="message-actions">
                        <button className="copy-message" type="button" onClick={() => printAnswerAsPdf(item.content)} aria-label="Print or save Aahana response as PDF">Save PDF</button>
                        <button className="copy-message" type="button" onClick={() => speakResponse(item.content, index)}>{speakingMessage === index ? "Stop voice" : "Listen"}</button>
                        <button className="copy-message" type="button" onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(item.content);
                            setCopiedMessage(index);
                          } catch {
                            setError("Could not copy this response. Please select the text and copy it manually.");
                          }
                        }} aria-label="Copy Aahana response">{copiedMessage === index ? "Copied" : "Copy"}</button>
                      </div>
                    )}
                  </div>
                  {item.content ? item.role === "assistant" ? <div className="message-content">{renderAssistantContent(item.content, copyCodeBlock)}</div> : <p>{item.content}</p> : busy && item.role === "assistant" ? <div className="thinking-indicator" role="status" aria-label="Aahana is thinking"><span /><span /><span /><small>Aahana is thinking</small></div> : null}
                </article>
              ))}
              <div ref={conversationEndRef} aria-hidden="true" />
            </div>
          )}

          {mode === "build" && (
            <section className="build-tools" aria-label="Project build tools">
              <div className="build-tools-heading">
                <div>
                  <strong>Project checks</strong>
                  <p>Run your uploaded website or app source in a temporary, isolated environment.</p>
                </div>
                <div className="build-tools-actions">
                  <button type="button" disabled={!selectedProjectId || !buildEnabled || buildBusy || busy} onClick={() => runProjectCheck("build")}>
                    {buildBusy ? "Running…" : "Run build"}
                  </button>
                  <button type="button" disabled={!selectedProjectId || !buildEnabled || buildBusy || busy} onClick={() => runProjectCheck("test")}>
                    Run tests
                  </button>
                </div>
              </div>
              <div className="build-tools-run">
                <label htmlFor="build-entrypoint">Run a source file</label>
                <input
                  id="build-entrypoint"
                  type="text"
                  value={buildEntrypoint}
                  onChange={(event) => setBuildEntrypoint(event.target.value)}
                  placeholder="src/index.js or scripts/check.py"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button type="button" disabled={!selectedProjectId || !buildEnabled || buildBusy || busy || !buildEntrypoint.trim()} onClick={() => runProjectCheck("run")}>
                  Run in isolation
                </button>
              </div>
              <p className="build-tools-note">
                {!selectedProjectId
                  ? "Select a project, then upload package.json and its source files in Files."
                  : buildStatusLoading
                    ? "Checking secure build availability…"
                    : buildEnabled
                      ? "Ready. Build and test commands run in a disposable sandbox; nothing is deployed."
                      : "Secure build execution is not activated in this environment yet. Code generation and editing guidance remain available."}
              </p>
            </section>
          )}
          <form className="composer" onSubmit={submitPrompt}>
            <label className="sr-only" htmlFor="image-upload">Attach an image for Aahana to identify or analyse</label>
            {generatedImage && (
              <div className="generated-image-preview">
                <img src={generatedImage.dataUrl} alt={generatedImage.prompt} style={{ display: "block", width: "100%", maxWidth: "640px", borderRadius: "14px" }} />
                <div className="message-actions">
                  <a className="copy-message" href={generatedImage.dataUrl} download="aahana-generated-image.jpg">Download image</a>
                  <button className="copy-message" type="button" onClick={() => setGeneratedImage(null)}>Remove</button>
                </div>
              </div>
            )}
            <div className="image-attach-row">
              <select aria-label="Voice language" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value)} className="copy-message">{voiceLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
              <button className="copy-message" type="button" onClick={startVoiceInput} disabled={listening || busy}>{listening ? "Listening…" : "Speak"}</button>
              <label className="image-attach">
                + Add image
                <input id="image-upload" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    event.target.value = "";
                    if (!file) return;
                    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG or WebP image."); return; }
                    if (file.size > 2 * 1024 * 1024) { setError("Images must be 2 MB or smaller."); return; }
                    setError("");
                    setImageFile(file);
                  }} />
              </label>
              {imageFile && <span className="image-attach-name">{imageFile.name} <button type="button" onClick={() => setImageFile(null)}>Remove</button></span>}
              <button className="copy-message" type="button" onClick={generateImage}
                disabled={!prompt.trim() || imageGenerating || busy || Boolean(imageFile)}>
                {imageGenerating ? "Creating image…" : "Generate image"}
              </button>
            </div>
            <label className="sr-only" htmlFor="prompt">What would you like to work on?</label>
            <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
              placeholder={aiEnabled ? "What would you like to work on today?" : "Try a calculation, e.g. 2 + 2 (offline)"} rows={3} disabled={busy} />
            <div className="composer-footer">
              <span className="composer-mode">{modes.find((item) => item.id === mode)?.hint} · Enter to send · Shift + Enter for a new line</span>
              <button className={`send send-orb${busy || imageGenerating ? " is-thinking" : ""}`} type="submit" disabled={(!prompt.trim() && !imageFile) || busy || imageGenerating || (!aiEnabled && !imageFile && !isImageGenerationRequest(prompt.trim()) && evaluateArithmetic(prompt.trim()) === null)} aria-label={busy || imageGenerating ? "Aahana is working" : "Launch your message"} title={busy || imageGenerating ? "Aahana is working" : "Launch your message"}><span className="send-orb-halo" aria-hidden="true" /><svg className="send-rocket" viewBox="0 0 32 32" aria-hidden="true"><path className="rocket-flame" d="M12 21.5c-2.1 1.2-3.3 3.2-3.4 5.1 2-.1 4-1.3 5.1-3.4" /><path className="rocket-body" d="M12.2 19.8c-1.3-4.9 1.1-11.1 8.8-15.6 1.3 8.8-1.8 14-6.6 16.5l-2.2-.9Z" /><path className="rocket-window" d="M18.7 10.1a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z" /><path className="rocket-fin" d="m12.4 15.8-4.1 1.4 1.1 4.1 4.1-2.2m5.2-6.9 2.2-4.1 4.1 1.1-1.4 4.1" /></svg><span className="send-orb-thinking" aria-hidden="true"><i /><i /><i /></span></button>
            </div>
          </form>
          {error && <div className="notice error-notice" role="alert">{error}</div>}
          {!messages.length && (
            <>
              <div className="notice">{aiEnabled ? "Your workspace is ready. Send a prompt to begin." : "Your workspace is ready. AI activation is pending billing and connection checks. Prompts are not sent yet."}</div>
              <div className="starter-grid">
                {starters.map((item, index) => (
                  <button className="starter" type="button" key={item} onClick={() => setPrompt(item)}>
                    <span className="starter-icon">{["◇", "↗", "✎", "⌘"][index]}</span>
                    <span>{item}</span>
                    <span className="starter-arrow">↗</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <footer className="footer"><span>Aahana</span><span>Thoughtfully made for what’s next.</span></footer>
      </section>
    </main>
  );
}
