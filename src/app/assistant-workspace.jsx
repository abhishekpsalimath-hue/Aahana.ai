"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { findBestSpeechVoice } from "@/lib/voice/browser-capabilities.mjs";
import { inferSpeechLocale } from "@/lib/voice/locale-detection.mjs";
import { shouldFallbackToDeviceSpeech } from "@/lib/voice/speech-fallback-policy.mjs";
import { isImageGenerationRequest } from "@/lib/ai/image-intent-policy.mjs";

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

const modeStarters = {
  solve: [
    "Help me understand a difficult problem step by step",
    "Compare these options and recommend a practical choice",
    "Explain this concept with a simple example",
    "Help me analyse this information",
  ],
  create: [
    "Create a premium visual identity for my new brand",
    "Generate an original photorealistic digital character",
    "Develop a creative concept for a short video",
    "Turn this rough idea into a polished design direction",
  ],
  write: [
    "Write a clear, professional email",
    "Turn these notes into a concise proposal",
    "Rewrite this so it sounds natural and confident",
    "Create a practical product brief",
  ],
  build: [
    "Build a responsive website for my business",
    "Create a full-stack app with authentication and a database",
    "Review this codebase and fix the issue I describe",
    "Design the architecture and implementation for my product",
  ],
  improve: [
    "Review this website and suggest specific improvements",
    "Refactor this code without changing its behaviour",
    "Make this workflow simpler and more reliable",
    "Improve this product experience for mobile users",
  ],
};

const modePlaceholders = {
  solve: "Ask a question or describe the problem you want to solve…",
  create: "Describe what you want to create…",
  write: "Tell Aahana what you need to write…",
  build: "Describe the website, app or software you want to build…",
  improve: "Share what you want Aahana to review or improve…",
};

