import { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import {
  getCurrentPlan,
  saveApplyLog,
  getLastActiveApplyLog,
  markApplyLogReverted,
  clearPlan,
  getStoredDirectoryHandle,
  saveDirectoryHandle,
} from '../services/db';
import {
  safelyMoveFile,
  safelyRevertFileMove,
  cleanupEmptyDestinationFolders,
} from '../services/fileSystem';
import { formatBytes, formatCurrency, CurrencyCode } from '../utils/formatters';
import { PlanItem, ApplyLog, AppliedOperation } from '../types';
import {
  RotateCcw,
  Download,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export function PlanReviewPage() {
  const location = useLocation();
  const state = location.state || {};
  const runSummary = state.runSummary;
  const currency: CurrencyCode = state.currency || 'USD';
  const saveFailed = Boolean(state.saveFailed);

  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [applying, setApplying] = useState<boolean>(false);
  const [appliedLog, setAppliedLog] = useState<ApplyLog | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Undo / Revert state
  const [lastLog, setLastLog] = useState<ApplyLog | null>(null);
  const [reverting, setReverting] = useState<boolean>(false);
  const [revertMessage, setRevertMessage] = useState<string | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);

  // Directory handle state for real files
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [expectedFolderName, setExpectedFolderName] = useState<string>('');
  const [needsHandlePick, setNeedsHandlePick] = useState<boolean>(false);

  // Toggle for collapsed "No change" keep items
  const [showNoChange, setShowNoChange] = useState<boolean>(false);

  // Stored category totals so they remain visible after Apply (Income and refunds excluded)
  const [persistedCategoryTotals, setPersistedCategoryTotals] = useState<
    Record<string, { count: number; total: number }>
  >({});

  const isSampleData = runSummary ? runSummary.isSampleData : planItems.every((p) => p.items.every((it: any) => !it.handle));

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const items = await getCurrentPlan();
      setPlanItems(items);

      // Compute and persist category totals for expenses (exclude Income and refunds)
      const totals: Record<string, { count: number; total: number }> = {};
      for (const item of items) {
        if (item.isIncomeAndRefunds || item.clusterLabel === 'Income and refunds') {
          continue; // Credits and refunds are not spending
        }
        const cat = item.destination || (item.action === 'remove' ? 'Excluded' : 'Unchanged');
        if (!totals[cat]) {
          totals[cat] = { count: 0, total: 0 };
        }
        totals[cat].count += item.itemsCount;
        totals[cat].total += item.metricTotal;
      }
      setPersistedCategoryTotals(totals);

      // Check directory handle in IndexedDB
      const stored = await getStoredDirectoryHandle('active_run_dir');
      if (stored && stored.handle) {
        setDirHandle(stored.handle);
        setExpectedFolderName(stored.folderName);
      }

      const activeLast = await getLastActiveApplyLog();
      setLastLog(activeLast);
      setLoading(false);
    }
    loadData();
  }, []);

  // Separate actionable items (Sort, Remove) from Keep (No Change)
  const actionableItems = useMemo(
    () => planItems.filter((i) => i.action !== 'keep'),
    [planItems]
  );

  const keepItems = useMemo(
    () => planItems.filter((i) => i.action === 'keep'),
    [planItems]
  );

  // Handle re-picking directory if page was reloaded or permission needed
  const handleRepickDirectory = async () => {
    try {
      const picker = (window as any).showDirectoryPicker;
      if (!picker) {
        setApplyError('File System Access API is not supported in this browser.');
        return;
      }

      const pickedHandle: FileSystemDirectoryHandle = await picker({ mode: 'readwrite' });
      if (expectedFolderName && pickedHandle.name !== expectedFolderName) {
        setApplyError(
          `Selected folder "${pickedHandle.name}" does not match the original folder "${expectedFolderName}". Please pick the original folder.`
        );
        return;
      }

      await saveDirectoryHandle('active_run_dir', pickedHandle, pickedHandle.name);
      setDirHandle(pickedHandle);
      setExpectedFolderName(pickedHandle.name);
      setNeedsHandlePick(false);
      setApplyError(null);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const msg = (err.message || '').toLowerCase();
        if (
          err.name === 'SecurityError' ||
          msg.includes('sensitive') ||
          msg.includes('protected')
        ) {
          setApplyError(
            'This folder is protected by your system or browser. Please pick a subfolder or make a new folder and copy files into it.'
          );
        } else {
          setApplyError(err.message || 'Failed to select folder.');
        }
      }
    }
  };

  const handleToggleItem = (id: string) => {
    setPlanItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleToggleAllActionable = (selected: boolean) => {
    setPlanItems((prev) =>
      prev.map((item) => (item.action !== 'keep' ? { ...item, selected } : item))
    );
  };

  const handleApply = async () => {
    // Only apply actionable items (Sort and Remove) that are selected
    const selectedItems = actionableItems.filter((i) => i.selected);
    if (selectedItems.length === 0) return;

    const packType = selectedItems[0]?.packType || 'file';

    // Check if this is a real files run needing a usable directory handle
    const hasRealFiles = selectedItems.some((item) =>
      item.items.some((f: any) => f.handle !== undefined)
    );

    let activeHandle = dirHandle;
    if (hasRealFiles && !isSampleData) {
      if (!activeHandle) {
        setNeedsHandlePick(true);
        setApplyError(
          expectedFolderName
            ? `Please re-select the original folder "${expectedFolderName}" to apply file changes.`
            : 'Please pick your target folder to apply file moves.'
        );
        return;
      }

      // Check permission on existing handle
      try {
        const perm = await (activeHandle as any).queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const req = await (activeHandle as any).requestPermission({ mode: 'readwrite' });
          if (req !== 'granted') {
            setNeedsHandlePick(true);
            setApplyError('Readwrite permission to the folder was not granted.');
            return;
          }
        }
      } catch {
        setNeedsHandlePick(true);
        return;
      }
    }

    setApplying(true);
    setApplyError(null);
    setRevertMessage(null);
    setRevertError(null);

    const totalCount = selectedItems.reduce((acc, i) => acc + i.itemsCount, 0);

    // Initialize apply log for incremental logging
    const log: ApplyLog = {
      id: `apply_${Date.now()}`,
      timestamp: Date.now(),
      packType,
      totalItems: totalCount,
      summary:
        packType === 'file' && isSampleData
          ? `Sample run: no real files were changed (${selectedItems.length} groups triaged).`
          : `Applied ${selectedItems.length} decisions across ${totalCount} items.`,
      items: selectedItems,
      operations: [],
      reverted: false,
    };

    // Save initial log
    await saveApplyLog(log);

    const failedItems: string[] = [];

    try {
      for (const item of selectedItems) {
        // KEEP items are strictly never moved or categorized
        if (item.action === 'keep') continue;

        if (packType === 'file') {
          const destFolder =
            item.action === 'remove' ? '_sortie_removed' : item.destination || 'Unsorted';

          for (const rawFile of item.items as any[]) {
            if (activeHandle && rawFile.handle && !isSampleData) {
              try {
                const op = await safelyMoveFile(activeHandle, rawFile, destFolder);
                log.operations.push(op);
                // Write the apply log after each successful move
                await saveApplyLog(log);
              } catch (moveErr: any) {
                failedItems.push(`${rawFile.name}: ${moveErr.message}`);
              }
            } else {
              // Sample run: record virtual operation without disk write
              log.operations.push({
                id: `op_sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                type: 'file_move',
                sourceName: rawFile.name,
                destFolder,
                resolvedName: rawFile.name,
                reverted: false,
              });
              await saveApplyLog(log);
            }
          }
        } else {
          // Expenses categorization: Remove is 'Excluded', Sort is destination
          const assignedCat = item.action === 'remove' ? 'Excluded' : item.destination || 'Other';
          for (const rawExp of item.items as any[]) {
            log.operations.push({
              id: `op_exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'expense_categorize',
              expenseId: rawExp.id,
              sourceName: rawExp.description,
              assignedCategory: assignedCat,
              reverted: false,
            });
            await saveApplyLog(log);
          }
        }
      }

      await clearPlan();
      setAppliedLog(log);
      setLastLog(log);
      setPlanItems([]);

      if (failedItems.length > 0) {
        setApplyError(
          `Some files could not be moved:\n${failedItems.join('\n')}`
        );
      }
    } catch (err: any) {
      setApplyError(err.message || 'An error occurred while applying the plan.');
    } finally {
      setApplying(false);
    }
  };

  const handleRevertLast = async () => {
    if (!lastLog || lastLog.reverted) return;

    setReverting(true);
    setRevertMessage(null);
    setRevertError(null);

    let activeHandle = dirHandle;
    const failedReverts: string[] = [];
    const touchedDestFolders = new Set<string>();

    try {
      if (lastLog.packType === 'file') {
        const hasRealMoves = lastLog.operations.some((op) => !op.id.startsWith('op_sim_'));

        if (hasRealMoves) {
          if (!activeHandle) {
            const stored = await getStoredDirectoryHandle('active_run_dir');
            activeHandle = stored?.handle || null;
          }

          if (!activeHandle) {
            setRevertError('Please re-select the original folder to revert real file moves.');
            setNeedsHandlePick(true);
            setReverting(false);
            return;
          }

          for (const op of lastLog.operations) {
            if (op.reverted) continue; // Skip operations already reverted

            if (op.type === 'file_move' && !op.id.startsWith('op_sim_')) {
              if (op.destFolder) touchedDestFolders.add(op.destFolder);
              try {
                await safelyRevertFileMove(activeHandle, op);
                op.reverted = true;
                // Save log after each file is restored
                await saveApplyLog(lastLog);
              } catch (err: any) {
                // If a file is missing from destination, report it and continue
                failedReverts.push(`${op.resolvedName || op.sourceName}: ${err.message}`);
              }
            }
          }

          // After restoring, remove destination folders Sortie created if they are empty
          await cleanupEmptyDestinationFolders(activeHandle, Array.from(touchedDestFolders));
        } else {
          // Sample run revert
          for (const op of lastLog.operations) {
            if (op.reverted) continue;
            op.reverted = true;
            await saveApplyLog(lastLog);
          }
        }
      }

      // Check if all operations are now reverted
      const allReverted = lastLog.operations.every((op) => op.reverted);

      if (allReverted) {
        await markApplyLogReverted(lastLog.id);
        setRevertMessage(
          `Successfully reverted apply from ${new Date(lastLog.timestamp).toLocaleTimeString()}.`
        );
        setLastLog(null);
      } else {
        setRevertError(
          `Partial revert completed. The following files could not be restored:\n${failedReverts.join(
            '\n'
          )}\nYou can retry revert after checking these files.`
        );
      }
    } catch (err: any) {
      setRevertError(`Revert notice: ${err.message}`);
    } finally {
      setReverting(false);
    }
  };

  /**
   * Sanitizes cell values to prevent CSV formula injection (=, +, -, @)
   */
  const sanitizeCSVCell = (val: string | number | undefined): string => {
    if (val === undefined || val === null) return '""';
    let s = String(val).trim();
    if (/^[=+\-@]/.test(s)) {
      s = `'${s}`;
    }
    return `"${s.replace(/"/g, '""')}"`;
  };

  // Export categorized expenses to CSV
  const handleExportCSV = () => {
    const sourceItems = appliedLog ? appliedLog.items : planItems;
    if (sourceItems.length === 0 && Object.keys(persistedCategoryTotals).length === 0) return;

    const rows: string[] = ['Date,Description,Merchant,Amount,Category,Action'];

    // Map through applied or current plan items plus keep items
    const allExportItems = [...sourceItems, ...keepItems];

    for (const planItem of allExportItems) {
      for (const item of planItem.items as any[]) {
        const date = sanitizeCSVCell(item.date || '');
        const desc = sanitizeCSVCell(item.description || '');
        const merch = sanitizeCSVCell(item.normalizedMerchant || '');
        const amount = typeof item.amount === 'number' ? item.amount.toFixed(2) : sanitizeCSVCell(item.amount);

        // Remove => Excluded, Keep => Unchanged, Sort => Destination
        let cat = 'Unchanged';
        if (planItem.isIncomeAndRefunds) cat = 'Income/Refund';
        else if (planItem.action === 'remove') cat = 'Excluded';
        else if (planItem.action === 'sort') cat = planItem.destination || 'Other';

        const sanitizedCategory = sanitizeCSVCell(cat);
        const action = sanitizeCSVCell(planItem.action);

        rows.push(`${date},${desc},${merch},${amount},${sanitizedCategory},${action}`);
      }
    }

    const csvBlob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sortie_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isExpensePack =
    planItems[0]?.packType === 'expense' ||
    appliedLog?.packType === 'expense' ||
    Object.keys(persistedCategoryTotals).length > 0;

  const actionableSelectedCount = actionableItems.filter((i) => i.selected).length;

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Header isSampleData={isSampleData} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-8">
        {/* Persistence error banner */}
        {saveFailed && (
          <div className="p-4 bg-surface border border-accent-orange/40 rounded-[6px] text-xs font-medium text-ink flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-accent-orange shrink-0" />
            <span>Warning: Could not save plan to local storage. You can still review and apply now.</span>
          </div>
        )}

        {/* Impact Accomplishment Dashboard */}
        {runSummary && (
          <div className="border border-line bg-surface p-6 rounded-[8px] flex flex-col gap-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-accent-teal font-semibold">
                  Session Impact Summary
                </span>
                <h2 className="text-xl font-bold text-ink mt-0.5">
                  What Sortie Accomplished in this Run
                </h2>
                <p className="text-xs text-muted mt-1 font-mono">
                  {runSummary.mode === 'smart_cleanup' ? 'Smart Cleanup Mode' : 'Speed Challenge Mode'} • Session duration: {runSummary.elapsedSeconds}s
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const report = {
                      title: 'Sortie Triage Session Report',
                      timestamp: new Date(runSummary.timestamp).toISOString(),
                      packType: runSummary.packType,
                      mode: runSummary.mode,
                      itemsReviewed: runSummary.totalBacklogItems,
                      itemsResolved: runSummary.itemsResolved,
                      decisionsCount: runSummary.decisionsCount,
                      score: runSummary.score,
                      elapsedSeconds: runSummary.elapsedSeconds,
                    };
                    const blob = new Blob([JSON.stringify(report, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sortie_session_summary_${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 bg-paper hover:bg-surface text-ink text-xs font-medium rounded-[5px] border border-line flex items-center gap-1.5 focus-visible:outline-none"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Report</span>
                </button>

                <Link
                  to="/play"
                  className="px-3.5 py-1.5 bg-ink text-surface text-xs font-semibold rounded-[5px] hover:opacity-90 transition-opacity focus-visible:outline-none"
                >
                  Start Another Run
                </Link>
              </div>
            </div>

            {/* Calculated Impact Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-paper rounded-[6px] border border-line flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase text-muted">Items Resolved</span>
                <span className="text-xl font-bold text-ink tabular-nums">
                  {runSummary.itemsResolved}
                </span>
                <span className="text-[10px] text-muted">Of {runSummary.totalBacklogItems} backlog items</span>
              </div>

              <div className="p-3 bg-paper rounded-[6px] border border-line flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase text-muted">Kept Safe</span>
                <span className="text-xl font-bold text-ink tabular-nums">
                  {runSummary.decisions.filter((d: any) => d.action === 'keep').reduce((sum: number, d: any) => sum + d.itemsCount, 0)}
                </span>
                <span className="text-[10px] text-muted">Retained in original path</span>
              </div>

              <div className="p-3 bg-paper rounded-[6px] border border-line flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase text-muted">Organized / Staged</span>
                <span className="text-xl font-bold text-ink tabular-nums">
                  {runSummary.decisions.filter((d: any) => d.action === 'sort' || d.action === 'remove').reduce((sum: number, d: any) => sum + d.itemsCount, 0)}
                </span>
                <span className="text-[10px] text-muted">Filed into destination subfolders</span>
              </div>

              <div className="p-3 bg-paper rounded-[6px] border border-line flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase text-muted">Data Volume Organized</span>
                <span className="text-xl font-bold text-ink tabular-nums">
                  {formatBytes(
                    runSummary.decisions.reduce((sum: number, d: any) => sum + (d.clusterMetric || 0), 0)
                  )}
                </span>
                <span className="text-[10px] text-muted">Files cataloged (disk size unchanged)</span>
              </div>
            </div>
          </div>
        )}

        {/* Heading and controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Plan Review</h1>
            <p className="text-xs text-muted mt-1">
              Review pending decisions before applying changes to disk or CSV. Untick any line to
              exclude it.
            </p>
          </div>

          {lastLog && !lastLog.reverted && (
            <button
              type="button"
              onClick={handleRevertLast}
              disabled={reverting}
              className="px-3.5 py-2 bg-paper hover:bg-surface text-accent-red border border-line rounded-[6px] text-xs font-medium flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{reverting ? 'Reverting...' : 'Revert Last Apply'}</span>
            </button>
          )}
        </div>

        {revertMessage && (
          <div className="p-4 bg-surface border border-line rounded-[6px] text-xs font-medium text-ink flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent-teal shrink-0" />
            <span>{revertMessage}</span>
          </div>
        )}

        {revertError && (
          <div className="p-4 bg-surface border border-accent-red/30 rounded-[6px] text-xs font-medium text-accent-red flex items-start gap-2 whitespace-pre-line">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{revertError}</span>
          </div>
        )}

        {applyError && (
          <div className="p-4 bg-surface border border-accent-red/30 rounded-[6px] text-xs font-medium text-accent-red flex items-start gap-2 whitespace-pre-line">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span>{applyError}</span>
              {needsHandlePick && (
                <button
                  type="button"
                  onClick={handleRepickDirectory}
                  className="mt-2 block px-3 py-1.5 bg-ink text-surface rounded-[4px] text-xs font-semibold hover:opacity-90 focus-visible:outline-none"
                >
                  Pick Folder Again
                </button>
              )}
            </div>
          </div>
        )}

        {/* Applied confirmation screen */}
        {appliedLog && (
          <div className="border border-line bg-surface rounded-[6px] p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent-teal" />
              <div>
                <h3 className="text-base font-bold text-ink">Plan successfully applied</h3>
                <p className="text-xs text-muted mt-0.5">{appliedLog.summary}</p>
              </div>
            </div>

            <div className="p-4 bg-paper border border-line rounded-[6px] text-xs text-muted leading-relaxed">
              {appliedLog.packType === 'file' ? (
                isSampleData ? (
                  <span className="font-mono text-ink">Sample run: no real files were changed.</span>
                ) : (
                  <span>
                    Files have been moved safely into their target subfolders. Removed items are stored
                    in <code className="font-mono text-ink">_sortie_removed</code>. No files were
                    deleted or overwritten.
                  </span>
                )
              ) : (
                <span>
                  Transactions categorized. You can now download the clean categorized CSV below.
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {appliedLog.packType === 'expense' && (
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 bg-ink text-surface rounded-[6px] text-xs font-medium flex items-center gap-2 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Categorized CSV</span>
                </button>
              )}

              <Link
                to="/history"
                className="px-4 py-2.5 bg-paper hover:bg-surface text-ink border border-line rounded-[6px] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                View Undo History
              </Link>

              <Link
                to="/play"
                className="px-4 py-2.5 bg-paper hover:bg-surface text-ink border border-line rounded-[6px] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                Start New Run
              </Link>
            </div>
          </div>
        )}

        {/* Expense Category Totals Breakdown (Excludes Income and refunds) */}
        {isExpensePack && Object.keys(persistedCategoryTotals).length > 0 && (
          <div className="border border-line bg-surface rounded-[6px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-muted font-semibold">
                Category Totals (Spending)
              </span>
              <button
                type="button"
                onClick={handleExportCSV}
                className="text-xs text-ink hover:underline flex items-center gap-1 font-medium focus-visible:outline-none"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(persistedCategoryTotals).map(([cat, stats]) => (
                <div
                  key={cat}
                  className="p-3 bg-paper border border-line rounded-[6px] flex flex-col gap-1 font-mono text-xs"
                >
                  <span className="text-muted text-[11px] font-sans truncate">{cat}</span>
                  <span className="text-sm font-bold text-ink tabular-nums">
                    {formatCurrency(stats.total, currency)}
                  </span>
                  <span className="text-[10px] text-muted tabular-nums">
                    {stats.count} transaction{stats.count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actionable Plan Items List */}
        {loading ? (
          <div className="p-8 text-center text-xs text-muted border border-line bg-surface rounded-[6px]">
            Loading plan items...
          </div>
        ) : actionableItems.length === 0 && keepItems.length === 0 && !appliedLog ? (
          <div className="p-12 text-center border border-line bg-surface rounded-[6px] flex flex-col items-center gap-3">
            <h3 className="font-bold text-base text-ink">No pending actions</h3>
            <p className="text-xs text-muted max-w-sm">
              You have no pending triage decisions. Start a run to build a plan.
            </p>
            <Link
              to="/play"
              className="mt-2 px-4 py-2 bg-ink text-surface rounded-[6px] text-xs font-semibold hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              Start Run
            </Link>
          </div>
        ) : (
          <>
            {actionableItems.length > 0 && (
              <div className="border border-line bg-surface rounded-[6px] divide-y divide-line">
                {/* Batch selection header */}
                <div className="p-4 bg-paper/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-ink font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          actionableSelectedCount === actionableItems.length &&
                          actionableItems.length > 0
                        }
                        onChange={(e) => handleToggleAllActionable(e.target.checked)}
                        className="w-4 h-4 accent-ink rounded-[2px]"
                      />
                      <span>
                        {actionableSelectedCount} of {actionableItems.length} action groups selected
                      </span>
                    </label>
                  </div>

                  <div className="text-muted font-mono tabular-nums">
                    Total items:{' '}
                    {actionableItems
                      .filter((i) => i.selected)
                      .reduce((sum, i) => sum + i.itemsCount, 0)}
                  </div>
                </div>

                {/* Actionable Items */}
                {actionableItems.map((item) => {
                  let badgeColor = 'border-line text-muted bg-paper';
                  if (item.action === 'sort')
                    badgeColor = 'border-accent-orange/30 text-accent-orange bg-paper';
                  if (item.action === 'remove')
                    badgeColor = 'border-accent-red/30 text-accent-red bg-paper';

                  return (
                    <div
                      key={item.id}
                      className="p-4 flex items-start justify-between gap-4 hover:bg-paper/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            id={`chk_${item.id}`}
                            checked={item.selected}
                            onChange={() => handleToggleItem(item.id)}
                            className="w-4 h-4 accent-ink rounded-[2px] cursor-pointer"
                          />
                        </div>

                        <label htmlFor={`chk_${item.id}`} className="flex flex-col gap-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-ink">
                              {item.clusterLabel}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 border rounded-[4px] ${badgeColor}`}
                            >
                              {item.action}
                              {item.destination ? ` → ${item.destination}` : ''}
                            </span>
                            {item.source === 'rule' && (
                              <span className="text-[10px] font-mono text-muted border border-line px-1.5 py-0.2 rounded-[2px] bg-paper">
                                rule
                              </span>
                            )}
                            {item.isIncomeAndRefunds && (
                              <span className="text-[10px] font-mono text-accent-teal border border-accent-teal/30 px-1.5 py-0.2 rounded-[2px] bg-paper">
                                refund/income
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-muted font-mono tabular-nums">
                            {item.itemsCount} item{item.itemsCount === 1 ? '' : 's'} •{' '}
                            {item.packType === 'file'
                              ? formatBytes(item.metricTotal)
                              : formatCurrency(item.metricTotal, currency)}
                          </div>

                          {/* Preview example items */}
                          <div className="text-[11px] text-muted truncate max-w-md font-mono mt-0.5">
                            {item.items
                              .slice(0, 3)
                              .map((sub: any) => sub.name || sub.description)
                              .join(', ')}
                          </div>
                        </label>
                      </div>
                    </div>
                  );
                })}

                {/* Apply Action Footer */}
                <div className="p-4 bg-paper/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-muted">
                    Nothing changes on disk or CSV until you click Apply.
                  </div>

                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={actionableSelectedCount === 0 || applying}
                    className={`px-5 py-2.5 rounded-[6px] text-xs font-semibold flex items-center gap-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                      actionableSelectedCount > 0 && !applying
                        ? 'bg-ink text-surface hover:opacity-95 cursor-pointer'
                        : 'bg-paper text-muted border border-line cursor-not-allowed'
                    }`}
                  >
                    <span>
                      {applying ? 'Applying...' : `Apply Selected (${actionableSelectedCount})`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Collapsed "No change" (Keep) Section */}
            {keepItems.length > 0 && (
              <div className="border border-line bg-surface rounded-[6px] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowNoChange((prev) => !prev)}
                  className="w-full p-4 flex items-center justify-between text-xs font-semibold text-muted hover:text-ink bg-paper/40 transition-colors focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2">
                    {showNoChange ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span>
                      No change: {keepItems.length} group{keepItems.length === 1 ? '' : 's'} (
                      {keepItems.reduce((acc, k) => acc + k.itemsCount, 0)} items kept unchanged)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-muted uppercase">
                    Excluded from apply
                  </span>
                </button>

                {showNoChange && (
                  <div className="divide-y divide-line border-t border-line">
                    {keepItems.map((item) => (
                      <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs text-ink">{item.clusterLabel}</span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-accent-teal/30 text-accent-teal rounded-[4px] bg-paper">
                              keep (unchanged)
                            </span>
                          </div>
                          <div className="text-[11px] text-muted font-mono tabular-nums">
                            {item.itemsCount} item{item.itemsCount === 1 ? '' : 's'} •{' '}
                            {item.packType === 'file'
                              ? formatBytes(item.metricTotal)
                              : formatCurrency(item.metricTotal, currency)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
