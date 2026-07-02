import { useState, useRef, useEffect } from "react";

const N8N_UPLOAD_WEBHOOK = "http://localhost:5678/webhook-test/ingest"; // PDF upload + chunking
const N8N_CHAT_WEBHOOK = "http://localhost:5678/webhook-test/ask";    // AI Agent query

export default function RAGChatbot() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! Upload a PDF and then ask me anything about it.",
      id: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success' | 'error' | null
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

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
      const res = await fetch(N8N_UPLOAD_WEBHOOK, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setUploadStatus("success");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ **${file.name}** has been processed and stored. You can now ask questions about it!`,
          id: Date.now(),
        },
      ]);
    } catch (err) {
      setUploadStatus("error");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Failed to process **${file.name}**. Make sure n8n is running on localhost:5678. Error: ${err.message}`,
          id: Date.now(),
        },
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
    setMessages((prev) => [
      ...prev,
      { role: "user", content: query, id: Date.now() },
    ]);
    setThinking(true);

    try {
      const res = await fetch(N8N_CHAT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatInput: query, sessionId: "ui-session-1" }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // n8n AI Agent typically returns { output: "..." } or { response: "..." }
      const answer =
        data?.output ||
        data?.response ||
        data?.text ||
        data?.message ||
        (typeof data === "string" ? data : JSON.stringify(data));

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, id: Date.now() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Could not reach n8n. Make sure it's running. Error: ${err.message}`,
          id: Date.now(),
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (msg) => {
    // Simple bold markdown rendering
    const parts = msg.content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="14" fill="#6C63FF" />
            <path d="M8 14h12M14 8l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={styles.logoText}>RAG Chat</span>
        </div>

        <div style={styles.sideSection}>
          <p style={styles.sideLabel}>KNOWLEDGE BASE</p>

          <label style={styles.uploadBtn} htmlFor="pdf-upload">
            {uploading ? (
              <>
                <Spinner size={14} color="#6C63FF" />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <UploadIcon />
                <span>Upload PDF</span>
              </>
            )}
          </label>
          <input
            id="pdf-upload"
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={handleFileUpload}
            disabled={uploading}
          />

          {uploadedFile && (
            <div style={{ ...styles.fileChip, ...(uploadStatus === "error" ? styles.fileChipError : {}) }}>
              <FileIcon />
              <span style={styles.fileChipName}>{uploadedFile.name}</span>
              {uploadStatus === "success" && <span style={styles.checkmark}>✓</span>}
              {uploadStatus === "error" && <span style={styles.errorMark}>✗</span>}
            </div>
          )}
        </div>

        <div style={styles.sideBottom}>
          <div style={styles.statusDot}>
            <span style={styles.dot} />
            <span style={styles.statusText}>n8n localhost:5678</span>
          </div>
          <p style={styles.hint}>Edit webhook URLs in the source if your n8n runs on a different port.</p>
        </div>
      </aside>

      {/* Chat area */}
      <main style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>Ask your documents</h1>
          <p style={styles.headerSub}>Powered by your n8n RAG workflow + ChromaDB</p>
        </header>

        <div style={styles.messages}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.msgRow,
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {msg.role === "assistant" && (
                <div style={styles.avatar}>
                  <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="14" r="14" fill="#6C63FF" />
                    <path d="M8 14h12M14 8l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <div
                style={{
                  ...styles.bubble,
                  ...(msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant),
                }}
              >
                {renderMessage(msg)}
              </div>
            </div>
          ))}

          {thinking && (
            <div style={{ ...styles.msgRow, justifyContent: "flex-start" }}>
              <div style={styles.avatar}>
                <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="14" fill="#6C63FF" />
                  <path d="M8 14h12M14 8l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ ...styles.bubble, ...styles.bubbleAssistant, ...styles.thinkingBubble }}>
                <ThinkingDots />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={styles.inputRow}>
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your PDF…"
            rows={1}
            disabled={thinking}
          />
          <button
            style={{
              ...styles.sendBtn,
              ...((!input.trim() || thinking) ? styles.sendBtnDisabled : {}),
            }}
            onClick={handleSend}
            disabled={!input.trim() || thinking}
          >
            <SendIcon />
          </button>
        </div>
        <p style={styles.inputHint}>Press Enter to send · Shift+Enter for new line</p>
      </main>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
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
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#6C63FF",
            display: "inline-block",
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  root: {
    display: "flex",
    height: "100vh",
    fontFamily: "'Inter', -apple-system, sans-serif",
    background: "#0F0F13",
    color: "#E8E8F0",
    overflow: "hidden",
  },
  sidebar: {
    width: 240,
    background: "#17171F",
    borderRight: "1px solid #2A2A38",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
    gap: 0,
    flexShrink: 0,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "-0.3px",
    color: "#E8E8F0",
  },
  sideSection: {
    flex: 1,
  },
  sideLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    color: "#555568",
    marginBottom: 10,
    marginTop: 0,
  },
  uploadBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "1.5px dashed #3A3A50",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    color: "#9898B8",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.2s, color 0.2s",
    marginBottom: 12,
  },
  fileChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#1F1F2E",
    border: "1px solid #2A2A3E",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
    color: "#A0A0C0",
  },
  fileChipError: {
    borderColor: "#5A2A2A",
    background: "#1E1515",
  },
  fileChipName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 130,
  },
  checkmark: { color: "#4CAF50", fontWeight: 700 },
  errorMark: { color: "#EF5350", fontWeight: 700 },
  sideBottom: {
    marginTop: "auto",
    paddingTop: 20,
    borderTop: "1px solid #2A2A38",
  },
  statusDot: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#4CAF50",
    flexShrink: 0,
    boxShadow: "0 0 6px #4CAF50",
  },
  statusText: { fontSize: 11, color: "#6A6A88" },
  hint: {
    fontSize: 10,
    color: "#44445A",
    lineHeight: 1.5,
    margin: 0,
  },

  // Main chat
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: "20px 28px 16px",
    borderBottom: "1px solid #1E1E2A",
  },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.4px",
    color: "#E8E8F0",
  },
  headerSub: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#555568",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  msgRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#1E1E2E",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "70%",
    borderRadius: 16,
    padding: "12px 16px",
    fontSize: 14,
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  bubbleUser: {
    background: "#6C63FF",
    color: "#fff",
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    background: "#1C1C28",
    color: "#D8D8EE",
    border: "1px solid #2A2A3A",
    borderBottomLeftRadius: 4,
  },
  thinkingBubble: {
    padding: "12px 16px",
  },
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    padding: "12px 28px 8px",
    borderTop: "1px solid #1E1E2A",
    background: "#0F0F13",
  },
  textarea: {
    flex: 1,
    background: "#17171F",
    border: "1.5px solid #2A2A3A",
    borderRadius: 12,
    color: "#E8E8F0",
    fontSize: 14,
    padding: "12px 16px",
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
    maxHeight: 140,
    overflowY: "auto",
    transition: "border-color 0.2s",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#6C63FF",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    flexShrink: 0,
    transition: "background 0.2s, opacity 0.2s",
  },
  sendBtnDisabled: {
    background: "#2A2A3A",
    color: "#555568",
    cursor: "not-allowed",
  },
  inputHint: {
    margin: 0,
    padding: "0 28px 12px",
    fontSize: 11,
    color: "#38384E",
    textAlign: "center",
  },
};