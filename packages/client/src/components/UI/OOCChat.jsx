import { useState, useRef, useEffect } from 'react';
import useMultiplayerStore from '../../stores/multiplayerStore';
import usePlayerStore from '../../stores/playerStore';

export default function OOCChat({ onSend }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const oocMessages = useMultiplayerStore((s) => s.oocMessages);
  const agentId = usePlayerStore((s) => s.agentId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [oocMessages.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend?.(text);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface)] border-l border-[var(--border)]">
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <h3 className="font-[Montserrat] text-xs font-bold uppercase tracking-widest text-[var(--ember)]">
          OOC Chat
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {oocMessages.map((msg, i) => (
          <div key={i} className={`text-sm ${msg.from === agentId ? 'text-right' : ''}`}>
            <span className="font-[Montserrat] text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {msg.fromName}
            </span>
            <p className="text-[var(--text)] leading-relaxed">{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-2 border-t border-[var(--border)] flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something OOC..."
          className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-bright)] focus:outline-none"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-[var(--surface2)] border border-[var(--border-bright)] rounded-lg text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
