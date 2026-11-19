import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Zap, Trash2, AlertCircle, BarChart2, Database } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { askAssistant, fetchAssistantSuggestions } from '../services/api';

const DISCLAIMER = "PulseNova is an academic healthcare analytics platform. Its statistics and model outputs are exploratory and are not substitutes for professional clinical or hospital management decisions.";

function MiniChart({ chart }) {
  if (!chart || !chart.data?.length) return null;
  const h = 160;
  if (chart.type === 'bar') {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{chart.title}</div>
        <ResponsiveContainer width="100%" height={h}>
          <BarChart data={chart.data} layout={chart.data[0]?.[chart.x]?.length > 8 ? 'vertical' : 'horizontal'} margin={{ top: 2, right: 8, left: chart.data[0]?.[chart.x]?.length > 8 ? 80 : -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            {chart.data[0]?.[chart.x]?.length > 8
              ? <><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey={chart.x} tick={{ fontSize: 9 }} /></>
              : <><XAxis dataKey={chart.x} tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /></>
            }
            <Tooltip />
            <Bar dataKey={chart.y} fill="#14B8A6" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  if (chart.type === 'line') {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{chart.title}</div>
        <ResponsiveContainer width="100%" height={h}>
          <LineChart data={chart.data} margin={{ top: 2, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={chart.x} tick={{ fontSize: 9 }} interval={Math.floor(chart.data.length / 6)} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey={chart.y} stroke="#14B8A6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return null;
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
      <div style={{
        maxWidth: '80%', padding: '12px 16px',
        background: isUser ? 'var(--teal)' : 'var(--surface)',
        color: isUser ? '#fff' : 'var(--text)',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        border: isUser ? 'none' : '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {isUser ? (
          <div style={{ fontSize: 13 }}>{msg.content}</div>
        ) : (
          <>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            {msg.chart && <MiniChart chart={msg.chart} />}
            {msg.sources?.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {msg.sources.map((s, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 8px', background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text-muted)' }}>
                    <Database size={9} /> {s}
                  </span>
                ))}
              </div>
            )}
            {msg.mode && (
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-light)' }}>
                <Zap size={9} style={{ display: 'inline', marginRight: 3 }} />
                {msg.mode === 'deterministic' ? 'Deterministic analytics' : 'LLM-assisted'}
              </div>
            )}
            {msg.limitations && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                ⚠ {msg.limitations}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AIDataAssistant() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Hello! I'm the PulseNova AI Data Assistant. I can answer questions about the healthcare datasets and ML models. Try one of the suggested questions below, or type your own.",
    sources: [],
    mode: 'deterministic',
  }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const suggFn = useCallback(() => fetchAssistantSuggestions(), []);
  const { data: suggData } = useApi(suggFn);
  const suggestions = suggData?.suggestions || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(question) {
    const q = (question || input).trim();
    if (!q || sending) return;
    setInput('');
    setSending(true);
    setMessages(m => [...m, { role: 'user', content: q }]);

    const r = await askAssistant(q);
    if (r.ok) {
      const d = r.data;
      setMessages(m => [...m, {
        role: 'assistant',
        content: d.answer,
        sources: d.sources || [],
        chart: d.chart || null,
        limitations: d.limitations,
        mode: d.mode,
      }]);
    } else {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${r.error}. Please try again.`,
        sources: [],
        mode: 'deterministic',
      }]);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function clearChat() {
    setMessages([{
      role: 'assistant',
      content: "Conversation cleared. Ask me anything about the PulseNova datasets and models.",
      sources: [],
      mode: 'deterministic',
    }]);
  }

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', padding: 0 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>AI Data Assistant</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ask questions about PulseNova datasets and ML models — deterministic analytics, no LLM required</p>
          </div>
          <button className="btn btn-ghost" onClick={clearChat} style={{ height: 32, fontSize: 12 }}>
            <Trash2 size={13} /> Clear
          </button>
        </div>
        <div className="info-box note" style={{ marginBottom: 12 }}>
          <AlertCircle size={13} className="info-box-icon" />
          <div className="info-box-text" style={{ fontSize: 11 }}>{DISCLAIMER}</div>
        </div>
      </div>

      {/* Suggested questions */}
      {suggestions.length > 0 && (
        <div style={{ padding: '0 24px 12px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Suggested questions:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggestions.slice(0, 8).map((s, i) => (
              <button key={i} onClick={() => send(s)} disabled={sending}
                style={{ fontSize: 11, padding: '4px 10px', background: 'var(--teal-light)', border: '1px solid rgba(20,184,166,.3)', borderRadius: 20, color: 'var(--teal-dark)', cursor: 'pointer', fontFamily: 'inherit', transition: 'background var(--transition)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px', minHeight: 0 }}>
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 2px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px 20px', flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question about the data… (Enter to send, Shift+Enter for new line)"
            rows={2}
            style={{
              flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none',
              lineHeight: 1.5, color: 'var(--text)', background: 'var(--bg)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--teal)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button className="btn btn-primary" onClick={() => send()} disabled={sending || !input.trim()}
            style={{ height: 44, padding: '0 18px', flexShrink: 0 }}
            aria-label="Send message">
            <Send size={15} />
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 6 }}>
          Answers come from real dataset computations. No LLM required. Session history is not persisted.
        </div>
      </div>
    </div>
  );
}
