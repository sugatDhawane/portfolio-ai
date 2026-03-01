"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "What projects has he built?",
  "What are his technical skills?",
  "Tell me about his work experience",
  "Is he available for hire?",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();
      setMessages([...updatedMessages, { role: "assistant", content: data.message }]);
    } catch {
      setMessages([...updatedMessages, {
        role: "assistant",
        content: "Something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const isEmpty = messages.length === 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { emoji: "☀️", line1: "Good morning!", line2: "Fresh start to the day — glad you stopped by." };
    if (hour >= 12 && hour < 14) return { emoji: "🍜", line1: "Midday already?", line2: "Take a breather and feel free to look around." };
    if (hour >= 14 && hour < 17) return { emoji: "⚡", line1: "Afternoon.", line2: "Hope your day's going well. Ask me anything." };
    if (hour >= 17 && hour < 20) return { emoji: "🌇", line1: "Evening!", line2: "Day's winding down — happy to have you here." };
    if (hour >= 20 && hour < 23) return { emoji: "🌙", line1: "Night owl?", line2: "Some of my best work happened late at night too." };
    return { emoji: "🌌", line1: "Still up?", line2: "Quiet hours are the best hours. Look around." };
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Styrene+A:wght@300;400;500&family=Tiempos+Text:ital,wght@0,400;1,400&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          /* Claude-inspired warm dark browns — not black, not navy */
          --bg:            #1a1612;
          --surface:       #211d18;
          --surface-2:     #2a2420;
          --surface-3:     #312b26;
          --border:        #2e2822;
          --border-light:  #3a332c;

          /* Text — warm whites, not cold */
          --text:          #ede8e0;
          --text-muted:    #8a7f74;
          --text-dim:      #4a4238;

          /* Orange accent — warm, rich, not neon */
          --orange:        #e8834a;
          --orange-dark:   #c96b32;
          --orange-deeper: #a85528;
          --orange-glow:   rgba(232, 131, 74, 0.12);
          --orange-pale:   rgba(232, 131, 74, 0.07);
          --orange-border: rgba(232, 131, 74, 0.2);
        }

        html, body {
          background: var(--bg);
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          height: 100%;
          overflow: hidden;
        }

        .layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          height: 100vh;
          max-width: 1120px;
          margin: 0 auto;
        }

        /* ── Sidebar ── */
        .sidebar {
          background: var(--surface);
          border-right: 1px solid var(--border);
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .profile {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .profile-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--orange-dark), #7a3a1a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 600;
          color: #f5e6d8;
          margin-bottom: 14px;
          letter-spacing: 0.02em;
        }

        .profile-name {
          font-family: 'Lora', serif;
          font-size: 20px;
          font-weight: 500;
          color: var(--text);
          letter-spacing: -0.01em;
        }

        .profile-role {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 400;
          margin-top: 1px;
        }

        .availability {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          background: var(--orange-pale);
          border: 1px solid var(--orange-border);
          border-radius: 20px;
          padding: 4px 10px;
          width: fit-content;
        }

        .avail-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--orange);
          animation: warmPulse 2.5s ease-in-out infinite;
          flex-shrink: 0;
        }

        @keyframes warmPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .avail-text {
          font-size: 11px;
          color: var(--orange);
          font-weight: 500;
          white-space: nowrap;
        }

        .divider {
          height: 1px;
          background: var(--border);
        }

        .section-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-dim);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .suggestion-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .suggestion-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px;
          padding: 9px 10px;
          text-align: left;
          cursor: pointer;
          transition: all 0.13s ease;
          border-radius: 8px;
          line-height: 1.45;
          font-weight: 400;
        }

        .suggestion-btn:hover:not(:disabled) {
          background: var(--orange-pale);
          color: var(--orange);
          padding-left: 14px;
        }

        .suggestion-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .sidebar-footer {
          margin-top: auto;
          font-size: 11px;
          color: var(--text-dim);
          line-height: 1.75;
          padding-top: 18px;
          border-top: 1px solid var(--border);
        }

        .sidebar-footer span {
          color: var(--orange-dark);
          font-weight: 500;
        }

        /* ── Main ── */
        .main {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background: var(--bg);
        }

        .chat-header {
          padding: 18px 36px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .header-title {
          font-size: 20px;
          color: var(--text-muted);
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        .header-badge {
          font-size: 11px;
          font-weight: 500;
          color: var(--orange);
          background: var(--orange-pale);
          border: 1px solid var(--orange-border);
          padding: 4px 12px;
          border-radius: 20px;
          letter-spacing: 0.02em;
        }

        /* ── Empty state ── */
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 60px 48px;
          text-align: center;
        }

        .empty-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: var(--surface-2);
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          margin-bottom: 6px;
        }

        .empty-greeting {
          font-family: 'Lora', serif;
          font-style: italic;
          font-size: 15px;
          color: var(--orange);
          letter-spacing: 0.01em;
          animation: fadeUp 0.4s ease;
        }

        .empty-tagline {
          font-size: 13px;
          color: var(--text-dim);
          font-style: italic;
          max-width: 320px;
          line-height: 1.6;
          animation: fadeUp 0.5s ease;
        }

        .empty-title {
          font-family: 'Lora', serif;
          font-size: 26px;
          font-weight: 500;
          color: var(--text);
          letter-spacing: -0.02em;
        }

        .empty-title span {
          color: var(--orange);
        }

        .empty-sub {
          font-size: 13.5px;
          color: var(--text-muted);
          max-width: 340px;
          line-height: 1.75;
        }

        .empty-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          margin-top: 8px;
          max-width: 440px;
        }

        .chip {
          background: var(--surface-2);
          border: 1px solid var(--border-light);
          color: var(--text-muted);
          font-size: 12px;
          padding: 7px 14px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.13s ease;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
        }

        .chip:hover:not(:disabled) {
          border-color: var(--orange-border);
          color: var(--orange);
          background: var(--orange-pale);
        }

        .chip:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Messages ── */
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 32px 36px;
          display: flex;
          flex-direction: column;
          gap: 28px;
          scrollbar-width: thin;
          scrollbar-color: var(--border-light) transparent;
        }

        .messages::-webkit-scrollbar { width: 4px; }
        .messages::-webkit-scrollbar-track { background: transparent; }
        .messages::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 4px; }

        .message-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: fadeUp 0.2s ease;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message-meta {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .message-meta.user { color: var(--orange); }
        .message-meta.assistant { color: var(--text-dim); }

        .message-bubble {
          font-size: 14px;
          line-height: 1.8;
          white-space: pre-wrap;
        }

        .message-bubble.user {
          color: var(--text);
          background: var(--surface-2);
          border: 1px solid var(--border-light);
          padding: 12px 16px;
          border-radius: 10px;
          align-self: flex-start;
          max-width: 88%;
          font-weight: 400;
        }

        .message-bubble.assistant {
          color: #cec5b8;
          font-family: 'Lora', serif;
          font-size: 14.5px;
          padding-left: 16px;
          border-left: 2px solid var(--orange-dark);
          line-height: 1.85;
        }

        /* ── Thinking ── */
        .thinking {
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: fadeUp 0.2s ease;
        }

        .thinking-meta {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--text-dim);
        }

        .thinking-dots {
          display: flex;
          gap: 5px;
          align-items: center;
          padding-left: 18px;
        }

        .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--orange);
          animation: dotBounce 1.3s ease-in-out infinite;
        }

        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }

        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.2; }
          40% { transform: translateY(-6px); opacity: 1; }
        }

        /* ── Input ── */
        .input-area {
          padding: 20px 36px 28px;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }

        .input-row {
          display: flex;
          align-items: center;
          background: var(--surface);
          border: 1px solid var(--border-light);
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .input-row:focus-within {
          border-color: var(--orange-dark);
          box-shadow: 0 0 0 3px var(--orange-glow);
        }

        .input-field {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          padding: 14px 18px;
          font-weight: 400;
        }

        .input-field::placeholder { color: var(--text-dim); }

        .send-btn {
          background: var(--orange-dark);
          border: none;
          color: #f5e6d8;
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px;
          font-weight: 600;
          padding: 10px 20px;
          margin: 6px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.12s ease;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          background: var(--orange);
        }

        .send-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .input-hint {
          margin-top: 8px;
          font-size: 11px;
          color: var(--text-dim);
          padding-left: 2px;
        }

        @media (max-width: 680px) {
          .layout { grid-template-columns: 1fr; }
          .sidebar { display: none; }
          .chat-header, .messages, .input-area { padding-left: 20px; padding-right: 20px; }
        }
      `}</style>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="profile">
            <div className="profile-avatar">SD</div>
            <div className="profile-name">Sugat Dhawane</div>
            <div className="profile-role">Frontend Lead Engineer</div>
            <div className="availability">
              <div className="avail-dot" />
              <span className="avail-text">Open to opportunities</span>
            </div>
          </div>

          <div className="divider" />

          <div>
            <div className="section-label">Try asking</div>
            <div className="suggestion-list">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="suggestion-btn"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-footer">
            Powered by <span>Claude AI</span>.<br />
            Answers based on real portfolio data.<br />
            Nothing is fabricated.
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <header className="chat-header">
            <span className="header-title">Portfolio Assistant</span>
            <div className="header-badge">AI Powered</div>
          </header>

          {isEmpty ? (
            <div className="empty-state">
              <div className="empty-icon">{getGreeting().emoji}</div>
              <div className="empty-greeting">{getGreeting().line1}</div>
              <div className="empty-title">
                I'm <span>Sugat</span>
              </div>
              <div className="empty-tagline">{getGreeting().line2}</div>
              <div className="empty-sub">
                Ask me anything about my work, skills, or experience.
                I answer based on real data — no fluff.
              </div>
              <div className="empty-chips">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    className="chip"
                    onClick={() => sendMessage(q)}
                    disabled={loading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message-row ${msg.role}`}>
                  <div className={`message-meta ${msg.role}`}>
                    {msg.role === "user" ? "You" : "Portfolio"}
                  </div>
                  <div className={`message-bubble ${msg.role}`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="thinking">
                  <div className="thinking-meta">Portfolio</div>
                  <div className="thinking-dots">
                    <div className="dot" />
                    <div className="dot" />
                    <div className="dot" />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          <div className="input-area">
            <div className="input-row">
              <input
                ref={inputRef}
                className="input-field"
                placeholder="Ask me anything about my work..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                disabled={loading}
                autoFocus
              />
              <button
                className="send-btn"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
            <div className="input-hint">Press Enter to send</div>
          </div>
        </main>
      </div>
    </>
  );
}