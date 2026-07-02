import { useState, useRef, useEffect } from "react";

const N8N_UPLOAD_WEBHOOK = "http://localhost:5678/webhook/ingest";
const N8N_CHAT_WEBHOOK   = "http://localhost:5678/webhook/ask";

export default function RAGChatbot() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Upload a PDF, Word document, or image and then ask me anything about it.", id: Date.now() },
  ]);
  const [input, setInput]           = useState("");
  const [uploading, setUploading]   = useState(false);
  const [thinking, setThinking]     = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success' | 'error' | null
  const fileInputRef = useRef(null);
  const chatEndRef   = useRef(null);
  const textareaRef  = useRef(null);

  /* Inject global reset once so the app truly fills the viewport */
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "rag-global-reset";
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #0F0F13; }
    `;
    if (!document.getElementById("rag-global-reset")) {
      document.head.appendChild(style);
    }
    return () => document.getElementById("rag-global-reset")?.remove();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  /* Auto-resize textarea */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") return;

    setUploadedFile(file);
    setUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", file.name);

    try {
      const res = await fetch(N8N_UPLOAD_WEBHOOK, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUploadStatus("success");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `✅ **${file.name}** has been processed and stored. You can now ask questions about it!`, id: Date.now() },
      ]);
    } catch (err) {
      setUploadStatus("error");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Failed to process **${file.name}**. Make sure n8n is running on localhost:5678. Error: ${err.message}`, id: Date.now() },
      ]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    const query = input.trim();
    if (!query || thinking) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query, id: Date.now() }]);
    setThinking(true);

    try {
      const res = await fetch(N8N_CHAT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatInput: query, sessionId: "ui-session-1" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      let answer = "";
      if (Array.isArray(data) && data[0]?.output)        answer = data[0].output;
      else if (Array.isArray(data) && data[0]?.response) answer = data[0].response;
      else answer = data?.output || data?.response || data?.text || data?.message || (typeof data === "string" ? data : JSON.stringify(data));

      setMessages((prev) => [...prev, { role: "assistant", content: answer, id: Date.now() }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Could not reach n8n. Make sure it's running. Error: ${err.message}`, id: Date.now() },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const renderMessage = (msg) =>
    msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );

  return (
    <div style={s.root}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <LogoIcon />
          <span style={s.logoText}>RAG Chat</span>
        </div>

        <div style={{ flex: 1 }}>
          <p style={s.sideLabel}>KNOWLEDGE BASE</p>
          <label style={s.uploadBtn} htmlFor="pdf-upload">
            {uploading ? <><Spinner size={14} color="#6C63FF" /><span>Processing…</span></> : <><UploadIcon /><span>Upload File</span></>}
          </label>
          <input
            id="pdf-upload"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,image/png,image/jpeg,image/jpg,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={handleFileUpload}
            disabled={uploading}
          />
          {uploadedFile && (
            <div style={{ ...s.fileChip, ...(uploadStatus === "error" ? s.fileChipError : {}) }}>
              <FileTypeIcon name={uploadedFile.name} />
              <span style={s.fileChipName}>{uploadedFile.name}</span>
              {uploadStatus === "success" && <span style={{ color: "#4CAF50", fontWeight: 700 }}>✓</span>}
              {uploadStatus === "error"   && <span style={{ color: "#EF5350", fontWeight: 700 }}>✗</span>}
            </div>
          )}
        </div>

        <div style={s.sideBottom}>
          <div style={s.statusRow}>
            <span style={s.statusDot} />
            <span style={s.statusText}>n8n localhost:5678</span>
          </div>
          <p style={s.hint}>Edit webhook URLs in the source if your n8n runs on a different port.</p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={s.main}>
        <header style={s.header}>
          <h1 style={s.headerTitle}>Ask your documents</h1>
          <p style={s.headerSub}>Powered by your n8n RAG workflow + ChromaDB</p>
        </header>

        <div style={s.messages}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ ...s.msgRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ ...s.bubble, ...(msg.role === "user" ? s.bubbleUser : s.bubbleAssistant) }}>
                {renderMessage(msg)}
              </div>
            </div>
          ))}

          {thinking && (
            <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
              <div style={s.avatar}><LogoIcon size={14} /></div>
              <div style={{ ...s.bubble, ...s.bubbleAssistant, padding: "12px 16px" }}>
                <ThinkingDots />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={s.inputArea}>
          <div style={s.inputRow}>
            <textarea
              ref={textareaRef}
              style={s.textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your file…"
              rows={1}
              disabled={thinking}
            />
            <button
              style={{ ...s.sendBtn, ...(!input.trim() || thinking ? s.sendBtnDisabled : {}) }}
              onClick={handleSend}
              disabled={!input.trim() || thinking}
            >
              <SendIcon />
            </button>
          </div>
          <p style={s.inputHint}>Press Enter to send · Shift+Enter for new line</p>
        </div>
      </main>
    </div>
  );
}

/* ── Icons ── */
function LogoIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill="#6C63FF" />
      <path d="M8 14h12M14 8l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function FileTypeIcon({ name = "" }) {
  const ext = name.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C9FF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    );
  }
  if (["doc", "docx"].includes(ext)) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7CC4F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C49FEE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function Spinner({ size = 16, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
function ThinkingDots() {
  return (
    <span style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#6C63FF", display: "inline-block", animation: `ragBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes ragBounce { 0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1} }`}</style>
    </span>
  );
}

/* ── Styles ── */
const s = {
  root: {
    display: "flex",
    width: "100vw",
    height: "100vh",
    fontFamily: "'Inter', -apple-system, sans-serif",
    background: "#0F0F13",
    color: "#E8E8F0",
    overflow: "hidden",
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: "#17171F",
    borderRight: "1px solid #2A2A38",
    display: "flex",
    flexDirection: "column",
    padding: "20px 14px",
    height: "100%",
  },
  logo:      { display: "flex", alignItems: "center", gap: 10, marginBottom: 28 },
  logoText:  { fontSize: 15, fontWeight: 700, color: "#E8E8F0", letterSpacing: "-0.3px" },
  sideLabel: { fontSize: 10, fontWeight: 600, letterSpacing: ".08em", color: "#555568", marginBottom: 10 },
  uploadBtn: {
    display: "flex", alignItems: "center", gap: 8,
    border: "1.5px dashed #3A3A50", borderRadius: 10,
    padding: "10px 12px", fontSize: 13, color: "#9898B8",
    cursor: "pointer", width: "100%", background: "transparent", marginBottom: 10,
  },
  fileChip:      { display: "flex", alignItems: "center", gap: 6, background: "#1F1F2E", border: "1px solid #2A2A3E", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#A0A0C0" },
  fileChipError: { borderColor: "#5A2A2A", background: "#1E1515" },
  fileChipName:  { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  sideBottom: { marginTop: "auto", paddingTop: 16, borderTop: "1px solid #2A2A38" },
  statusRow:  { display: "flex", alignItems: "center", gap: 7, marginBottom: 6 },
  statusDot:  { width: 7, height: 7, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 5px #4CAF50", flexShrink: 0 },
  statusText: { fontSize: 11, color: "#6A6A88" },
  hint:       { fontSize: 10, color: "#44445A", lineHeight: 1.5, margin: 0 },

  main:        { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" },
  header:      { padding: "20px 36px", borderBottom: "1px solid #1E1E2A", flexShrink: 0 },
  headerTitle: { fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px", color: "#E8E8F0", margin: 0 },
  headerSub:   { fontSize: 12, color: "#555568", margin: "3px 0 0" },

  messages: {
    flex: 1, overflowY: "auto",
    padding: "20px 36px",
    display: "flex", flexDirection: "column", gap: 14,
  },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 10, width: "100%" },
  avatar: { width: 26, height: 26, borderRadius: "50%", background: "#1E1E2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  bubble: { maxWidth: "78%", borderRadius: 16, padding: "13px 18px", fontSize: 14, lineHeight: 1.6, wordBreak: "break-word" },
  bubbleUser:      { background: "#6C63FF", color: "#fff", borderBottomRightRadius: 4 },
  bubbleAssistant: { background: "#1C1C28", color: "#D8D8EE", border: "1px solid #2A2A3A", borderBottomLeftRadius: 4 },

  inputArea: { borderTop: "1px solid #1E1E2A", padding: "14px 36px 0", flexShrink: 0 },
  inputRow:  { display: "flex", gap: 12, alignItems: "flex-end" },
  textarea: {
    flex: 1, background: "#17171F",
    border: "1.5px solid #2A2A3A", borderRadius: 12,
    color: "#E8E8F0", fontSize: 14, padding: "12px 16px",
    resize: "none", outline: "none", fontFamily: "inherit",
    lineHeight: 1.5, maxHeight: 140, overflowY: "hidden",
  },
  fileTypeHints: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  fileTypePill:  { fontSize: 10, fontWeight: 600, letterSpacing: ".04em", color: "#6A6A88", background: "#1F1F2E", border: "1px solid #2A2A3E", borderRadius: 5, padding: "2px 7px" },
  sendBtn:         { width: 44, height: 44, borderRadius: 10, background: "#6C63FF", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 },
  sendBtnDisabled: { background: "#2A2A3A", color: "#555568", cursor: "not-allowed" },
  inputHint:       { fontSize: 11, color: "#38384E", textAlign: "center", padding: "6px 0 12px" },
};