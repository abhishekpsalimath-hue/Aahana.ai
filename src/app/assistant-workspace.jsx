"use client";

import { createReferenceImageFile } from "@/lib/creative/reference-image-file.mjs";
import { inferSpeechLanguage } from "@/lib/chat/speech-language.mjs";
import { selectSpeechVoice } from "@/lib/chat/speech-voice-selection.mjs";
import UniverseScene from "@/components/universe-scene";
import AstronautCompanion from "./astronaut-companion";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSourceFileMimeType, isSupportedSourceFile } from "@/lib/build/source-file-policy.mjs";
import { isImageGenerationRequest, isImageEditRequest, isVideoGenerationRequest } from "@/lib/creative/creative-intent.mjs";
import { getGeneratedImageFileMetadata } from "@/lib/creative/image-generation.mjs";
import { readFileAsDataUrl } from "@/lib/creative/file-data-url.mjs";

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
  const activeChatControllerRef = useRef(null);
  const [mode, setMode] = useState("solve");
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const shouldAutoScrollRef = useRef(true);
  useEffect(() => {
    const updateScrollIntent = () => {
      const root = document.documentElement;
      const remaining = root.scrollHeight - (window.scrollY + window.innerHeight);
      shouldAutoScrollRef.current = remaining < 180;
    };
    updateScrollIntent();
    window.addEventListener("scroll", updateScrollIntent, { passive: true });
    window.addEventListener("resize", updateScrollIntent);
    return () => {
      window.removeEventListener("scroll", updateScrollIntent);
      window.removeEventListener("resize", updateScrollIntent);
    };
  }, []);
  useEffect(() => {
    if (messages.length && shouldAutoScrollRef.current) {
      conversationEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [messages]);
  useEffect(() => {
    let active = true;
    fetch("/api/build/status")
      .then((response) => response.ok ? response.json() : null)
      .then((status) => {
        if (active) {
          setBuildEnabled(status?.enabled === true && status?.sandboxIdentityAvailable === true);
          setPreviewEnabled(status?.previewEnabled === true);
          setVideoEnabled(status?.videoEnabled === true);
          setImageEditingEnabled(status?.imageEditingEnabled === true);
          setImageUpscaleEnabled(status?.imageUpscaleEnabled === true);
        }
      })
      .catch(() => { if (active) { setBuildEnabled(false); setPreviewEnabled(false); setVideoEnabled(false); setImageEditingEnabled(false); setImageUpscaleEnabled(false); } })
      .finally(() => { if (active) setBuildStatusLoading(false); });
    return () => { active = false; };
  }, []);
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [buildBusy, setBuildBusy] = useState(false);
  const [buildEnabled, setBuildEnabled] = useState(false);
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [buildStatusLoading, setBuildStatusLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageSaveNotice, setImageSaveNotice] = useState("");
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
  const [imageUpscaling, setImageUpscaling] = useState(false);
  const [imageUpscaleEnabled, setImageUpscaleEnabled] = useState(false);
  const [imageUpscaleFile, setImageUpscaleFile] = useState(null);
  const [imageSaving, setImageSaving] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [imageEditingEnabled, setImageEditingEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoStoryboardEnabled, setVideoStoryboardEnabled] = useState(false);
  const [videoStoryboardStyle, setVideoStoryboardStyle] = useState("Photorealistic, coherent lighting, consistent color grade and natural motion");
  const [videoStoryboardShots, setVideoStoryboardShots] = useState([
    { id: "shot-1", durationSeconds: 2, scene: "", action: "", camera: "", transition: "start" },
    { id: "shot-2", durationSeconds: 3, scene: "", action: "", camera: "", transition: "cut" },
  ]);
  const videoAbortControllerRef = useRef(null);
  useEffect(() => () => { videoAbortControllerRef.current?.abort(); }, []);
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoAspectRatio, setVideoAspectRatio] = useState("16:9");
  const [videoResolution, setVideoResolution] = useState("480p");
  const [videoDirector, setVideoDirector] = useState("cinematic");
  const [videoContinuity, setVideoContinuity] = useState({
    subject: "", setting: "", action: "", camera: "", openingFrame: "", closingFrame: "",
  });
  const [imageAspectRatio, setImageAspectRatio] = useState("auto");
  const [imageSeries, setImageSeries] = useState({ subject: "", wardrobe: "", palette: "", style: "", scene: "", sceneNumber: "" });
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [memories, setMemories] = useState([]);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("personal");
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryError, setMemoryError] = useState("");
  const [listening, setListening] = useState(false);
  const [speakingMessage, setSpeakingMessage] = useState(null);

  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser. Try a recent version of Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); setError(""); };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) setPrompt((current) => current ? current + " " + transcript : transcript);
    };
    recognition.onerror = (event) => {
      const reason = event?.error;
      const message = reason === "not-allowed" || reason === "service-not-allowed"
        ? "Microphone access is blocked. Allow microphone permission in your browser settings."
        : reason === "no-speech"
          ? "No speech was detected. Try again in a quieter place."
          : reason === "language-not-supported"
            ? "This browser does not support speech recognition for the selected language. Try another language or type your message."
            : reason === "network"
              ? "The browser speech service is unavailable. Check your connection and try again."
              : "Voice recognition could not complete. Check microphone permission and try again.";
      setError(message);
    };
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
    utterance.lang = inferSpeechLanguage(text, navigator.language || "en-IN");
    const matchingVoice = selectSpeechVoice(window.speechSynthesis.getVoices(), utterance.lang);
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
      if (result.imageDataUrl) {
        const imageResponse = await fetch(result.imageDataUrl);
        if (!imageResponse.ok) throw new Error("Could not prepare this saved image.");
        const imageBlob = await imageResponse.blob();
        setImageFile(new File([imageBlob], result.filename || "aahana-image", { type: result.mimeType }));
        setMode("solve");
        setPrompt("Please inspect this saved image carefully. Describe what is visible, identify important details, and answer any questions I add.");
        setFilesError("Image attached to your message. Add a question if you like, then send it to Aahana.");
        return;
      }
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
    if (!imagePrompt || imageGenerating || imageUpscaling || videoGenerating || busy || imageFile || imageUpscaleFile) return;
    setImageGenerating(true);
    setError("");
    setGeneratedImage(null);
    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, steps: 8, quality: "masterpiece", ...(imageAspectRatio === "auto" ? {} : { aspectRatio: imageAspectRatio }),
          ...(Object.values(imageSeries).some((value) => String(value).trim()) ? { series: { ...Object.fromEntries(Object.entries(imageSeries).filter(([key, value]) => key !== "sceneNumber" && value.trim()).map(([key, value]) => [key, value.trim()])), ...(imageSeries.sceneNumber.trim() ? { sceneNumber: Number(imageSeries.sceneNumber) } : {}) } } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not generate the image.");
      if (typeof result.imageDataUrl !== "string" || !/^data:image\/(?:jpeg|png|webp);base64,/.test(result.imageDataUrl)) {
        throw new Error("The image provider returned an invalid image.");
      }
      setGeneratedImage({ dataUrl: result.imageDataUrl, prompt: imagePrompt });
    } catch (err) {
      setError(err.message || "Image generation failed.");
    } finally {
      setImageGenerating(false);
    }
  }

  async function enhanceImageTo4K(source = "generated") {
    if (!imageUpscaleEnabled || imageUpscaling || imageGenerating || videoGenerating || busy) return;
    const uploadedFile = source === "upload" ? imageFile : source === "upscale-upload" ? imageUpscaleFile : null;
    if (!uploadedFile && !generatedImage?.dataUrl) return;
    setImageUpscaling(true); setError(""); setImageSaveNotice("");
    try {
      let sourceFile = uploadedFile;
      if (!sourceFile) {
        const sourceResponse = await fetch(generatedImage.dataUrl);
        if (!sourceResponse.ok) throw new Error("Could not prepare the generated image.");
        const sourceBlob = await sourceResponse.blob();
        if (!["image/png", "image/jpeg", "image/webp"].includes(sourceBlob.type)) throw new Error("The generated image format is not supported for enhancement.");
        const extension = sourceBlob.type === "image/png" ? "png" : sourceBlob.type === "image/webp" ? "webp" : "jpg";
        sourceFile = new File([sourceBlob], "aahana-generated-image." + extension, { type: sourceBlob.type });
      }
      const formData = new FormData(); formData.append("image", sourceFile);
      const response = await fetch("/api/images/upscale", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not enhance this image.");
      if (typeof result.imageDataUrl !== "string" || !result.imageDataUrl.startsWith("data:image/png;base64,")) throw new Error("The enhancement service returned an invalid image.");
      setGeneratedImage({ dataUrl: result.imageDataUrl, prompt: uploadedFile ? "Enhanced image: " + uploadedFile.name : generatedImage.prompt });
      if (source === "upload") setImageFile(null);
      if (source === "upscale-upload") setImageUpscaleFile(null);
      setImageSaveNotice("Your 4K-enhanced image is ready to download or save to Files.");
    } catch (err) { setError(err.message || "Image enhancement failed."); }
    finally { setImageUpscaling(false); }
  }

  async function editGeneratedImage(editPrompt) {
    if ((!generatedImage && !imageFile) || !imageEditingEnabled || imageGenerating || imageUpscaling || videoGenerating || busy) return;
    setPrompt("");
    setImageGenerating(true);
    setError("");
    setGeneratedVideo(null);
    setMessages((current) => [...current,
      { role: "user", content: editPrompt },
      { role: "assistant", content: "Applying your changes while preserving the reference image…" },
    ]);
    try {
      const sourceImage = imageFile
        ? { dataUrl: await readFileAsDataUrl(imageFile), prompt: "" }
        : generatedImage;
      const referenceFile = await createReferenceImageFile(sourceImage.dataUrl);
      const form = new FormData();
      form.set("prompt", editPrompt);
      form.set("referencePrompt", String(sourceImage.prompt || "").slice(0, 1200));
      form.set("image", referenceFile);
      const response = await fetch("/api/images/edit", { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not edit the image.");
      if (typeof result.imageDataUrl !== "string" || !/^data:image\/(?:jpeg|png|webp);base64,/.test(result.imageDataUrl)) {
        throw new Error("The image editor returned an invalid image.");
      }
      setGeneratedImage({ dataUrl: result.imageDataUrl, prompt: sourceImage.prompt || editPrompt });
      if (imageFile) setImageFile(null);
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: "Updated your image. You can keep refining it with another instruction." } : item
      ));
    } catch (err) {
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: "I couldn't apply that image change." } : item
      ));
      setError(err.message || "Image editing failed.");
    } finally {
      setImageGenerating(false);
    }
  }

  async function saveGeneratedImage() {
    if (!generatedImage || imageSaving) return;
    setImageSaving(true);
    setError("");
    setImageSaveNotice("");
    try {
      const response = await fetch(generatedImage.dataUrl);
      const blob = await response.blob();
      const metadata = getGeneratedImageFileMetadata(generatedImage.dataUrl, blob.type);
      if (!metadata) throw new Error("The generated image format could not be verified.");
      const { mimeType, extension } = metadata;
      const file = new File([blob], "aahana-image-" + Date.now() + "." + extension, { type: mimeType });
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      const folder = selectedProjectId || "personal";
      const objectPath = `${user.id}/${folder}/${crypto.randomUUID()}-${file.name}`;
      const { error: storageError } = await supabase.storage.from("aahana-private").upload(objectPath, file, {
        contentType: mimeType, upsert: false,
      });
      if (storageError) throw new Error("Could not save the generated image. Please try again.");
      const saved = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectPath, originalFilename: file.name, mimeType,
          sizeBytes: file.size, projectId: selectedProjectId,
        }),
      });
      const result = await saved.json().catch(() => ({}));
      if (!saved.ok) {
        await supabase.storage.from("aahana-private").remove([objectPath]);
        throw new Error(result.error || "Could not save the image details.");
      }
      setFiles((items) => [result.file, ...items]);
      setImageSaveNotice("Image saved to your Aahana Files.");
    } catch (err) {
      setImageSaveNotice("");
      setError(err.message || "Could not save the generated image.");
    } finally {
      setImageSaving(false);
    }
  }

  async function generateVideo(videoPrompt = prompt.trim()) {
    if (!videoEnabled || !videoPrompt || videoGenerating || busy || imageGenerating || imageUpscaling) return false;
    const storyboardDuration = videoStoryboardShots.reduce((sum, shot) => sum + Number(shot.durationSeconds || 0), 0);
    if (videoStoryboardEnabled) {
      if (videoStoryboardShots.length < 2 || videoStoryboardShots.length > 6 || storyboardDuration > 15) {
        setError("A storyboard needs 2–6 shots with a combined duration of 15 seconds or less.");
        return false;
      }
      if (videoStoryboardShots.some((shot) => !shot.scene.trim() || !shot.action.trim() || !shot.camera.trim())) {
        setError("Complete the scene, action and camera direction for every storyboard shot.");
        return false;
      }
      if (!videoStoryboardStyle.trim()) {
        setError("Add a visual style for the storyboard.");
        return false;
      }
    }
    const controller = new AbortController();
    videoAbortControllerRef.current = controller;
    setVideoGenerating(true);
    setError("");
    setGeneratedVideo(null);
    try {
      const form = new FormData();
      form.set("prompt", videoPrompt);
      form.set("duration", String(videoStoryboardEnabled ? storyboardDuration : videoDuration));
      form.set("aspectRatio", videoAspectRatio);
      form.set("resolution", videoResolution);
      form.set("director", videoDirector);
      const continuity = Object.fromEntries(
        Object.entries(videoContinuity).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value)
      );
      if (Object.keys(continuity).length) form.set("continuity", JSON.stringify(continuity));
      if (videoStoryboardEnabled) {
        form.set("storyboard", JSON.stringify({
          title: videoPrompt.slice(0, 80) || "Aahana storyboard",
          visualStyle: videoStoryboardStyle.trim(),
          continuity: { subjectId: "primary-subject", wardrobeId: "primary-wardrobe", propIds: [] },
          shots: videoStoryboardShots.map((shot, index) => ({
            ...shot,
            transition: index === 0 ? "start" : shot.transition,
          })),
        }));
      }
      const videoReferenceFile = imageFile || (generatedImage?.dataUrl
        ? await createReferenceImageFile(generatedImage.dataUrl, {
          maxEdge: 4096,
          maxBytes: 2 * 1024 * 1024,
        })
        : null);
      if (videoReferenceFile) form.set("image", videoReferenceFile);
      const response = await fetch("/api/videos/generate", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not generate the video.");
      if (typeof result.videoUrl !== "string" || !result.videoUrl.startsWith("https://")) {
        throw new Error("The video provider returned an invalid video address.");
      }
      setGeneratedVideo({ url: result.videoUrl, prompt: videoPrompt, duration: result.duration });
      return true;
    } catch (err) {
      if (controller.signal.aborted || err?.name === "AbortError") {
        setError("Video generation cancelled.");
      } else {
        setError(err.message || "Video generation failed.");
      }
      return false;
    } finally {
      if (videoAbortControllerRef.current === controller) videoAbortControllerRef.current = null;
      setVideoGenerating(false);
    }
  }

  function updateVideoStoryboardShot(id, field, value) {
    setVideoStoryboardShots((shots) => shots.map((shot) => shot.id === id ? { ...shot, [field]: value } : shot));
  }

  function addVideoStoryboardShot() {
    setVideoStoryboardShots((shots) => shots.length >= 6 ? shots : [
      ...shots,
      { id: "shot-" + crypto.randomUUID(), durationSeconds: 2, scene: "", action: "", camera: "", transition: "cut" },
    ]);
  }

  function removeVideoStoryboardShot(id) {
    setVideoStoryboardShots((shots) => shots.length <= 2 ? shots : shots.filter((shot) => shot.id !== id));
  }

  function cancelVideoGeneration() {
    videoAbortControllerRef.current?.abort();
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
    const label = operation === "test" ? "Run isolated project tests" : "Run isolated project build";
    setBuildBusy(true);
    setError("");
    setMessages((current) => [...current,
      { role: "user", content: label },
      { role: "assistant", content: "Preparing your project for an isolated check…" },
    ]);
    try {
      const response = await fetch("/api/build/project", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, operation }),
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
  async function runProjectPreview() {
    if (!selectedProjectId || !previewEnabled || previewBusy || busy || buildBusy) return;
    setPreviewBusy(true);
    setPreviewError("");
    setPreviewUrl("");
    try {
      const response = await fetch("/api/build/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The live preview could not start.");
      if (typeof result.previewUrl !== "string" || !/^https:\/\//.test(result.previewUrl)) {
        throw new Error("The preview service returned an invalid address.");
      }
      setPreviewUrl(result.previewUrl);
    } catch (err) {
      setPreviewError(err.message || "The live preview could not start.");
    } finally {
      setPreviewBusy(false);
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

  async function prepareChatImage(file) {
    const maxSourceBytes = 5 * 1024 * 1024;
    const maxRequestBytes = 3_300_000;
    if (!file || file.size <= maxRequestBytes) return file;
    if (file.size > maxSourceBytes) {
      throw new Error("Images must be 5 MB or smaller.");
    }
    if (typeof createImageBitmap !== "function") {
      throw new Error("This browser cannot optimize this image for upload. Please choose an image under 3.3 MB.");
    }
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      let scale = Math.min(1, 4096 / Math.max(bitmap.width, bitmap.height));
      for (let dimensionAttempt = 0; dimensionAttempt < 5; dimensionAttempt += 1) {
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare this image for upload.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.94, 0.9, 0.86, 0.82, 0.78]) {
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
          if (blob?.type === "image/webp" && blob.size <= maxRequestBytes) {
            const safeName = file.name.replace(/\.[^.]+$/, "") || "image";
            return new File([blob], safeName + ".webp", { type: "image/webp", lastModified: file.lastModified });
          }
        }
        scale *= 0.82;
      }
    } finally {
      bitmap.close?.();
    }
    throw new Error("This image could not be optimized below the upload limit. Please choose a smaller image.");
  }

  async function submitPrompt(event) {
    event.preventDefault();
    const text = prompt.trim();
    if (imageUpscaleFile) { setError("Use Enhance to 4K to process the separately attached image."); return; }
    if ((!text && !imageFile) || busy || buildBusy || imageGenerating || videoGenerating || imageUpscaling) return;

    if (isVideoGenerationRequest(text)) {
      setPrompt("");
      setError("");
      setGeneratedVideo(null);
      if (!videoEnabled) {
        setMessages((current) => [...current,
          { role: "user", content: text },
          { role: "assistant", content: "Video generation is not enabled in this environment yet. No generation was started." },
        ]);
        return;
      }
      setMessages((current) => [...current,
        { role: "user", content: text },
        { role: "assistant", content: "Creating your video…" },
      ]);
      const succeeded = await generateVideo(text);
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1
          ? { ...item, content: succeeded ? "Your video is ready. You can preview it below." : "I couldn't generate that video. Your request was not sent again automatically." }
          : item
      ));
      return;
    }

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
          body: JSON.stringify({ prompt: text, steps: 8, quality: "masterpiece", ...(imageAspectRatio === "auto" ? {} : { aspectRatio: imageAspectRatio }),
          ...(Object.values(imageSeries).some((value) => String(value).trim()) ? { series: { ...imageSeries, sceneNumber: imageSeries.sceneNumber.trim() ? Number(imageSeries.sceneNumber) : undefined } } : {}) }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not generate the image.");
        if (typeof result.imageDataUrl !== "string" || !/^data:image\/(?:jpeg|png|webp);base64,/.test(result.imageDataUrl)) {
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

    if ((generatedImage || imageFile) && isImageEditRequest(text)) {
      setPrompt("");
      if (!imageEditingEnabled) {
        setMessages((current) => [...current,
          { role: "user", content: text },
          { role: "assistant", content: "Reference-based image editing is prepared but not enabled yet. Your current image is preserved." },
        ]);
        return;
      }
      await editGeneratedImage(text);
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
    const controller = new AbortController();
    activeChatControllerRef.current = controller;
    const userMessage = { role: "user", content: imageFile ? `${text || "Please identify this image."}\n[Image attached: ${imageFile.name}]` : text };
    const assistantMessage = { role: "assistant", content: "" };
    setMessages((current) => [...current, userMessage, assistantMessage]);

    let answer = "";
    let answerUpdateTimer = null;
    const queueAnswerUpdate = () => {
      if (answerUpdateTimer !== null) return;
      answerUpdateTimer = window.setTimeout(() => {
        answerUpdateTimer = null;
        setMessages((current) => current.map((item, index) =>
          index === current.length - 1 ? { ...item, content: answer } : item
        ));
      }, 48);
    };

    try {
      let requestBody;
      let requestHeaders;
      if (imageFile) {
        const form = new FormData();
        form.set("message", text || "Please identify and describe this image in detail.");
        form.set("mode", mode);
        if (conversationId) form.set("conversationId", conversationId);
        if (selectedProjectId) form.set("projectId", selectedProjectId);
        const uploadImage = await prepareChatImage(imageFile);
        form.set("image", uploadImage, uploadImage.name);
        requestBody = form;
      } else {
        requestHeaders = { "Content-Type": "application/json" };
        requestBody = JSON.stringify({ message: text, image: null, mode, conversationId, projectId: selectedProjectId });
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        ...(requestHeaders ? { headers: requestHeaders } : {}),
        body: requestBody,
        signal: controller.signal,
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
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        queueAnswerUpdate();
      }
      answer += decoder.decode();
      if (answerUpdateTimer !== null) { window.clearTimeout(answerUpdateTimer); answerUpdateTimer = null; }
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: answer || "I couldn't generate a response. Please try again." } : item
      ));
      setHistory([]);
      // Keep the selected upload available for retry until the response succeeds.
      setImageFile(null);
    } catch (err) {
      if (answerUpdateTimer !== null) { window.clearTimeout(answerUpdateTimer); answerUpdateTimer = null; }
      setMessages((current) => {
        const last = current[current.length - 1];
        if (last?.role !== "assistant") return current;
        if (!answer.trim()) return current.slice(0, -1);
        return current.map((item, index) => index === current.length - 1
          ? { ...item, content: answer + "\n\n[Response interrupted. You can retry your request.]" }
          : item);
      });
      if (err?.name === "AbortError") {
        setMessages((current) => current.map((item, index) => {
          if (index !== current.length - 1 || item.role !== "assistant") return item;
          return { ...item, content: answer.trim() ? answer + "\n\n[Response stopped.]" : "Response stopped." };
        }));
      } else {
        setError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      if (answerUpdateTimer !== null) window.clearTimeout(answerUpdateTimer);
      if (activeChatControllerRef.current === controller) activeChatControllerRef.current = null;
      setBusy(false);
    }
  }

  function stopGeneration() {
    activeChatControllerRef.current?.abort();
  }

  return (
    <main className="shell">
      <div className="space-background" aria-hidden="true">
        <UniverseScene />
        <div className="universe-flight" data-speed="65 km/h">
          <div className="universe-depth-stars" aria-hidden="true">
            <i className="depth-stars-far" />
            <i className="depth-stars-mid" />
            <i className="depth-stars-near" />
          </div>
          <div className="universe-galaxy" aria-hidden="true">
            <span className="galaxy-core" />
            <i className="galaxy-arm galaxy-arm-one" />
            <i className="galaxy-arm galaxy-arm-two" />
            <i className="galaxy-arm galaxy-arm-three" />
          </div>
          <div className="universe-particles">
            {Array.from({ length: 64 }, (_, index) => (
              <i
                key={index}
                style={{
                  "--particle-x": `${(index * 37 + 11) % 100}%`,
                  "--particle-y": `${(index * 61 + 7) % 100}%`,
                  "--particle-delay": `${-((index * 7) % 19)}s`,
                  "--particle-duration": `${11 + (index % 8) * 1.5}s`,
                  "--particle-size": `${1 + (index % 3)}px`,
                }}
              />
            ))}
          </div>
          <div className="universe-comets">
            {Array.from({ length: 6 }, (_, index) => (
              <i
                key={index}
                style={{
                  "--comet-x": `${(index * 23 + 9) % 92}%`,
                  "--comet-y": `${(index * 31 + 13) % 84}%`,
                  "--comet-delay": `${-((index * 5) % 17)}s`,
                  "--comet-duration": `${12 + (index % 3) * 3}s`,
                  "--comet-angle": `${-24 + (index % 4) * 16}deg`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <AstronautCompanion variant="assistant" />

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
                  {(["application/pdf", "text/plain", "text/markdown", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg", "image/webp"].includes(file.mime_type)) ? (
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
          <div className="eyebrow"><span /> YOUR THINKING SPACE</div>
          {!messages.length && <>
            <h1>Good ideas<br /><em>start somewhere.</em></h1>
            <p>Think freely. Explore ideas. Build something real.</p>
          </>}

          <div className="mode-row assistance-context" aria-label="Current workspace">
            <span className="active-mode">Assistance</span>
            <span className="assistance-context-note">Ask naturally — create, write, research, build and improve in one conversation.</span>
          </div>
          <div className="assistance-tool-launchers" role="group" aria-label="Assistance tools">
            <button type="button" onClick={() => { setMode("build"); setError(""); }}>Build workspace <span aria-hidden="true">↗</span></button>
            <button type="button" onClick={() => { setMode("create"); setError(""); }}>Creative tools <span aria-hidden="true">✧</span></button>
            <button type="button" onClick={() => { setPrompt("Research this topic thoroughly, compare reliable sources and summarize the evidence: "); setError(""); }}>Research <span aria-hidden="true">⌕</span></button>
            <button type="button" onClick={startVoiceInput} disabled={listening || busy}>{listening ? "Listening…" : "Voice"} <span aria-hidden="true">◖</span></button>
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
                  <button type="button" disabled={!selectedProjectId || !previewEnabled || previewBusy || buildBusy || busy} onClick={runProjectPreview}>
                    {previewBusy ? "Starting preview…" : "Live preview"}
                  </button>
                </div>
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
              <p className="build-tools-note">
                {previewEnabled
                  ? "Live preview is available for supported Next.js and Vite projects."
                  : "Live preview is staged but disabled in this environment until its preview runtime is explicitly enabled."}
              </p>
              {previewError && <p className="build-tools-error" role="alert">{previewError}</p>}
              {previewUrl && (
                <section className="live-preview-panel" aria-label="Live website preview">
                  <div className="live-preview-toolbar">
                    <div><strong>Live preview</strong><small>Temporary isolated session · expires after 10 minutes</small></div>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
                  </div>
                  <iframe
                    className="live-preview-frame"
                    title="Your website live preview"
                    src={previewUrl}
                    sandbox="allow-scripts allow-forms allow-popups allow-modals"
                    referrerPolicy="no-referrer"
                  />
                </section>
              )}
            </section>
          )}
          <form className="composer" onSubmit={submitPrompt}>
            <label className="sr-only" htmlFor="image-upload">Attach an image for Aahana to identify or analyse</label>
            {generatedImage && (
              <div className="generated-image-preview">
                <img src={generatedImage.dataUrl} alt={generatedImage.prompt} style={{ display: "block", width: "100%", maxWidth: "640px", borderRadius: "14px" }} />
                <div className="message-actions">
                  <a className="copy-message" href={generatedImage.dataUrl} download={"aahana-generated-image." + (generatedImage.dataUrl.startsWith("data:image/png") ? "png" : generatedImage.dataUrl.startsWith("data:image/webp") ? "webp" : "jpg")}>Download image</a>
                  <button className="copy-message" type="button" onClick={saveGeneratedImage} disabled={imageSaving || imageUpscaling}>{imageSaving ? "Saving…" : "Save to Files"}</button>
                  {imageUpscaleEnabled && <button className="copy-message" type="button" onClick={() => enhanceImageTo4K("generated")} disabled={imageUpscaling || imageGenerating || busy}>{imageUpscaling ? "Enhancing to 4K…" : "Enhance to 4K"}</button>}
                  <button className="copy-message" type="button" onClick={() => setGeneratedImage(null)}>Remove</button>
                </div>
                {imageSaveNotice && <div className="notice" role="status">{imageSaveNotice}</div>}
              </div>
            )}
            {generatedVideo && (
              <div className="generated-image-preview">
                <video controls playsInline preload="metadata" src={generatedVideo.url} style={{ display: "block", width: "100%", maxWidth: "720px", borderRadius: "14px" }} />
                <div className="message-actions">
                  <a className="copy-message" href={generatedVideo.url} target="_blank" rel="noopener noreferrer">Open video</a>
                  <button className="copy-message" type="button" onClick={() => setGeneratedVideo(null)}>Remove</button>
                </div>
              </div>
            )}
            <div className="image-attach-row">
              {videoEnabled && (
                <>
                  <button className="copy-message" type="button" onClick={() => generateVideo()} disabled={!prompt.trim() || videoGenerating || busy || imageGenerating}>
                    {videoGenerating ? "Generating video…" : imageFile || generatedImage ? "Animate image" : "Generate video"}
                  </button>
                  {videoGenerating && (
                    <button className="copy-message" type="button" onClick={cancelVideoGeneration} aria-label="Cancel video generation">
                      Cancel generation
                    </button>
                  )}
                  <details className="video-advanced-settings">
                    <summary>Video settings</summary>
                    <select aria-label="Video duration" value={videoDuration} onChange={(event) => setVideoDuration(Number(event.target.value))} className="copy-message" disabled={videoStoryboardEnabled}>
                      <option value={3}>3 seconds</option>
                      <option value={5}>5 seconds</option>
                      <option value={10}>10 seconds</option>
                      <option value={15}>15 seconds</option>
                    </select>
                    <select aria-label="Video aspect ratio" value={videoAspectRatio} onChange={(event) => setVideoAspectRatio(event.target.value)} className="copy-message">
                      <option value="16:9">Landscape 16:9</option>
                      <option value="9:16">Portrait 9:16</option>
                      <option value="1:1">Square 1:1</option>
                      <option value="4:3">4:3</option>
                      <option value="3:4">3:4</option>
                      <option value="3:2">3:2</option>
                      <option value="2:3">2:3</option>
                    </select>
                    <select aria-label="Video direction" value={videoDirector} onChange={(event) => setVideoDirector(event.target.value)} className="copy-message">
                      <option value="cinematic">Cinematic</option>
                      <option value="commercial">Commercial</option>
                      <option value="documentary">Documentary</option>
                      <option value="anime">Anime</option>
                      <option value="none">Use my prompt as written</option>
                    </select>
                    <select aria-label="Video resolution" value={videoResolution} onChange={(event) => setVideoResolution(event.target.value)} className="copy-message">
                      <option value="480p">480p</option>
                      <option value="720p">720p</option>
                    </select>
                    <details className="video-advanced-settings">
                      <summary>Multi-shot storyboard (optional)</summary>
                      <label className="copy-message" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input type="checkbox" checked={videoStoryboardEnabled} onChange={(event) => setVideoStoryboardEnabled(event.target.checked)} />
                        Build this video from a shot-by-shot plan
                      </label>
                      {videoStoryboardEnabled && (
                        <div className="video-storyboard-editor">
                          <p className="muted">2–6 shots · maximum 15 seconds total. This guides one video-generation request; exact cut execution depends on the video model.</p>
                          <input aria-label="Storyboard visual style" className="copy-message" maxLength={160} value={videoStoryboardStyle} onChange={(event) => setVideoStoryboardStyle(event.target.value)} placeholder="Visual style, lighting and color grade" />
                          {videoStoryboardShots.map((shot, index) => (
                            <fieldset key={shot.id} className="video-storyboard-shot">
                              <legend>Shot {index + 1}</legend>
                              <select aria-label={`Shot ${index + 1} duration`} className="copy-message" value={shot.durationSeconds} onChange={(event) => updateVideoStoryboardShot(shot.id, "durationSeconds", Number(event.target.value))}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
                              </select>
                              <input aria-label={`Shot ${index + 1} scene`} className="copy-message" maxLength={180} value={shot.scene} onChange={(event) => updateVideoStoryboardShot(shot.id, "scene", event.target.value)} placeholder="Scene and environment" />
                              <input aria-label={`Shot ${index + 1} action`} className="copy-message" maxLength={180} value={shot.action} onChange={(event) => updateVideoStoryboardShot(shot.id, "action", event.target.value)} placeholder="What happens in this shot" />
                              <input aria-label={`Shot ${index + 1} camera`} className="copy-message" maxLength={180} value={shot.camera} onChange={(event) => updateVideoStoryboardShot(shot.id, "camera", event.target.value)} placeholder="Camera framing and movement" />
                              {index > 0 && (
                                <select aria-label={`Shot ${index + 1} transition`} className="copy-message" value={shot.transition} onChange={(event) => updateVideoStoryboardShot(shot.id, "transition", event.target.value)}>
                                  <option value="cut">Cut</option>
                                  <option value="dissolve">Dissolve</option>
                                  <option value="match-cut">Match cut</option>
                                  <option value="whip-pan">Whip pan</option>
                                  <option value="fade">Fade</option>
                                </select>
                              )}
                              {videoStoryboardShots.length > 2 && <button className="copy-message" type="button" onClick={() => removeVideoStoryboardShot(shot.id)}>Remove shot</button>}
                            </fieldset>
                          ))}
                          <p className="muted">Total storyboard duration: {storyboardDuration} / 15 seconds</p>
                          <button className="copy-message" type="button" onClick={addVideoStoryboardShot} disabled={videoStoryboardShots.length >= 6}>Add shot</button>
                        </div>
                      )}
                    </details>
                    <details className="video-advanced-settings">
                      <summary>Scene continuity (optional)</summary>
                      <input aria-label="Continuity subject identity" className="copy-message" maxLength={180} placeholder="Subject identity and defining traits"
                        value={videoContinuity.subject} onChange={(event) => setVideoContinuity((current) => ({ ...current, subject: event.target.value }))} />
                      <input aria-label="Continuity setting" className="copy-message" maxLength={180} placeholder="Setting and environment"
                        value={videoContinuity.setting} onChange={(event) => setVideoContinuity((current) => ({ ...current, setting: event.target.value }))} />
                      <input aria-label="Continuity action" className="copy-message" maxLength={180} placeholder="Action and direction"
                        value={videoContinuity.action} onChange={(event) => setVideoContinuity((current) => ({ ...current, action: event.target.value }))} />
                      <input aria-label="Continuity camera movement" className="copy-message" maxLength={180} placeholder="Camera position and movement"
                        value={videoContinuity.camera} onChange={(event) => setVideoContinuity((current) => ({ ...current, camera: event.target.value }))} />
                      <input aria-label="Video opening frame" className="copy-message" maxLength={180} placeholder="Opening frame"
                        value={videoContinuity.openingFrame} onChange={(event) => setVideoContinuity((current) => ({ ...current, openingFrame: event.target.value }))} />
                      <input aria-label="Video closing frame" className="copy-message" maxLength={180} placeholder="Closing frame"
                        value={videoContinuity.closingFrame} onChange={(event) => setVideoContinuity((current) => ({ ...current, closingFrame: event.target.value }))} />
                    </details>
                  </details>
                </>
              )}
              <button className="copy-message" type="button" onClick={startVoiceInput} disabled={listening || busy}>{listening ? "Listening…" : "Speak"}</button>
              <label className="image-attach">
                + Add image
                <input id="image-upload" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    event.target.value = "";
                    if (!file) return;
                    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG or WebP image."); return; }
                    if (file.size > 5 * 1024 * 1024) { setError("Images must be 5 MB or smaller."); return; }
                    setError("");
                    setImageFile(file);
                  }} />
              </label>
              {imageFile && <span className="image-attach-name">{imageFile.name} <button type="button" onClick={() => enhanceImageTo4K("upload")} disabled={!imageUpscaleEnabled || imageUpscaling || imageGenerating || busy}>{imageUpscaling ? "Enhancing…" : "Enhance to 4K"}</button> <button type="button" onClick={() => setImageFile(null)}>Remove</button></span>}
              {imageUpscaleEnabled && <label className="image-attach">
                + 4K image (up to 20 MB)
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || imageUpscaling} onChange={(event) => {
                  const file = event.target.files?.[0] || null; event.target.value = ""; if (!file) return;
                  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG or WebP image."); return; }
                  if (file.size > 20 * 1024 * 1024) { setError("4K enhancement supports source images up to 20 MB."); return; }
                  setError(""); setImageUpscaleFile(file);
                }} />
              </label>}
              {imageUpscaleFile && <span className="image-attach-name">{imageUpscaleFile.name} <button type="button" onClick={() => enhanceImageTo4K("upscale-upload")} disabled={imageUpscaling || imageGenerating || busy}>{imageUpscaling ? "Enhancing…" : "Enhance to 4K"}</button> <button type="button" onClick={() => setImageUpscaleFile(null)} disabled={imageUpscaling}>Remove</button></span>}
</div>
            <label className="sr-only" htmlFor="prompt">What would you like to work on?</label>
            <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
              placeholder={aiEnabled ? "What would you like to work on today?" : "Try a calculation, e.g. 2 + 2 (offline)"} rows={3} disabled={busy || imageUpscaling} />
            <div className="composer-footer">
              <span className="composer-mode">{modes.find((item) => item.id === mode)?.hint} · Enter to send · Shift + Enter for a new line</span>
              {busy && <button className="stop-generation" type="button" onClick={stopGeneration}>Stop</button>}
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
        <footer className="footer"><span>Aahana</span><span>Thoughtfully made for what’s next.</span><span className="founder-signature">— Abhishekayya Salimath</span></footer>
      </section>
    </main>
  );
}
