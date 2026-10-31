import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { getRules, saveRule, deleteRule } from '../services/db';
import { LocalRule, PackType, DecisionAction } from '../types';
import {
  DEFAULT_FILE_DESTINATIONS,
  DEFAULT_EXPENSE_CATEGORIES,
} from '../data/sampleExpenses';
import { Plus, Trash2, Edit3, X, Check, SlidersHorizontal } from 'lucide-react';

export function RulesPage() {
  const [rules, setRules] = useState<LocalRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form fields
  const [packType, setPackType] = useState<PackType>('file');
  const [pattern, setPattern] = useState<string>('');
  const [matchType, setMatchType] = useState<LocalRule['matchType']>('extension');
  const [action, setAction] = useState<'keep' | 'remove' | 'sort'>('remove');
  const [destination, setDestination] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    const loaded = await getRules();
    setRules(loaded);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingRuleId(null);
    setPackType('file');
    setPattern('');
    setMatchType('extension');
    setAction('remove');
    setDestination('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: LocalRule) => {
    setEditingRuleId(rule.id);
    setPackType(rule.packType);
    setPattern(rule.pattern);
    setMatchType(rule.matchType);
    setAction(rule.action);
    setDestination(rule.destination || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteRule(id);
    await loadData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;

    const newRule: LocalRule = {
      id: editingRuleId || `rule_${Date.now()}`,
      packType,
      pattern: pattern.trim(),
      matchType,
      action,
      destination: action === 'sort' ? destination : undefined,
      createdAt: Date.now(),
      description: `Always ${action} ${pattern.trim()}`,
    };

    await saveRule(newRule);
    setIsModalOpen(false);
    await loadData();
  };

  const destinations =
    packType === 'file' ? DEFAULT_FILE_DESTINATIONS : DEFAULT_EXPENSE_CATEGORIES;

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Automation Rules</h1>
            <p className="text-xs text-muted mt-1">
              Rules apply automatically during future scans. Stored locally in your browser.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-ink text-surface rounded-[6px] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Rule</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted border border-line bg-surface rounded-[6px]">
            Loading local rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center border border-line bg-surface rounded-[6px] flex flex-col items-center gap-3">
            <SlidersHorizontal className="w-8 h-8 text-muted mb-1" />
            <h3 className="font-bold text-base text-ink">No saved rules</h3>
            <p className="text-xs text-muted max-w-sm">
              Save rules during play when prompted after Remove or Sort decisions, or create one manually.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="mt-2 px-4 py-2 bg-ink text-surface rounded-[6px] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              Add First Rule
            </button>
          </div>
        ) : (
          <div className="border border-line bg-surface rounded-[6px] divide-y divide-line">
            {rules.map((rule) => {
              let badgeColor = 'border-line text-muted bg-paper';
              if (rule.action === 'keep') badgeColor = 'border-accent-teal/30 text-accent-teal bg-paper';
              if (rule.action === 'sort') badgeColor = 'border-accent-orange/30 text-accent-orange bg-paper';
              if (rule.action === 'remove') badgeColor = 'border-accent-red/30 text-accent-red bg-paper';

              return (
                <div
                  key={rule.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-ink">{rule.pattern}</span>
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 border rounded-[4px] ${badgeColor}`}
                      >
                        {rule.action}
                        {rule.destination ? ` → ${rule.destination}` : ''}
                      </span>
                      <span className="text-[11px] font-mono text-muted uppercase tracking-wider px-1.5 py-0.2 border border-line rounded-[3px] bg-paper">
                        {rule.packType}
                      </span>
                    </div>

                    <div className="text-xs text-muted">
                      Match condition: <span className="font-mono text-ink">{rule.matchType}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(rule)}
                      className="p-2 border border-line bg-paper hover:bg-surface text-muted hover:text-ink rounded-[4px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                      title="Edit rule"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule.id)}
                      className="p-2 border border-line bg-paper hover:bg-surface text-accent-red rounded-[4px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create / Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4">
            <div className="border border-line bg-surface max-w-md w-full rounded-[6px] p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-ink">
                  {editingRuleId ? 'Edit Rule' : 'Create Automation Rule'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted hover:text-ink focus-visible:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col gap-4 text-xs">
                <div>
                  <label className="text-muted block mb-1 font-semibold">Pack Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPackType('file')}
                      className={`p-2 border rounded-[4px] font-medium ${
                        packType === 'file'
                          ? 'border-ink bg-paper font-semibold'
                          : 'border-line text-muted'
                      }`}
                    >
                      Files Pack
                    </button>
                    <button
                      type="button"
                      onClick={() => setPackType('expense')}
                      className={`p-2 border rounded-[4px] font-medium ${
                        packType === 'expense'
                          ? 'border-ink bg-paper font-semibold'
                          : 'border-line text-muted'
                      }`}
                    >
                      Expenses Pack
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-muted block mb-1 font-semibold">
                    Pattern or Key (e.g. *.tmp, Invoice*, Uber)
                  </label>
                  <input
                    type="text"
                    required
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder={packType === 'file' ? '*.tmp or Screenshot*' : 'Uber or Netflix'}
                    className="w-full border border-line bg-paper text-ink p-2 rounded-[4px] font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  />
                </div>

                <div>
                  <label className="text-muted block mb-1 font-semibold">Match Type</label>
                  <select
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as any)}
                    className="w-full border border-line bg-paper text-ink p-2 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    {packType === 'file' ? (
                      <>
                        <option value="extension">Extension (*.ext)</option>
                        <option value="name_prefix">Filename Prefix</option>
                      </>
                    ) : (
                      <>
                        <option value="merchant_exact">Exact Normalized Merchant</option>
                        <option value="merchant_contains">Merchant Contains String</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-muted block mb-1 font-semibold">Default Action</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['keep', 'sort', 'remove'] as const).map((act) => (
                      <button
                        key={act}
                        type="button"
                        onClick={() => setAction(act)}
                        className={`p-2 border rounded-[4px] uppercase font-mono font-medium ${
                          action === act
                            ? 'border-ink bg-paper font-bold text-ink'
                            : 'border-line text-muted'
                        }`}
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>

                {action === 'sort' && (
                  <div>
                    <label className="text-muted block mb-1 font-semibold">
                      Destination Folder or Category
                    </label>
                    <select
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full border border-line bg-paper text-ink p-2 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      <option value="">Select Destination...</option>
                      {destinations.map((d) => (
                        <option key={d.id} value={d.key}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-line mt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-2 border border-line text-muted hover:text-ink rounded-[4px] focus-visible:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-ink text-surface rounded-[4px] font-semibold hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
