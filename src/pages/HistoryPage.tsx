import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import {
  getRunHistory,
  getApplyLogs,
  markApplyLogReverted,
  clearAllLocalData,
} from '../services/db';
import { safelyRevertFileMove } from '../services/fileSystem';
import { RunSummary, ApplyLog } from '../types';
import { RotateCcw, Clock, Layers, CheckCircle2, Trash2 } from 'lucide-react';

export function HistoryPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [applyLogs, setApplyLogs] = useState<ApplyLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'applies' | 'runs'>('applies');
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [historyRuns, logs] = await Promise.all([getRunHistory(), getApplyLogs()]);
    setRuns(historyRuns);
    setApplyLogs(logs);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRevert = async (log: ApplyLog) => {
    if (log.reverted) return;

    setRevertingId(log.id);
    setStatusMessage(null);

    const failedReverts: string[] = [];
    const touchedDestFolders = new Set<string>();

    try {
      if (log.packType === 'file') {
        const hasRealMoves = log.operations.some((op) => !op.id.startsWith('op_sim_'));

        if (hasRealMoves) {
          let activeDirHandle = (window as any).__sortie_active_dir_handle;
          if (!activeDirHandle) {
            const { getStoredDirectoryHandle } = await import('../services/db');
            const stored = await getStoredDirectoryHandle('active_run_dir');
            activeDirHandle = stored?.handle || null;
          }

          if (!activeDirHandle) {
            setStatusMessage('Please open the app and pick the original folder to revert real files.');
            setRevertingId(null);
            return;
          }

          const { safelyRevertFileMove, cleanupEmptyDestinationFolders } = await import('../services/fileSystem');

          for (const op of log.operations) {
            if (op.reverted) continue; // Skip already reverted operations

            if (op.type === 'file_move' && !op.id.startsWith('op_sim_')) {
              if (op.destFolder) touchedDestFolders.add(op.destFolder);
              try {
                await safelyRevertFileMove(activeDirHandle, op);
                op.reverted = true;
                const { saveApplyLog } = await import('../services/db');
                await saveApplyLog(log);
              } catch (err: any) {
                // If a file is missing from destination, report it and continue
                failedReverts.push(`${op.resolvedName || op.sourceName}: ${err.message}`);
              }
            }
          }

          // Remove destination folders Sortie created if they are empty
          await cleanupEmptyDestinationFolders(activeDirHandle, Array.from(touchedDestFolders));
        } else {
          // Sample run revert
          for (const op of log.operations) {
            if (op.reverted) continue;
            op.reverted = true;
            const { saveApplyLog } = await import('../services/db');
            await saveApplyLog(log);
          }
        }
      } else {
        for (const op of log.operations) {
          if (op.reverted) continue;
          op.reverted = true;
          const { saveApplyLog } = await import('../services/db');
          await saveApplyLog(log);
        }
      }

      // Check if all operations are now reverted
      const allReverted = log.operations.every((op) => op.reverted);

      if (allReverted) {
        await markApplyLogReverted(log.id);
        setStatusMessage(`Successfully reverted apply log from ${new Date(log.timestamp).toLocaleString()}.`);
      } else {
        setStatusMessage(
          `Partial revert completed. The following files could not be restored:\n${failedReverts.join(
            '\n'
          )}\nYou can retry revert after resolving these files.`
        );
      }

      await loadData();
    } catch (err: any) {
      setStatusMessage(`Revert error: ${err.message}`);
    } finally {
      setRevertingId(null);
    }
  };

  const handleClearAll = async () => {
    if (
      window.confirm(
        'Warning: Clearing local history will permanently delete all undo logs for already applied changes. Revert will no longer be possible. Do you wish to continue?'
      )
    ) {
      await clearAllLocalData();
      await loadData();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">History & Undo Log</h1>
            <p className="text-xs text-muted mt-1">
              Every apply operation is saved locally. You can revert previous changes anytime.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-1.5 text-xs text-muted hover:text-accent-red border border-line bg-paper hover:bg-surface rounded-[6px] transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Local History</span>
          </button>
        </div>

        {statusMessage && (
          <div className="p-4 bg-surface border border-line rounded-[6px] text-xs font-medium text-ink flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent-teal" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Tab switch */}
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('applies')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-[4px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
              activeTab === 'applies'
                ? 'bg-ink text-surface'
                : 'text-muted hover:text-ink bg-transparent'
            }`}
          >
            Apply Logs ({applyLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('runs')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-[4px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
              activeTab === 'runs'
                ? 'bg-ink text-surface'
                : 'text-muted hover:text-ink bg-transparent'
            }`}
          >
            Run Sessions ({runs.length})
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted border border-line bg-surface rounded-[6px]">
            Loading logs...
          </div>
        ) : activeTab === 'applies' ? (
          applyLogs.length === 0 ? (
            <div className="p-12 text-center border border-line bg-surface rounded-[6px] text-xs text-muted">
              No apply logs recorded yet. Once you complete a run and apply your plan, undo records
              appear here.
            </div>
          ) : (
            <div className="border border-line bg-surface rounded-[6px] divide-y divide-line">
              {applyLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">{log.summary}</span>
                      {log.reverted ? (
                        <span className="font-mono text-[10px] uppercase font-bold text-muted border border-line px-2 py-0.5 rounded-[3px] bg-paper">
                          Reverted
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase font-bold text-accent-teal border border-accent-teal/30 px-2 py-0.5 rounded-[3px] bg-paper">
                          Applied
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted font-mono tabular-nums">
                      {new Date(log.timestamp).toLocaleString()} • {log.packType} pack •{' '}
                      {log.totalItems} items
                    </div>
                  </div>

                  {!log.reverted && (
                    <button
                      type="button"
                      onClick={() => handleRevert(log)}
                      disabled={revertingId === log.id}
                      className="px-3.5 py-1.5 bg-paper hover:bg-surface text-accent-red border border-line rounded-[6px] text-xs font-medium flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{revertingId === log.id ? 'Reverting...' : 'Revert Apply'}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : runs.length === 0 ? (
          <div className="p-12 text-center border border-line bg-surface rounded-[6px] text-xs text-muted">
            No game runs recorded yet.
          </div>
        ) : (
          <div className="border border-line bg-surface rounded-[6px] divide-y divide-line">
            {runs.map((run) => (
              <div
                key={run.id}
                className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">
                      {run.itemsResolved} items resolved in {run.elapsedSeconds}s
                    </span>
                    <span className="font-mono text-[11px] text-muted uppercase tracking-wider px-1.5 py-0.2 border border-line rounded-[3px] bg-paper">
                      {run.packType}
                    </span>
                    {run.isSampleData && (
                      <span className="font-mono text-[10px] text-muted border border-line px-1.5 py-0.2 rounded-[3px] bg-paper">
                        Sample
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted font-mono tabular-nums">
                    Score: {run.score} • Decisions: {run.decisionsCount} •{' '}
                    {new Date(run.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
