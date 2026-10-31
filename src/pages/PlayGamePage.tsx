import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  FileItem,
  ExpenseItem,
  ItemCluster,
  DecisionAction,
  DecisionRecord,
  PlanItem,
  RunSummary,
  LocalRule,
  GameMode,
  AiStructuredSuggestion,
} from '../types';
import { SAMPLE_FILES } from '../data/sampleFiles';
import {
  SAMPLE_EXPENSES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_FILE_DESTINATIONS,
} from '../data/sampleExpenses';
import {
  clusterFiles,
  clusterExpenses,
  matchRule,
} from '../utils/clustering';
import {
  calculateDecisionScore,
  getNextCombo,
  getCurrentComboMultiplier,
  SCORE_FORMULA_TEXT,
  UNDO_TIME_PENALTY_SECONDS,
} from '../utils/scoring';
import {
  formatBytes,
  formatCurrency,
  formatDateRange,
  formatDuration,
  CurrencyCode,
} from '../utils/formatters';
import { getBatchClusterSuggestions } from '../services/geminiSuggest';
import { recordRunCompletion, recordRuleCreated } from '../services/gamification';
import { getRules, saveRule, saveCurrentPlan, saveRunSummary } from '../services/db';
import { SortieLogo } from '../components/SortieLogo';
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Repeat,
  Check,
  Bot,
  Sparkles,
  AlertCircle,
  ShieldAlert,
  Pause,
  Play,
  HelpCircle,
  Copy,
  Folder,
  Receipt,
  X,
  Keyboard,
  ThumbsDown,
} from 'lucide-react';

interface PlayGamePageProps {
  packType: 'file' | 'expense';
}