function renderAssistantContent(content) {
  const nodes = [];
  const source = String(content || "");
  const codeBlock = /\`\`\`([^\n]*)\n([\s\S]*?)\`\`\`/g;
  const citationLink = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  function appendProse(value) {
    let proseIndex = 0;
    let citation;
    while ((citation = citationLink.exec(value)) !== null) {
      if (citation.index > proseIndex) nodes.push(value.slice(proseIndex, citation.index));
      try {
        const url = new URL(citation[2]);
        if (url.protocol === "https:") {
          nodes.push(<a key={key++} href={url.toString()} target="_blank" rel="noopener noreferrer">{citation[1]}</a>);
        } else {
          nodes.push(citation[0]);
        }
      } catch {
        nodes.push(citation[0]);
      }
      proseIndex = citationLink.lastIndex;
    }
    citationLink.lastIndex = 0;
    if (proseIndex < value.length) nodes.push(value.slice(proseIndex));
  }

  while ((match = codeBlock.exec(source)) !== null) {
    if (match.index > lastIndex) appendProse(source.slice(lastIndex, match.index));
    const code = match[2].replace(/\n$/, "");
    const label = match[1].trim() || "Code";
    const filePath = label.split(/\s+/).slice(1).join(" ");
    const safeFilePath = filePath
      && !filePath.startsWith("/")
      && !filePath.split("/").some((part) => !part || part === "." || part === "..")
      && /^[A-Za-z0-9._/-]+$/.test(filePath)
      ? filePath
      : null;
    nodes.push(
      <section className="assistant-code-block" key={key++}>
        <div className="assistant-code-heading">
          <span>{label}</span>
          <div className="assistant-code-actions">
            {safeFilePath && (
              <button type="button" onClick={() => {
                const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = safeFilePath.split("/").pop();
                anchor.rel = "noopener";
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}>Download file</button>
            )}
            <button type="button" onClick={() => navigator.clipboard?.writeText(code).catch(() => {})}>Copy code</button>
          </div>
        </div>
        <pre><code>{code}</code></pre>
      </section>
    );
    lastIndex = codeBlock.lastIndex;
  }

  if (lastIndex < source.length) appendProse(source.slice(lastIndex));
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
  const [mode, setMode] = useState("solve");
  const activeStarters = modeStarters[mode] || starters;
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [buildBusy, setBuildBusy] = useState(false);
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
  const [projectType, setProjectType] = useState("web");
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
  const [voiceLanguage] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [speakingMessage, setSpeakingMessage] = useState(null);
  const [speechVoices, setSpeechVoices] = useState([]);
  const audioPlaybackRef = useRef(null);
  const audioObjectUrlRef = useRef(null);
  useEffect(() => {
    const refreshVoices = () => setSpeechVoices(window.speechSynthesis?.getVoices?.() || []);
    refreshVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", refreshVoices);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", refreshVoices);
  }, []);

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
    recognition.onerror = (event) => {
      const messages = {
        "not-allowed": "Microphone access is blocked. Allow microphone permission in your browser settings.",
        "service-not-allowed": "This browser does not allow its speech-recognition service.",
        "language-not-supported": `This browser's speech service does not support ${voiceLanguage}. Choose another language or use text input.`,
        "audio-capture": "No working microphone was detected. Check your microphone connection.",
        "no-speech": "No speech was detected. Try speaking a little closer to the microphone.",
        "network": "The browser speech service could not connect. Check your internet connection.",
      };
      setError(messages[event?.error] || "Voice recognition could not complete. You can still type your message.");
    };
    recognition.onend = () => setListening(false);
    try { recognition.start(); } catch { setListening(false); setError("Voice input is already active. Please try again."); }
  }

  useEffect(() => () => {
    audioPlaybackRef.current?.pause?.();
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
  }, []);

  async function speakResponse(text, index) {
    const spokenText = String(text || "").trim();
    if (!spokenText) return;
    if (speakingMessage === index) {
      audioPlaybackRef.current?.pause?.();
      audioPlaybackRef.current = null;
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
      window.speechSynthesis?.cancel?.();
      setSpeakingMessage(null);
      return;
    }

    window.speechSynthesis?.cancel?.();
    audioPlaybackRef.current?.pause?.();
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    audioObjectUrlRef.current = null;
    const speechLanguage = inferSpeechLocale(spokenText, voiceLanguage);
    setSpeakingMessage(index);
    setError("");

    try {
      const response = await fetch("/api/voice/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spokenText.slice(0, 6000), locale: speechLanguage }),
      });
      if (response.ok) {
        const audioBlob = await response.blob();
        if (!audioBlob.size || !audioBlob.type.startsWith("audio/")) {
          throw new Error("Aahana's speech service returned invalid audio.");
        }
        const objectUrl = URL.createObjectURL(audioBlob);
        audioObjectUrlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        audioPlaybackRef.current = audio;
        audio.onended = () => {
          if (audioObjectUrlRef.current === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            audioObjectUrlRef.current = null;
            audioPlaybackRef.current = null;
          }
          setSpeakingMessage(null);
        };
        audio.onerror = () => {
          if (audioObjectUrlRef.current === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            audioObjectUrlRef.current = null;
            audioPlaybackRef.current = null;
          }
          setSpeakingMessage(null);
          setError("The generated speech could not be played on this device.");
        };
        await audio.play();
        return;
      }
      if (!shouldFallbackToDeviceSpeech(response.status)) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Aahana's speech service could not complete this request.");
      }
    } catch (err) {
      if (err?.name === "NotAllowedError") {
        setSpeakingMessage(null);
        setError("Tap Listen again to allow audio playback.");
        return;
      }
      if (err instanceof Error && !/Failed to fetch|NetworkError/i.test(err.message)) {
        setSpeakingMessage(null);
        setError(err.message || "Speech playback failed.");
        return;
      }
    }

    if (!("speechSynthesis" in window)) {
      setSpeakingMessage(null);
      setError("Spoken responses are not available. The text reply remains visible.");
      return;
    }
    const matchingVoice = findBestSpeechVoice(speechVoices, speechLanguage);
    if (!matchingVoice) {
      setSpeakingMessage(null);
      setError(`No configured speech service or installed device voice is available for ${speechLanguage}. The text reply remains visible.`);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = speechLanguage;
    utterance.voice = matchingVoice;
    utterance.onend = () => setSpeakingMessage(null);
    utterance.onerror = () => setSpeakingMessage(null);
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
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length || fileBusy) return;
    setFileBusy(true);
    setFilesError("");
    const uploadedPaths = [];
    try {
      const allowed = ["application/pdf", "text/plain", "text/markdown", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg", "image/webp"];
      const codeExtensions = new Set(["html", "htm", "css", "js", "jsx", "ts", "tsx", "mjs", "cjs", "json", "xml", "yaml", "yml", "toml", "sql", "py", "sh", "md", "txt"]);
      const isFolderBatch = selected.length > 1 || Boolean(selected[0]?.webkitRelativePath);
      if (selected.length > 100) throw new Error("A project folder can contain up to 100 files per upload.");
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      const folder = selectedProjectId || "personal";
      let batchBytes = 0;
      const saved = [];
      for (const file of selected) {
        const relativeName = file.webkitRelativePath || file.name;
        const rawPath = relativeName.replace(/\\/g, "/");
        const rawSegments = rawPath.split("/");
        if (!rawPath || rawPath.startsWith("/") || rawSegments.some((part) => !part || part === "." || part === ".." || /[\\u0000-\\u001f\\u007f\\u202a-\\u202e\\u2066-\\u2069]/.test(part))) {
          throw new Error("The folder contains an unsafe file path.");
        }
        // Browser folder selection prefixes every file with the chosen folder name; strip that wrapper.
        const normalized = (file.webkitRelativePath ? rawSegments.slice(1) : rawSegments).join("/");
        if (!normalized) throw new Error("The folder contains an invalid file path.");
        const extension = file.name.toLowerCase().split(".").pop();
        const isCodeFile = codeExtensions.has(extension);
        if (!allowed.includes(file.type) && !isCodeFile) throw new Error("Unsupported file type: " + file.name);
        if (file.size < 1 || file.size > (selectedProjectId ? 1024 * 1024 : 10 * 1024 * 1024)) {
          throw new Error(selectedProjectId ? "Project source files must be 1 MB or smaller." : "Files must be between 1 byte and 10 MB.");
        }
        batchBytes += file.size;
        if (selectedProjectId && batchBytes > 3 * 1024 * 1024) throw new Error("A project folder upload is limited to 3 MB total.");
        const upload = isCodeFile && !["text/plain", "text/markdown"].includes(file.type)
          ? new File([await file.text()], file.name, { type: "text/plain" })
          : file;
        const safeStorageName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "upload";
        const objectPath = user.id + "/" + folder + "/" + crypto.randomUUID() + "-" + safeStorageName;
        const { error: storageError } = await supabase.storage.from("aahana-private").upload(objectPath, upload, { contentType: upload.type, upsert: false });
        if (storageError) throw new Error("Upload failed for " + file.name + ".");
        uploadedPaths.push(objectPath);
        const response = await fetch("/api/files", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectPath, originalFilename: normalized, mimeType: upload.type, sizeBytes: upload.size, projectId: selectedProjectId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not save " + file.name + ".");
        saved.push(result.file);
      }
      setFiles((items) => [...saved.reverse(), ...items]);
      setFilesError(isFolderBatch ? "Project folder uploaded with relative paths preserved." : "File uploaded.");
    } catch (err) {
      if (uploadedPaths.length) await supabaseRemoveUploadedFiles(uploadedPaths);
      setFilesError(err.message || "Upload failed.");
    } finally {
      setFileBusy(false);
    }

    async function supabaseRemoveUploadedFiles(paths) {
      try {
        await fetch("/api/files", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objectPaths: paths }) });
      } catch {
        // Storage cleanup is best-effort; failed records remain private and are not executed automatically.
      }
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
        body: JSON.stringify({ name: projectName.trim(), description: projectDescription.trim(), project_type: projectType }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not create project.");
      setProjects((items) => [result.project, ...items]);
      setSelectedProjectId(result.project.id);
      setProjectName("");
      setProjectDescription("");
      setProjectType("web");
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

  async function runProjectCheck(operation) {
    if (!selectedProjectId || buildBusy || busy) return;
    const label = operation === "test" ? "Run isolated project tests" : "Run isolated project build";
    setBuildBusy(true);
    setError("");
    setMessages((current) => [...current,
      { role: "user", content: label },
      { role: "assistant", content: "Preparing the latest uploaded project source for an isolated check…" },
    ]);
    try {
      const response = await fetch("/api/build/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, operation }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The isolated project check could not start.");
      const output = [
        result.status === "passed" ? "Isolated check passed." : "Isolated check failed.",
        `Operation: ${result.operation}`,
        `Source files: ${result.sourceFileCount}`,
        result.exitCode !== undefined ? `Exit code: ${result.exitCode}` : "",
        result.stdout ? `\nOutput:\n${result.stdout}` : "",
        result.stderr ? `\nDiagnostics:\n${result.stderr}` : "",
        "\nNo project files were changed and nothing was deployed.",
      ].filter(Boolean).join("\n");
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: output } : item
      ));
    } catch (err) {
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: err.message || "The isolated project check failed." } : item
      ));
    } finally {
      setBuildBusy(false);
    }
  }

  async function draftProjectChanges() {
    const requestText = prompt.trim();
    if (!selectedProjectId || !requestText || buildBusy || busy || imageGenerating) return;
    setBuildBusy(true);
    setError("");
    setPrompt("");
    setMessages((current) => [...current,
      { role: "user", content: "Draft project changes: " + requestText },
      { role: "assistant", content: "Reviewing the project snapshot and preparing a safe change proposal…" },
    ]);
    try {
      const response = await fetch("/api/build/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, prompt: requestText }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Aahana could not draft these project changes.");
      const sections = [
        "PROPOSAL READY — REVIEW ONLY",
        result.summary || "Aahana prepared a project change proposal.",
        "",
        `Files proposed: ${Array.isArray(result.changes) ? result.changes.length : 0}`,
        `Snapshot: ${result.snapshotFileCount} files · ${result.snapshotBytes} bytes`,
        "",
        "No project files have been changed. Nothing has been applied or deployed.",
      ];
      let remaining = 52000;
      for (const change of result.changes || []) {
        if (remaining <= 0) {
          sections.push("", "Additional diff previews omitted to keep this review readable.");
          break;
        }
        const diff = String(change.diff || "").slice(0, remaining);
        sections.push("", `FILE: ${change.path} · ${change.action.toUpperCase()}`, "```diff", diff, "```");
        remaining -= diff.length;
      }
      sections.push("", "Applying these changes is a separate action and is not available in this review.");
      const output = sections.join("\n");
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: output } : item
      ));
    } catch (err) {
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: err.message || "Proposal generation failed." } : item
      ));
    } finally {
      setBuildBusy(false);
    }
  }

  async function submitPrompt(event) {
    event.preventDefault();
    const text = prompt.trim();
    if ((!text && !imageFile) || busy || imageGenerating) return;

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
        <a className="side-item muted learning-nav" href="/learn" aria-label="Open Student Mode">✧ <span>Student Mode</span></a>
        <a className="side-item muted" href="/creator-studio">✦ <span>Creator Studio</span></a>
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
        <a className="side-item muted operations-nav" href="/operations" aria-label="Automation and executive team" title="Automation and executive team">⚙ <span>Automation &amp; executives</span></a>
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
              {fileBusy ? "Uploading…" : "＋ Upload project folder"}
              <input type="file" hidden multiple webkitdirectory="" directory="" disabled={fileBusy || !selectedProjectId} onChange={uploadFile} accept=".txt,.md,.html,.htm,.css,.js,.jsx,.ts,.tsx,.mjs,.cjs,.json,.yaml,.yml,.toml,.sql,.py" />
            </label>
            <label className="project-add">
              {fileBusy ? "Uploading…" : "＋ Upload file"}
              <input type="file" hidden disabled={fileBusy} onChange={uploadFile} accept=".pdf,.txt,.md,.csv,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.html,.htm,.css,.js,.jsx,.ts,.tsx,.mjs,.cjs,.json,.xml,.yaml,.yml,.toml,.sql,.py,.sh" />
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
                  <span>{project.name}</span><small>{project.project_type || "other"} · {project.status}</small>{project.description && <small className="project-description" title={project.description}>{project.description}</small>}
                </button>
                <button className="project-archive" type="button" aria-label={`Archive ${project.name}`} onClick={() => archiveProject(project.id)}>×</button>
              </div>
            ))}
            {showProjectForm ? (
              <form className="project-create-form" onSubmit={createProject}>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} placeholder="Project name" aria-label="Project name" required />
                <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={500} placeholder="Short description (optional)" aria-label="Project description" rows={2} />
                <select value={projectType} onChange={(event) => setProjectType(event.target.value)} aria-label="Project type"><option value="web">Website</option><option value="app">App</option><option value="design">Design</option><option value="other">Other</option></select>
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
          <div className="top-actions"><button className="mobile-history-toggle" type="button" onClick={toggleProjects}>Projects</button><button className="mobile-history-toggle" type="button" onClick={toggleHistory}>History</button><button className="mobile-history-toggle" type="button" onClick={toggleFiles}>Files</button><button className="mobile-history-toggle" type="button" onClick={toggleMemoryPanel}>Memory</button><a className="student-mode-shortcut" href="/learn">✧ Student Mode</a><button className="mobile-history-toggle" type="button" onClick={() => setCreativeStudioOpen((value) => !value)}>Creative Studio</button><button className="mobile-history-toggle" type="button" onClick={() => setLearningWorldsOpen((value) => !value)}>Learning Worlds</button><span>Private workspace</span></div>
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
          {!messages.length && <div className="cosmic-field" aria-hidden="true"><span className="cosmic-nebula" /><span className="cosmic-stars cosmic-stars-far" /><span className="cosmic-stars cosmic-stars-mid" /><span className="cosmic-stars cosmic-stars-near" /><span className="cosmic-core" /></div>}
          {!messages.length && <div className="founder-welcome-note" aria-label="I'm happy to welcome you on this journey with Aahana AI. Abhishekayya Salimath.">
            <p><span className="welcome-line welcome-line-one">I'm happy to welcome you</span><span className="welcome-line welcome-line-two">on this journey with</span><em className="welcome-brand-word">Aahana AI.</em></p>
            <strong>Abhishekayya Salimath</strong>
          </div>}
          <div className="welcome-signal" aria-hidden="true">
            <span className="signal-orbit signal-orbit-one" />
            <span className="signal-orbit signal-orbit-two" />
            <span className="signal-core" />
            <span className="signal-spark signal-spark-one" />
            <span className="signal-spark signal-spark-two" />
          </div>
          <div className="eyebrow"><span /> YOUR THINKING SPACE</div>
          {!messages.length && <>
            <h1>Good ideas start<br /><em>somewhere.</em></h1>
            <p>Bring a question, a challenge, or an idea.<br className="desktop-break" /> We’ll shape the next step together.</p>
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
                  {item.content ? <div className="assistant-message-content">{renderAssistantContent(item.content)}</div> : busy && item.role === "assistant" ? <div className="thinking-indicator" role="status" aria-label="Aahana is thinking"><span /><span /><span /><small>Aahana is thinking</small></div> : null}
                </article>
              ))}
            </div>
          )}

          {mode === "build" && (
            <div className="message-actions" style={{ justifyContent: "flex-start", gap: "8px", margin: "12px 0" }}>
              <span className="message-role">PROJECT BUILD</span>
              <button className="copy-message" type="button" disabled={!selectedProjectId || !prompt.trim() || buildBusy || busy} onClick={draftProjectChanges}>
                {buildBusy ? "Working…" : "Draft changes"}
              </button>
              <span className="message-role">PROJECT CHECKS</span>
              <button className="copy-message" type="button" disabled={!selectedProjectId || buildBusy || busy} onClick={() => runProjectCheck("build")}>
                {buildBusy ? "Running…" : "Run isolated build"}
              </button>
              <button className="copy-message" type="button" disabled={!selectedProjectId || buildBusy || busy} onClick={() => runProjectCheck("test")}>
                Run isolated tests
              </button>
              <small>{selectedProjectId ? "Uses the latest source files uploaded to this project. No saved files are changed or deployed." : "Select a project and upload its source files to enable checks."}</small>
            </div>
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
              <button className="copy-message" type="button" onClick={startVoiceInput} disabled={listening || busy}>{listening ? "Listening…" : "Speak"}</button>
              {imageFile && <span className="image-attach-name">{imageFile.name} <button type="button" onClick={() => setImageFile(null)}>Remove</button></span>}
              <button className="copy-message" type="button" onClick={generateImage}
                disabled={!prompt.trim() || imageGenerating || busy || Boolean(imageFile)}>
                {imageGenerating ? "Creating image…" : "Generate image"}
              </button>
            </div>
            <label className="sr-only" htmlFor="prompt">What would you like to work on?</label>
            <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
              placeholder={aiEnabled ? (modePlaceholders[mode] || "What would you like to work on today?") : "Try a calculation, e.g. 2 + 2 (offline)"} rows={3} disabled={busy} />
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
                {activeStarters.map((item, index) => (
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
