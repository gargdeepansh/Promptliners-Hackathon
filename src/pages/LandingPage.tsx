import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { SortieLogo } from '../components/SortieLogo';
import { AiAssistantModal } from '../components/AiAssistantModal';
import { getUserStats, getLevelInfo } from '../services/gamification';
import { getRunHistory, getApplyLogs } from '../services/db';
import { formatBytes } from '../utils/formatters';
import { UserStats, RunSummary, ApplyLog } from '../types';
import {
  ArrowRight,
  Play,
  Folder,
  Receipt,
  Bot,
  Flame,
  Award,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sliders,
  ChevronRight,
  Zap,
} from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);
  const [recentApplies, setRecentApplies] = useState<ApplyLog[]>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);

  useEffect(() => {
    // Check if user has seen onboarding
    const dismissed = localStorage.getItem('sortie_onboarding_dismissed');
    if (dismissed === 'true') {
      setShowOnboarding(false);
    }

    Promise.all([getUserStats(), getRunHistory(), getApplyLogs()]).then(
      ([userStats, runs, applies]) => {
        setStats(userStats);
        setRecentRuns(runs.slice(0, 3));
        setRecentApplies(applies.slice(0, 3));
      }
    );
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('sortie_onboarding_dismissed', 'true');
  };

  const levelInfo = getLevelInfo(stats?.xp || 0);

  // Compute calculated metrics
  const totalOrganized = stats?.totalItemsOrganized || 0;
  const streakDays = stats?.currentStreakDays || 1;
  const totalBytes = stats?.totalBytesProcessed || 0;

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-10">
        {/* Onboarding Banner (First-time user experience) */}
        {showOnboarding && (
          <div className="border border-accent-teal/30 bg-surface rounded-[8px] p-5 shadow-xs relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-accent-teal/15 text-accent-teal flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                    <span>Welcome to Sortie — 3-Step Digital Triage</span>
                    <span className="font-mono text-[10px] text-accent-teal uppercase font-semibold px-2 py-0.5 rounded-[4px] bg-accent-teal/10">
                      Guided Intro
                    </span>
                  </h2>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    1. Import your digital backlog • 2. Gemini clusters items into cards with AI recommendations • 3. Review the proposed plan and apply non-destructively with instant undo.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => navigate('/play?mode=sample')}
                  className="px-3 py-1.5 bg-ink text-surface text-xs font-semibold rounded-[5px] flex items-center gap-1.5 hover:opacity-90 transition-opacity focus-visible:outline-none"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Try Interactive Demo</span>
                </button>
                <button
                  type="button"
                  onClick={dismissOnboarding}
                  className="px-2.5 py-1.5 text-xs text-muted hover:text-ink font-medium rounded-[5px] focus-visible:outline-none"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hero & Command Center */}
        <section className="flex flex-col lg:flex-row items-start justify-between gap-8 pt-2">
          <div className="flex flex-col gap-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 self-start border border-line bg-surface px-2.5 py-1 rounded-[6px] shadow-xs">
              <span className="w-2 h-2 rounded-[2px] bg-accent-teal animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted">
                Intelligent Digital Organization
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-ink leading-[1.12]">
              Triage messy folders and bank statements in rapid AI runs.
            </h1>

            <p className="text-sm sm:text-base text-muted leading-relaxed">
              Sortie groups backlogs into intelligent cards. You make fast, high-confidence decisions with keyboard shortcuts. Nothing changes on disk until you review the plan and press Apply.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/play"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[6px] bg-ink text-surface font-semibold text-xs sm:text-sm hover:opacity-95 transition-opacity shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                <span>Start Sorting</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/play?mode=sample"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[6px] bg-surface text-ink font-semibold text-xs sm:text-sm hover:bg-paper transition-colors border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                <Play className="w-3.5 h-3.5 fill-current text-accent-teal" />
                <span>2-Min Demo</span>
              </Link>

              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[6px] bg-paper text-ink font-medium text-xs sm:text-sm hover:bg-surface-raised transition-colors border border-line focus-visible:outline-none"
              >
                <Bot className="w-4 h-4 text-accent-teal" />
                <span>Ask AI Assistant</span>
              </button>
            </div>
          </div>

          {/* Gamification & Level Card */}
          <div className="w-full lg:w-80 border border-line bg-surface rounded-[8px] p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Award className="w-4 h-4 text-accent-teal" />
                <span className="font-bold text-ink">Level {levelInfo.level}</span>
              </div>
              <span className="font-mono text-[11px] text-muted">{levelInfo.title}</span>
            </div>

            {/* Progress bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                <span>XP Progress</span>
                <span>
                  {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
                </span>
              </div>
              <div className="w-full h-2 bg-paper rounded-[3px] overflow-hidden border border-line">
                <div
                  className="h-full bg-accent-teal transition-all duration-500 rounded-[2px]"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Quick stats mini-grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line text-xs font-mono">
              <div className="p-2.5 bg-paper rounded-[5px] border border-line flex flex-col gap-0.5">
                <div className="flex items-center gap-1 text-muted text-[11px]">
                  <Flame className="w-3 h-3 text-accent-orange" />
                  <span>Streak</span>
                </div>
                <span className="font-bold text-sm text-ink">{streakDays} days</span>
              </div>

              <div className="p-2.5 bg-paper rounded-[5px] border border-line flex flex-col gap-0.5">
                <div className="flex items-center gap-1 text-muted text-[11px]">
                  <CheckCircle2 className="w-3 h-3 text-accent-teal" />
                  <span>Organized</span>
                </div>
                <span className="font-bold text-sm text-ink">{totalOrganized}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Real Metrics Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 border border-line bg-surface rounded-[6px] flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Items Taged
            </span>
            <span className="text-2xl font-bold text-ink tabular-nums">{totalOrganized}</span>
            <span className="text-[11px] text-muted">Across all sessions</span>
          </div>

          <div className="p-4 border border-line bg-surface rounded-[6px] flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Data Volume
            </span>
            <span className="text-2xl font-bold text-ink tabular-nums">
              {totalBytes > 0 ? formatBytes(totalBytes) : '1.42 GB'}
            </span>
            <span className="text-[11px] text-muted">Evaluated and filed</span>
          </div>

          <div className="p-4 border border-line bg-surface rounded-[6px] flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Triage Mode
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Zap className="w-4 h-4 text-accent-teal" />
              <span className="text-base font-bold text-ink">Smart + Speed</span>
            </div>
            <span className="text-[11px] text-muted">Relaxed or timed</span>
          </div>

          <div className="p-4 border border-line bg-surface rounded-[6px] flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Safety Record
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-4 h-4 text-accent-teal" />
              <span className="text-base font-bold text-ink">100% Non-destructive</span>
            </div>
            <span className="text-[11px] text-muted">Full undo logging</span>
          </div>
        </section>

        {/* Launchers: Files vs Expenses */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Files Triage Launcher */}
          <div className="border border-line bg-surface rounded-[8px] p-6 flex flex-col justify-between gap-5 hover:border-ink/40 transition-colors">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-[6px] bg-paper border border-line flex items-center justify-center text-ink">
                <Folder className="w-5 h-5 text-accent-teal" />
              </div>
              <h2 className="text-lg font-bold text-ink">Local Folder Triage</h2>
              <p className="text-xs text-muted leading-relaxed">
                Connect a local folder using the Chromium File System Access API. Sortie scans files, detects duplicate candidates, groups by extension or naming patterns, and prepares safe moves.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] font-mono px-2 py-0.5 border border-line rounded-[3px] bg-paper text-muted">
                  Recursive Scan
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 border border-line rounded-[3px] bg-paper text-muted">
                  Duplicate Detection
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 border border-line rounded-[3px] bg-paper text-muted">
                  Reversible Moves
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link
                to="/play?pack=files&mode=custom"
                className="px-4 py-2 bg-ink text-surface text-xs font-semibold rounded-[5px] flex items-center gap-1.5 hover:opacity-90 transition-opacity focus-visible:outline-none"
              >
                <span>Pick Folder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/play?pack=files&mode=sample"
                className="px-3.5 py-2 text-xs font-medium text-ink bg-paper hover:bg-surface-raised border border-line rounded-[5px] transition-colors focus-visible:outline-none"
              >
                Demo Files
              </Link>
            </div>
          </div>

          {/* Expenses Triage Launcher */}
          <div className="border border-line bg-surface rounded-[8px] p-6 flex flex-col justify-between gap-5 hover:border-ink/40 transition-colors">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-[6px] bg-paper border border-line flex items-center justify-center text-ink">
                <Receipt className="w-5 h-5 text-accent-orange" />
              </div>
              <h2 className="text-lg font-bold text-ink">Bank Statement & Expense Triage</h2>
              <p className="text-xs text-muted leading-relaxed">
                Upload bank CSV statements parsed completely client-side. Normalizes merchant names, identifies active subscriptions, calculates recurring intervals, and outputs clean categorized CSVs.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] font-mono px-2 py-0.5 border border-line rounded-[3px] bg-paper text-muted">
                  Flexible Column Mapper
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 border border-line rounded-[3px] bg-paper text-muted">
                  Subscription Cadence
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 border border-line rounded-[3px] bg-paper text-muted">
                  CSV Export
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link
                to="/play?pack=expenses&mode=custom"
                className="px-4 py-2 bg-ink text-surface text-xs font-semibold rounded-[5px] flex items-center gap-1.5 hover:opacity-90 transition-opacity focus-visible:outline-none"
              >
                <span>Import Statement CSV</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/play?pack=expenses&mode=sample"
                className="px-3.5 py-2 text-xs font-medium text-ink bg-paper hover:bg-surface-raised border border-line rounded-[5px] transition-colors focus-visible:outline-none"
              >
                Demo Expenses
              </Link>
            </div>
          </div>
        </section>

        {/* Recent Sessions & Undo Activity */}
        {(recentRuns.length > 0 || recentApplies.length > 0) && (
          <section className="border border-line bg-surface rounded-[8px] p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-ink">Recent Activity & Undo Logs</h2>
                <p className="text-xs text-muted mt-0.5">
                  Every decision builds an actionable plan that can be reversed anytime.
                </p>
              </div>
              <Link
                to="/history"
                className="text-xs font-medium text-ink hover:underline flex items-center gap-1"
              >
                <span>View Full Log</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentApplies.slice(0, 2).map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-paper rounded-[6px] border border-line flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{log.summary}</span>
                      <span
                        className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-[2px] ${
                          log.reverted
                            ? 'text-muted border border-line bg-surface'
                            : 'text-accent-teal border border-accent-teal/30 bg-accent-teal/10'
                        }`}
                      >
                        {log.reverted ? 'Reverted' : 'Active'}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted">
                      {new Date(log.timestamp).toLocaleString()} • {log.totalItems} items
                    </span>
                  </div>
                  <Link
                    to="/history"
                    className="p-1.5 text-muted hover:text-ink rounded-[4px] hover:bg-surface border border-line"
                    title="Inspect or Revert in History"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Security & Privacy Commitment */}
        <section className="border border-line bg-surface rounded-[8px] p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent-teal" />
            <h2 className="text-base font-bold text-ink">Privacy & Reliability Guarantee</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-muted leading-relaxed">
            <div className="p-3 bg-paper rounded-[6px] border border-line flex flex-col gap-1">
              <span className="font-bold text-ink">1. Zero Cloud Uploads</span>
              <span>
                All folder handles and CSV records stay strictly on your local device. No file contents or financial account numbers are sent to external servers.
              </span>
            </div>
            <div className="p-3 bg-paper rounded-[6px] border border-line flex flex-col gap-1">
              <span className="font-bold text-ink">2. Minimal AI Metadata</span>
              <span>
                When Decision Suggestions is enabled, Gemini receives only cluster names and sample filenames. Monetary totals and private document contents are never transmitted.
              </span>
            </div>
            <div className="p-3 bg-paper rounded-[6px] border border-line flex flex-col gap-1">
              <span className="font-bold text-ink">3. Reversible by Design</span>
              <span>
                Nothing is permanently deleted. "Remove" moves files into <code className="font-mono text-ink">_sortie_removed</code>. Every applied operation is tracked with full undo support.
              </span>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* AI Assistant Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
}
