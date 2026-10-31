import { useState, useEffect, useRef } from 'react';
import { askAiAssistant } from '../services/geminiSuggest';
import { Bot, Send, X, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    clustersSummary?: Array<{ label: string; count: number; totalMetric: number }>;
    totalClusters?: number;
    totalItems?: number;
    packType?: string;
  };
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  source?: 'gemini' | 'heuristic';
  timestamp: number;
}

const DEFAULT_PROMPT_CHIPS = [
  'What is taking up the most space?',
  'Which clusters need manual review?',
  'Show possible duplicate files.',
  'Which transactions appear recurring?',
  'How do I create a reusable rule?',
];

export function AiAssistantModal({ isOpen, onClose, context }: AiAssistantModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init_msg',
      sender: 'assistant',
      text: 'Hello. I am Sortie’s AI triage assistant. You can ask me to analyze your current cluster backlog, explain recommendations, or suggest automation rules.',
      source: 'gemini',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await askAiAssistant(textToSend.trim(), context || {});
      const aiMsg: Message = {
        id: `a_${Date.now()}`,
        sender: 'assistant',
        text: result.reply,
        source: result.source,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: `Analysis unavailable: ${err?.message || 'Server did not respond'}.`,
        source: 'heuristic',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-surface border border-line rounded-[8px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-paper/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[5px] bg-accent-teal/15 flex items-center justify-center text-accent-teal border border-accent-teal/30">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Sortie AI Assistant</h2>
              <p className="text-[11px] text-muted font-mono">
                Gemini 3.8 Flash • Contextual backlog analyzer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted hover:text-ink rounded-[4px] hover:bg-paper transition-colors focus-visible:outline-none"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages scroll area */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 min-h-[260px] text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[88%] ${
                msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <div
                className={`p-3 rounded-[6px] leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-ink text-surface font-medium'
                    : 'bg-paper text-ink border border-line'
                }`}
              >
                {msg.text}
              </div>
              {msg.source && msg.sender === 'assistant' && (
                <span className="text-[10px] text-muted font-mono mt-1 flex items-center gap-1">
                  {msg.source === 'gemini' ? (
                    <>
                      <Sparkles className="w-2.5 h-2.5 text-accent-teal" />
                      <span>Gemini analysis</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-2.5 h-2.5 text-accent-orange" />
                      <span>Deterministic heuristic</span>
                    </>
                  )}
                </span>
              )}
            </div>
          ))}
          {loading && (
            <div className="self-start p-3 bg-paper border border-line rounded-[6px] text-xs text-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-teal animate-ping" />
              <span>Analyzing cluster metadata...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Prompt chips */}
        <div className="px-4 py-2 border-t border-line/60 bg-paper/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {DEFAULT_PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSend(chip)}
              disabled={loading}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 bg-surface border border-line text-muted hover:text-ink hover:border-ink rounded-[4px] transition-colors focus-visible:outline-none shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 border-t border-line bg-surface flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about clusters, space, or triage advice..."
            className="flex-1 px-3 py-2 text-xs bg-paper border border-line rounded-[5px] text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-3 py-2 bg-ink text-surface rounded-[5px] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus-visible:outline-none"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}
