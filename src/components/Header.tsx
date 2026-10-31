import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SortieLogo } from './SortieLogo';
import { AiAssistantModal } from './AiAssistantModal';
import { getStoredTheme, applyTheme, ThemeMode } from '../utils/theme';
import { getUserStats } from '../services/gamification';
import { UserStats } from '../types';
import {
  Sun,
  Moon,
  Monitor,
  Bot,
  Play,
  Flame,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { hasSiteConfigPlaceholders } from '../config/site';

interface HeaderProps {
  isSampleData?: boolean;
  assistantContext?: {
    clustersSummary?: Array<{ label: string; count: number; totalMetric: number }>;
    totalClusters?: number;
    totalItems?: number;
    packType?: string;
  };
}

export function Header({ isSampleData = false, assistantContext }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const showDevWarning = hasSiteConfigPlaceholders();

  const [theme, setTheme] = useState<ThemeMode>('system');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setTheme(getStoredTheme());
    getUserStats().then(setStats);
  }, [location.pathname]);

  const toggleTheme = () => {
    const nextTheme: ThemeMode =
      theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const navLinks = [
    { to: '/', label: 'Dashboard' },
    { to: '/play', label: 'Triage' },
    { to: '/plan', label: 'Plan' },
    { to: '/rules', label: 'Rules' },
    { to: '/history', label: 'History' },
  ];

  return (
    <>
      <header className="w-full border-b border-line bg-surface sticky top-0 z-40">
        {showDevWarning && (
          <div className="bg-paper border-b border-line px-4 py-1.5 text-[11px] text-muted flex items-center justify-center gap-2 font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-accent-orange shrink-0" />
            <span>
              Dev note: Placeholders remaining in src/config/site.ts (YOUR NAME, YOUR EMAIL, YOUR COUNTRY).
            </span>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 font-mono font-bold text-base text-ink tracking-tight hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-[4px] px-1 py-0.5"
            >
              <SortieLogo className="w-5 h-5" />
              <span>SORTIE</span>
            </Link>

            {isSampleData && (
              <span className="hidden sm:inline-flex font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border border-line bg-paper text-muted rounded-[3px] tabular-nums">
                Sample
              </span>
            )}
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-xs font-medium px-3 py-1.5 rounded-[5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                    isActive
                      ? 'bg-paper text-ink font-semibold border border-line shadow-xs'
                      : 'text-muted hover:text-ink hover:bg-paper/50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-2">
            {/* Streak & Level pills if active */}
            {stats && stats.xp > 0 && (
              <div className="hidden lg:flex items-center gap-1.5 font-mono text-[11px] text-muted border border-line px-2 py-0.5 rounded-[4px] bg-paper">
                <Flame className="w-3.5 h-3.5 text-accent-orange" />
                <span className="font-bold text-ink">{stats.currentStreakDays}d</span>
                <span className="text-muted/60">|</span>
                <Award className="w-3.5 h-3.5 text-accent-teal" />
                <span>Lv {stats.level}</span>
              </div>
            )}

            {/* Quick Demo button for judges */}
            <button
              type="button"
              onClick={() => navigate('/play?mode=sample')}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-accent-teal bg-accent-teal/10 hover:bg-accent-teal/20 border border-accent-teal/30 rounded-[4px] transition-colors focus-visible:outline-none"
              title="Launch interactive demo with simulated data"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>2-Min Demo</span>
            </button>

            {/* AI Assistant button */}
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-ink bg-paper hover:bg-surface-raised border border-line rounded-[5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              aria-label="Open AI Assistant"
            >
              <Bot className="w-3.5 h-3.5 text-accent-teal" />
              <span className="hidden sm:inline">AI Assistant</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 text-muted hover:text-ink border border-line bg-paper hover:bg-surface-raised rounded-[5px] transition-colors focus-visible:outline-none"
              title={`Current theme: ${theme}. Click to switch.`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-accent-teal" />
              ) : theme === 'light' ? (
                <Sun className="w-3.5 h-3.5 text-accent-orange" />
              ) : (
                <Monitor className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* AI Assistant Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        context={assistantContext}
      />
    </>
  );
}