export function PlayGamePage({ packType }: PlayGamePageProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state || {};
  const isSampleData = state.isSampleData !== false;
  const gameMode: GameMode = state.mode || 'smart_cleanup';
  const initialDuration = state.durationSeconds || 60;
  const aiEnabled = state.aiSuggestionsEnabled || false;
  const currency: CurrencyCode = state.currency || 'USD';

  // Active playable clusters (unresolved by rules)
  const [clusters, setClusters] = useState<ItemCluster[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [rules, setRules] = useState<LocalRule[]>([]);
  const [ruleResolvedCount, setRuleResolvedCount] = useState<number>(0);

  // Timer & Scoring
  const [timeLeft, setTimeLeft] = useState<number>(initialDuration);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(1);
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Sorting modal/picker mode
  const [isSelectingDestination, setIsSelectingDestination] = useState<boolean>(false);
  const [showShortcutGuide, setShowShortcutGuide] = useState<boolean>(false);
  const [showWhyReasoning, setShowWhyReasoning] = useState<boolean>(false);

  // Card transition direction for animation
  const [cardTransition, setCardTransition] = useState<string>('translate-x-0 opacity-100');

  // Rule offer banner after remove or sort
  const [pendingRuleOffer, setPendingRuleOffer] = useState<{
    pattern: string;
    action: 'remove' | 'sort';
    destination?: string;
    matchType: 'extension' | 'name_prefix' | 'merchant_exact' | 'merchant_contains';
  } | null>(null);
  const [ruleSavedToast, setRuleSavedToast] = useState<string | null>(null);

  // Batch AI Suggestions cached by cluster id
  const [suggestionsMap, setSuggestionsMap] = useState<Record<string, AiStructuredSuggestion>>({});
  const [aiSource, setAiSource] = useState<'gemini' | 'heuristic'>('gemini');

  // Real-time touch coordinates
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Track initial total items in backlog
  const [totalBacklogItemsCount, setTotalBacklogItemsCount] = useState<number>(0);

  // REFS to guarantee endgame reads live values without stale closures
  const decisionsRef = useRef<DecisionRecord[]>([]);
  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(1);
  const timeLeftRef = useRef<number>(initialDuration);
  const hasEndedRef = useRef<boolean>(false);
  const totalBacklogCountRef = useRef<number>(0);

  // Destinations list based on pack
  const destinations =
    packType === 'file' ? DEFAULT_FILE_DESTINATIONS : DEFAULT_EXPENSE_CATEGORIES;

  // Sync refs with state
  useEffect(() => {
    decisionsRef.current = decisions;
  }, [decisions]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // End game function - executed only once
  const endGame = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    setIsGameOver(true);

    const finalDecisions = decisionsRef.current;
    const finalScore = scoreRef.current;
    const finalTimeLeft = timeLeftRef.current;
    const finalBacklogTotal = totalBacklogCountRef.current;

    // Convert all decisions into Plan items
    const planItems: PlanItem[] = finalDecisions
      .filter((d) => d.action !== 'skip')
      .map((d) => ({
        id: `plan_${d.clusterId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clusterId: d.clusterId,
        packType: d.packType,
        clusterLabel: d.clusterLabel,
        action: d.action as 'keep' | 'remove' | 'sort',
        destination: d.destination,
        itemsCount: d.itemsCount,
        metricTotal: d.clusterMetric,
        items: d.items,
        selected: d.action !== 'keep', // Keep items are not selected for move/exclusion
        source: d.source || 'user',
        isIncomeAndRefunds: d.clusterKey === '__income_and_refunds__',
        isDuplicateCluster: d.clusterKey === 'pattern_duplicates',
      }));

    const elapsed =
      gameMode === 'speed_challenge'
        ? Math.max(1, initialDuration - finalTimeLeft)
        : Math.round((Date.now() - cardStartTime) / 1000);

    const resolvedCount = finalDecisions
      .filter((d) => d.action !== 'skip')
      .reduce((sum, d) => sum + d.itemsCount, 0);

    const summary: RunSummary = {
      id: `run_${Date.now()}`,
      packType,
      mode: gameMode,
      isSampleData,
      durationSeconds: gameMode === 'speed_challenge' ? initialDuration : elapsed,
      elapsedSeconds: elapsed,
      score: finalScore,
      decisionsCount: finalDecisions.length,
      itemsResolved: resolvedCount,
      totalBacklogItems: finalBacklogTotal,
      decisions: finalDecisions,
      timestamp: Date.now(),
    };

    let saveFailed = false;
    try {
      await saveCurrentPlan(planItems);
      await saveRunSummary(summary);
      await recordRunCompletion(summary);
    } catch {
      saveFailed = true;
    } finally {
      navigate('/plan', {
        state: {
          runSummary: summary,
          currency,
          saveFailed,
        },
      });
    }
  }, [initialDuration, packType, isSampleData, gameMode, navigate, currency, cardStartTime]);

  // Watch for timer reaching zero (Speed Challenge Mode only)
  useEffect(() => {
    if (gameMode === 'speed_challenge' && timeLeft <= 0 && !hasEndedRef.current) {
      endGame();
    }
  }, [timeLeft, endGame, gameMode]);

  // Initialize data and apply rules on mount
  useEffect(() => {
    let rawClusters: ItemCluster[] = [];
    let totalItems = 0;

    if (packType === 'file') {
      const files: FileItem[] =
        !isSampleData && state.customFiles?.length ? state.customFiles : SAMPLE_FILES;
      rawClusters = clusterFiles(files);
      totalItems = files.length;
    } else {
      const expenses: ExpenseItem[] =
        !isSampleData && state.customExpenses?.length ? state.customExpenses : SAMPLE_EXPENSES;
      rawClusters = clusterExpenses(expenses, currency);
      totalItems = expenses.length;
    }

    setTotalBacklogItemsCount(totalItems);
    totalBacklogCountRef.current = totalItems;

    // Load active rules and auto-apply matching clusters
    getRules().then((loadedRules) => {
      setRules(loadedRules);

      const initialRuleDecisions: DecisionRecord[] = [];
      const playable: ItemCluster[] = [];
      let ruleClusterMatches = 0;

      for (const cluster of rawClusters) {
        const matched = matchRule(cluster, loadedRules);
        if (matched) {
          ruleClusterMatches++;
          initialRuleDecisions.push({
            clusterId: cluster.id,
            clusterKey: cluster.key,
            packType,
            action: matched.action,
            destination: matched.destination,
            timestamp: Date.now(),
            durationMs: 0,
            pointsAwarded: 0,
            comboAtDecision: 1,
            itemsCount: cluster.count,
            clusterLabel: cluster.label,
            clusterMetric: cluster.totalMetric,
            items: cluster.rawItems,
            source: 'rule',
          });
        } else {
          playable.push(cluster);
        }
      }

      setRuleResolvedCount(ruleClusterMatches);
      setDecisions(initialRuleDecisions);
      decisionsRef.current = initialRuleDecisions;

      if (playable.length === 0 && rawClusters.length > 0) {
        setClusters([]);
        setTimeout(() => {
          endGame();
        }, 100);
      } else {
        setClusters(playable);
        setCardStartTime(Date.now());

        // Batch suggestions request at run start
        if (playable.length > 0) {
          getBatchClusterSuggestions(playable, aiEnabled).then((res) => {
            setSuggestionsMap(res.suggestions);
            setAiSource(res.source);
          });
        }
      }
    });
  }, [packType, isSampleData, state.customFiles, state.customExpenses, endGame, currency, aiEnabled]);

  // Main countdown timer tick (Speed Challenge Mode only)
  useEffect(() => {
    if (isGameOver || isPaused || gameMode !== 'speed_challenge') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          timeLeftRef.current = 0;
          return 0;
        }
        const next = prev - 1;
        timeLeftRef.current = next;
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isGameOver, isPaused, gameMode]);

  // Execute a decision on the current card
  const makeDecision = useCallback(
    (action: DecisionAction, destination?: string) => {
      if (currentIndex >= clusters.length || isGameOver || hasEndedRef.current || isPaused) return;

      const cluster = clusters[currentIndex];
      const now = Date.now();
      const durationMs = now - cardStartTime;

      const currentMultiplier = getCurrentComboMultiplier(comboRef.current);
      let awardedPoints = 0;

      if (action !== 'skip') {
        awardedPoints = calculateDecisionScore(cluster.count, currentMultiplier, action);
        const newScore = scoreRef.current + awardedPoints;
        setScore(newScore);
        scoreRef.current = newScore;
      }

      // Calculate next combo (rises within 2000ms in speed mode)
      const nextComboVal = getNextCombo(comboRef.current, durationMs, action);
      setCombo(nextComboVal);
      comboRef.current = nextComboVal;

      // Check if user followed AI recommendation
      const currentSug = suggestionsMap[cluster.id];
      const wasAiAccepted = currentSug ? currentSug.action === action : undefined;

      // Record decision
      const record: DecisionRecord = {
        clusterId: cluster.id,
        clusterKey: cluster.key,
        packType,
        action,
        destination,
        timestamp: now,
        durationMs,
        pointsAwarded: awardedPoints,
        comboAtDecision: currentMultiplier,
        itemsCount: cluster.count,
        clusterLabel: cluster.label,
        clusterMetric: cluster.totalMetric,
        items: cluster.rawItems,
        source: 'user',
        wasAiAccepted,
      };

      // If user chose skip in Smart Cleanup Mode, move the card to the end of the queue so they can revisit it!
      let nextClusters = [...clusters];
      if (action === 'skip' && gameMode === 'smart_cleanup') {
        const skippedCard = nextClusters.splice(currentIndex, 1)[0];
        nextClusters.push(skippedCard);
        setClusters(nextClusters);
      } else {
        const nextDecisions = [...decisionsRef.current, record];
        setDecisions(nextDecisions);
        decisionsRef.current = nextDecisions;
      }

      // Offer "Always do this for this pattern" for Remove or Sort
      if (action === 'remove' || action === 'sort') {
        const matchType =
          packType === 'file'
            ? cluster.pattern.startsWith('*')
              ? 'extension'
              : 'name_prefix'
            : 'merchant_exact';

        setPendingRuleOffer({
          pattern: cluster.pattern,
          action,
          destination,
          matchType,
        });
      }

      // Card exit animation
      let exitClass = 'opacity-0 scale-95';
      if (action === 'keep') exitClass = 'translate-x-12 opacity-0';
      if (action === 'remove') exitClass = '-translate-x-12 opacity-0';
      if (action === 'sort') exitClass = '-translate-y-12 opacity-0';
      if (action === 'skip') exitClass = 'translate-y-12 opacity-0';

      setCardTransition(exitClass);

      setTimeout(() => {
        setIsSelectingDestination(false);
        setShowWhyReasoning(false);

        // Check if finished
        if (action === 'skip' && gameMode === 'smart_cleanup') {
          // Re-stay at currentIndex which now points to the next card in line
          setCardStartTime(Date.now());
          setCardTransition('translate-x-0 opacity-100');
        } else if (currentIndex + 1 >= clusters.length) {
          endGame();
        } else {
          setCurrentIndex((prev) => prev + 1);
          setCardStartTime(Date.now());
          setCardTransition('translate-x-0 opacity-100');
        }
      }, 120);
    },
    [
      currentIndex,
      clusters,
      isGameOver,
      hasEndedRef,
      isPaused,
      cardStartTime,
      suggestionsMap,
      packType,
      gameMode,
      endGame,
    ]
  );

  // Undo last decision
  const handleUndo = useCallback(() => {
    if (
      decisionsRef.current.length === 0 ||
      currentIndex === 0 ||
      isGameOver ||
      hasEndedRef.current
    ) {
      return;
    }

    // Apply 3 second penalty in Speed Challenge Mode
    if (gameMode === 'speed_challenge') {
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - UNDO_TIME_PENALTY_SECONDS);
        timeLeftRef.current = next;
        return next;
      });
    }

    const currentList = decisionsRef.current;
    const lastDecision = currentList[currentList.length - 1];

    if (lastDecision.source === 'rule') return;

    const newScore = Math.max(0, scoreRef.current - lastDecision.pointsAwarded);
    setScore(newScore);
    scoreRef.current = newScore;

    const updatedDecisions = currentList.slice(0, -1);
    setDecisions(updatedDecisions);
    decisionsRef.current = updatedDecisions;

    setCombo(1);
    comboRef.current = 1;

    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setCardStartTime(Date.now());
    setIsSelectingDestination(false);
    setShowWhyReasoning(false);
    setCardTransition('translate-x-0 opacity-100');
  }, [currentIndex, isGameOver, gameMode]);

  // Save the offered rule locally
  const handleSaveRule = async () => {
    if (!pendingRuleOffer) return;

    const newRule: LocalRule = {
      id: `rule_${Date.now()}`,
      packType,
      pattern: pendingRuleOffer.pattern,
      matchType: pendingRuleOffer.matchType,
      action: pendingRuleOffer.action,
      destination: pendingRuleOffer.destination,
      createdAt: Date.now(),
      description: `Always ${pendingRuleOffer.action} ${pendingRuleOffer.pattern}`,
    };

    await saveRule(newRule);
    await recordRuleCreated();
    setRules((prev) => [...prev, newRule]);
    setRuleSavedToast(`Rule saved: Always ${pendingRuleOffer.action} ${pendingRuleOffer.pattern}`);
    setPendingRuleOffer(null);

    setTimeout(() => {
      setRuleSavedToast(null);
    }, 2400);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver || hasEndedRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toUpperCase();
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }

      // Spacebar toggles pause in Speed Challenge
      if (e.code === 'Space' && gameMode === 'speed_challenge') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
        return;
      }

      if (isPaused) return;

      // When destination drawer is open
      if (isSelectingDestination) {
        if (e.key === 'Escape') {
          setIsSelectingDestination(false);
          return;
        }

        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= destinations.length) {
          const selectedDest = destinations[num - 1].key;
          makeDecision('sort', selectedDest);
          return;
        }
      }

      const key = e.key.toLowerCase();

      // Right arrow or D -> Keep
      if (e.key === 'ArrowRight' || key === 'd') {
        e.preventDefault();
        makeDecision('keep');
      }
      // Left arrow or A -> Remove
      else if (e.key === 'ArrowLeft' || key === 'a') {
        e.preventDefault();
        makeDecision('remove');
      }
      // Up arrow or W -> Sort
      else if (e.key === 'ArrowUp' || key === 'w') {
        e.preventDefault();
        setIsSelectingDestination(true);
      }
      // Down arrow or S -> Skip
      else if (e.key === 'ArrowDown' || key === 's') {
        e.preventDefault();
        makeDecision('skip');
      }
      // Z -> Undo
      else if (key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // R -> Quick save offered rule
      else if (key === 'r' && pendingRuleOffer) {
        e.preventDefault();
        handleSaveRule();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isGameOver,
    isPaused,
    isSelectingDestination,
    destinations,
    makeDecision,
    handleUndo,
    pendingRuleOffer,
    gameMode,
  ]);

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isPaused) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const threshold = 50;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > threshold) {
        makeDecision('keep');
      } else if (dx < -threshold) {
        makeDecision('remove');
      }
    } else {
      if (dy < -threshold) {
        setIsSelectingDestination(true);
      } else if (dy > threshold) {
        makeDecision('skip');
      }
    }
  };

  const currentCluster = clusters[currentIndex];
  const currentSuggestion = currentCluster ? suggestionsMap[currentCluster.id] : null;

  const itemsResolvedCount = decisions
    .filter((d) => d.action !== 'skip')
    .reduce((sum, d) => sum + d.itemsCount, 0);

  const progressPercent =
    totalBacklogItemsCount > 0
      ? Math.min(100, Math.round((itemsResolvedCount / totalBacklogItemsCount) * 100))
      : 0;

  return (
    <div
      className="fixed inset-0 overflow-hidden flex flex-col bg-paper text-ink select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Screen reader announcement */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {currentCluster ? currentCluster.label : 'Run complete'}
      </div>

      {/* Run Header */}
      <header className="h-14 border-b border-line bg-surface px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/play"
            className="flex items-center gap-2 font-mono font-bold text-sm text-ink hover:opacity-80 focus-visible:outline-none"
          >
            <SortieLogo className="w-4 h-4" />
            <span>SORTIE</span>
          </Link>

          {isSampleData && (
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border border-line bg-paper text-muted rounded-[3px] tabular-nums">
              Sample Data
            </span>
          )}

          <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 border border-line rounded-[3px] bg-paper text-muted hidden sm:inline">
            {gameMode === 'smart_cleanup' ? 'Smart Cleanup' : 'Speed Challenge'}
          </span>
        </div>

        {/* Live Score, Combo & Timer / Mode Status */}
        <div className="flex items-center gap-3 sm:gap-5">
          {gameMode === 'speed_challenge' ? (
            <>
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  {SCORE_FORMULA_TEXT}
                </div>
                <div className="flex items-center justify-end gap-2 font-mono tabular-nums text-xs font-bold text-ink">
                  <span>Score: {score}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 border rounded-[3px] font-bold ${
                      combo > 1
                        ? 'border-accent-orange text-accent-orange bg-paper'
                        : 'border-line text-muted bg-paper'
                    }`}
                  >
                    x{combo}
                  </span>
                </div>
              </div>

              {/* Pause & Timer */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaused((prev) => !prev)}
                  className="p-1.5 border border-line bg-paper hover:bg-surface rounded-[5px] text-muted hover:text-ink focus-visible:outline-none"
                  title="Pause / Resume session (Space)"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>

                <div className="flex items-center gap-2 border border-line bg-paper px-3 py-1.5 rounded-[5px]">
                  <span className="text-[11px] font-mono uppercase text-muted">Time</span>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      timeLeft <= 10 ? 'text-accent-red animate-pulse' : 'text-ink'
                    }`}
                  >
                    {formatDuration(timeLeft)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            /* Smart Cleanup Status */
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent-teal" />
                <span>Smart Review • Untimed</span>
              </span>
            </div>
          )}

          {/* Shortcut guide button */}
          <button
            type="button"
            onClick={() => setShowShortcutGuide((prev) => !prev)}
            className="p-1.5 border border-line bg-paper hover:bg-surface rounded-[5px] text-muted hover:text-ink focus-visible:outline-none"
            title="Keyboard shortcuts guide"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full bg-line h-1 shrink-0 overflow-hidden" role="progressbar">
        <div
          className="bg-accent-teal h-full transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Status Bar */}
      <div className="px-4 sm:px-6 py-1.5 border-b border-line bg-paper/60 text-xs text-muted flex items-center justify-between font-mono tabular-nums shrink-0">
        <div>
          Card {Math.min(currentIndex + 1, Math.max(1, clusters.length))} of {clusters.length}
        </div>
        <div>
          Resolved {itemsResolvedCount} of {totalBacklogItemsCount} items ({progressPercent}%)
        </div>
      </div>

      {/* Rule Resolution Banner */}
      {ruleResolvedCount > 0 && (
        <div className="bg-paper border-b border-line px-4 py-1.5 text-xs text-muted flex items-center justify-between shrink-0 font-mono">
          <span>
            {ruleResolvedCount} cluster{ruleResolvedCount === 1 ? '' : 's'} resolved automatically by your rules
          </span>
          <Link to="/rules" className="text-ink underline text-[11px]">
            Manage rules
          </Link>
        </div>
      )}

      {/* Rule Suggestion Toast */}
      {pendingRuleOffer && !ruleSavedToast && (
        <div className="bg-surface border-b border-line px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">Rule recommendation:</span>
            <span>
              Always {pendingRuleOffer.action}{' '}
              {pendingRuleOffer.destination ? `to ${pendingRuleOffer.destination}` : ''} for pattern{' '}
              <strong className="font-mono text-ink">{pendingRuleOffer.pattern}</strong>?
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveRule}
              className="px-2.5 py-1 bg-ink text-surface rounded-[4px] font-medium text-xs hover:opacity-90 flex items-center gap-1 focus-visible:outline-none"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save (Press R)</span>
            </button>
            <button
              type="button"
              onClick={() => setPendingRuleOffer(null)}
              className="text-muted hover:text-ink text-xs px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {ruleSavedToast && (
        <div className="bg-accent-teal text-surface px-4 py-1.5 text-xs font-medium flex items-center gap-2 shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>{ruleSavedToast}</span>
        </div>
      )}

      {/* Main Play Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center relative">
        {isPaused ? (
          <div className="border border-line bg-surface p-8 rounded-[8px] text-center flex flex-col items-center gap-4 max-w-sm">
            <Pause className="w-8 h-8 text-muted" />
            <div>
              <h2 className="text-base font-bold text-ink">Session Paused</h2>
              <p className="text-xs text-muted mt-1">Take your time. Press Space to resume.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPaused(false)}
              className="px-4 py-2 bg-ink text-surface text-xs font-semibold rounded-[5px] hover:opacity-90 focus-visible:outline-none"
            >
              Resume Run
            </button>
          </div>
        ) : currentCluster ? (
          <div
            className={`w-full max-w-md bg-surface border border-line rounded-[8px] shadow-sm flex flex-col overflow-hidden transition-all duration-120 ${cardTransition}`}
          >
            {/* Card Header & Badges */}
            <div className="p-5 border-b border-line flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[6px] bg-paper border border-line flex items-center justify-center text-ink">
                    {packType === 'file' ? (
                      <Folder className="w-4 h-4 text-accent-teal" />
                    ) : (
                      <Receipt className="w-4 h-4 text-accent-orange" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink leading-tight">
                      {currentCluster.label}
                    </h2>
                    <span className="font-mono text-[11px] text-muted">
                      Pattern: {currentCluster.pattern}
                    </span>
                  </div>
                </div>

                {/* Special Cluster Badges */}
                {currentCluster.isDuplicateCluster && (
                  <span className="font-mono text-[10px] uppercase font-bold text-accent-red border border-accent-red/30 bg-accent-red/10 px-2 py-0.5 rounded-[3px] flex items-center gap-1 shrink-0">
                    <Copy className="w-3 h-3" />
                    <span>Duplicate Candidates</span>
                  </span>
                )}
                {currentCluster.recurringInfo?.isRecurring && (
                  <span className="font-mono text-[10px] text-accent-teal border border-accent-teal/30 bg-accent-teal/10 px-2 py-0.5 rounded-[3px] flex items-center gap-1 shrink-0">
                    <Repeat className="w-3 h-3" />
                    <span>Recurring Cadence</span>
                  </span>
                )}
              </div>

              {/* Metric stats */}
              <div className="flex items-center gap-4 font-mono text-xs text-muted pt-1">
                <div>
                  <strong className="text-ink">{currentCluster.count}</strong> items
                </div>
                <div>•</div>
                <div>
                  <strong className="text-ink">
                    {packType === 'file'
                      ? formatBytes(currentCluster.totalMetric)
                      : formatCurrency(currentCluster.totalMetric, currency)}
                  </strong>
                </div>
                {currentCluster.firstDate && currentCluster.lastDate && (
                  <>
                    <div>•</div>
                    <div className="truncate">
                      {formatDateRange(currentCluster.firstDate, currentCluster.lastDate)}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Example Items */}
            <div className="p-4 bg-paper/40 border-b border-line flex flex-col gap-1.5 text-xs">
              <span className="text-[11px] font-mono text-muted uppercase font-semibold">
                Example Items ({Math.min(3, currentCluster.exampleItems.length)} of {currentCluster.count})
              </span>
              <ul className="space-y-1 font-mono text-[11px] text-ink">
                {currentCluster.exampleItems.map((item, idx) => (
                  <li key={idx} className="truncate flex items-center gap-1.5">
                    <span className="text-muted">•</span>
                    <span className="truncate">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Recommendation Banner */}
            {currentSuggestion && (
              <div className="p-4 bg-accent-teal/5 border-b border-accent-teal/20 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-ink">
                    <Bot className="w-3.5 h-3.5 text-accent-teal" />
                    <span>AI Recommendation:</span>
                    <span
                      className={`font-mono text-[10px] uppercase font-bold px-2 py-0.2 rounded-[3px] ${
                        currentSuggestion.action === 'remove'
                          ? 'bg-accent-red/15 text-accent-red border border-accent-red/30'
                          : currentSuggestion.action === 'sort'
                          ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/30'
                          : 'bg-accent-teal/15 text-accent-teal border border-accent-teal/30'
                      }`}
                    >
                      {currentSuggestion.action}
                      {currentSuggestion.destination ? ` → ${currentSuggestion.destination}` : ''}
                    </span>
                  </div>

                  {/* Confidence Badge */}
                  <span
                    className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-[2px] border ${
                      currentSuggestion.confidence === 'high'
                        ? 'border-accent-teal/40 text-accent-teal bg-paper'
                        : currentSuggestion.confidence === 'medium'
                        ? 'border-accent-orange/40 text-accent-orange bg-paper'
                        : 'border-line text-muted bg-paper'
                    }`}
                  >
                    {currentSuggestion.confidence} confidence
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted text-[11px]">
                  <p className="italic">"{currentSuggestion.reason}"</p>
                  <button
                    type="button"
                    onClick={() => setShowWhyReasoning((prev) => !prev)}
                    className="text-ink underline hover:text-accent-teal ml-2 shrink-0 focus-visible:outline-none"
                  >
                    {showWhyReasoning ? 'Hide reasoning' : 'Ask Why?'}
                  </button>
                </div>

                {showWhyReasoning && (
                  <div className="p-2.5 bg-surface border border-line rounded-[5px] text-[11px] text-ink leading-relaxed font-sans mt-1">
                    <p className="font-semibold text-muted text-[10px] uppercase font-mono">
                      Reasoning Analysis ({currentSuggestion.source === 'gemini' ? 'Gemini 3.8 Flash' : 'Offline Rule Heuristics'})
                    </p>
                    <p className="mt-1">
                      {currentSuggestion.action === 'remove'
                        ? 'These items match transient patterns (.tmp, cache, logs) that consume clutter without holding ongoing document value. Safe to stage into review.'
                        : currentSuggestion.action === 'sort'
                        ? `Items exhibit homogenous metadata well-suited for the "${currentSuggestion.destination}" directory.`
                        : 'Identified as permanent active records or contracts requiring retention.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons Grid */}
            <div className="p-4 bg-paper/30 flex flex-col gap-2.5">
              <div className="grid grid-cols-3 gap-2 text-xs">
                {/* REMOVE BUTTON */}
                <button
                  type="button"
                  onClick={() => makeDecision('remove')}
                  className="py-3 px-2 bg-paper hover:bg-surface border border-accent-red/30 hover:border-accent-red text-accent-red rounded-[6px] font-semibold flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red"
                >
                  <div className="flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </div>
                  <span className="font-mono text-[10px] text-muted">Left / A</span>
                </button>

                {/* SORT BUTTON */}
                <button
                  type="button"
                  onClick={() => setIsSelectingDestination(true)}
                  className="py-3 px-2 bg-paper hover:bg-surface border border-line hover:border-ink text-ink rounded-[6px] font-semibold flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>Sort</span>
                  </div>
                  <span className="font-mono text-[10px] text-muted">Up / W (1-9)</span>
                </button>

                {/* KEEP BUTTON */}
                <button
                  type="button"
                  onClick={() => makeDecision('keep')}
                  className="py-3 px-2 bg-paper hover:bg-surface border border-accent-teal/30 hover:border-accent-teal text-accent-teal rounded-[6px] font-semibold flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal"
                >
                  <div className="flex items-center gap-1">
                    <span>Keep</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono text-[10px] text-muted">Right / D</span>
                </button>
              </div>

              {/* Bottom secondary controls: Skip & Undo */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => makeDecision('skip')}
                  className="px-3 py-1.5 text-muted hover:text-ink font-medium flex items-center gap-1 border border-line bg-paper rounded-[4px] focus-visible:outline-none"
                  title="Postpone cluster to the end of the queue"
                >
                  <ArrowDown className="w-3 h-3" />
                  <span>{gameMode === 'smart_cleanup' ? 'Skip & Revisit' : 'Skip'} (Down / S)</span>
                </button>

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={decisions.length === 0}
                  className="px-3 py-1.5 text-muted hover:text-ink font-medium flex items-center gap-1 border border-line bg-paper rounded-[4px] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none"
                  title="Undo previous decision"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo (Z)</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 border border-line bg-surface rounded-[8px] text-center flex flex-col items-center gap-3">
            <span className="w-4 h-4 rounded-full bg-accent-teal animate-ping" />
            <h2 className="text-sm font-bold text-ink">Completing Session...</h2>
            <p className="text-xs text-muted">Compiling your triage decisions into an actionable plan.</p>
          </div>
        )}

        {/* Destination Drawer / Modal (When sorting) */}
        {isSelectingDestination && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-surface border border-line rounded-[8px] p-5 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <ArrowUp className="w-4 h-4 text-accent-teal" />
                  <h3 className="text-sm font-bold text-ink">Choose Destination Category</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSelectingDestination(false)}
                  className="text-muted hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-xs">
                {destinations.map((dest) => (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => makeDecision('sort', dest.key)}
                    className="p-2.5 rounded-[5px] border border-line bg-paper hover:bg-surface hover:border-ink text-left flex items-center justify-between transition-colors focus-visible:outline-none"
                  >
                    <span className="font-semibold text-ink">{dest.label}</span>
                    <span className="font-mono text-[10px] text-muted border border-line px-1.5 py-0.2 rounded-[2px] bg-surface">
                      Press {dest.numKey}
                    </span>
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-muted font-mono text-center">
                Press numeric keys 1-{destinations.length} or Esc to cancel
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Guide Drawer */}
        {showShortcutGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-surface border border-line rounded-[8px] p-5 shadow-2xl flex flex-col gap-4 text-xs">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="font-bold text-sm text-ink flex items-center gap-1.5">
                  <Keyboard className="w-4 h-4 text-accent-teal" />
                  <span>Keyboard Shortcuts</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowShortcutGuide(false)}
                  className="text-muted hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-muted">
                <div className="flex items-center justify-between">
                  <span>Keep cluster unchanged</span>
                  <kbd className="font-mono px-2 py-0.5 bg-paper border border-line rounded-[3px] text-ink">
                    Right Arrow / D
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Move to review folder</span>
                  <kbd className="font-mono px-2 py-0.5 bg-paper border border-line rounded-[3px] text-ink">
                    Left Arrow / A
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sort into category</span>
                  <kbd className="font-mono px-2 py-0.5 bg-paper border border-line rounded-[3px] text-ink">
                    Up Arrow / W
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pick destination</span>
                  <kbd className="font-mono px-2 py-0.5 bg-paper border border-line rounded-[3px] text-ink">
                    1 - 9
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Skip / Postpone</span>
                  <kbd className="font-mono px-2 py-0.5 bg-paper border border-line rounded-[3px] text-ink">
                    Down Arrow / S
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Undo last decision</span>
                  <kbd className="font-mono px-2 py-0.5 bg-paper border border-line rounded-[3px] text-ink">
                    Z
                  </kbd>
                </div>
                {gameMode === 'speed_challenge' && (
                  <div className="flex items-center justify-between">
                    <span>Pause / Resume</span>
                    <kbd className="font-mono px-2 py-0.5 bg-paper border border-line rounded-[3px] text-ink">
                      Space
                    </kbd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Save offered rule</span>
                  <kbd className="font-mono px-2 py-0.5 bg-paper border border-line rounded-[3px] text-ink">
                    R
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
