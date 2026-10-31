import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import {
  isFileSystemAccessSupported,
  pickAndScanDirectory,
  detectDuplicateFiles,
} from '../services/fileSystem';
import {
  parseCSVString,
  extractCSVHeaders,
  SAMPLE_EXPENSES,
} from '../data/sampleExpenses';
import { SAMPLE_FILES } from '../data/sampleFiles';
import { getSetting, setSetting, saveDirectoryHandle } from '../services/db';
import { CurrencyCode, DateFormatOption } from '../utils/formatters';
import { GameMode, FileItem, ExpenseItem } from '../types';
import {
  Folder,
  Receipt,
  AlertCircle,
  ArrowRight,
  Upload,
  Clock,
  DollarSign,
  Sparkles,
  ShieldCheck,
  Copy,
  Zap,
  CheckCircle2,
} from 'lucide-react';

export function PlaySelectPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [pack, setPack] = useState<'files' | 'expenses'>(
    searchParams.get('pack') === 'expenses' ? 'expenses' : 'files'
  );
  const [isSample, setIsSample] = useState<boolean>(searchParams.get('mode') !== 'custom');
  const [gameMode, setGameMode] = useState<GameMode>('smart_cleanup');
  const [duration, setDuration] = useState<30 | 60 | 90>(60);
  const [aiSuggestions, setAiSuggestions] = useState<boolean>(false);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');

  // Custom files state
  const [scannedFiles, setScannedFiles] = useState<FileItem[]>([]);
  const [scannedFolderName, setScannedFolderName] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);

  // Advanced file scanning options
  const [isRecursiveScan, setIsRecursiveScan] = useState<boolean>(false);
  const [scanDepth, setScanDepth] = useState<number>(2);
  const [enableDuplicateDetection, setEnableDuplicateDetection] = useState<boolean>(true);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);

  // Custom expenses state
  const [parsedExpenses, setParsedExpenses] = useState<ExpenseItem[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [dateCol, setDateCol] = useState<string>('');
  const [descCol, setDescCol] = useState<string>('');
  const [amtCol, setAmtCol] = useState<string>('');
  const [useSeparateDebitCredit, setUseSeparateDebitCredit] = useState<boolean>(false);
  const [debitCol, setDebitCol] = useState<string>('');
  const [creditCol, setCreditCol] = useState<string>('');
  const [dateFormat, setDateFormat] = useState<DateFormatOption>('auto');

  const isFSSupported = isFileSystemAccessSupported();

  useEffect(() => {
    getSetting<boolean>('ai_suggestions_enabled', false).then(setAiSuggestions);
  }, []);

  const handleToggleAi = async (checked: boolean) => {
    setAiSuggestions(checked);
    await setSetting('ai_suggestions_enabled', checked);
  };

  const handlePickDirectory = async () => {
    setScanError(null);
    setScanning(true);
    setScanProgress('Selecting and scanning folder...');
    try {
      const result = await pickAndScanDirectory(
        {
          recursive: isRecursiveScan,
          maxDepth: scanDepth,
          excludeHidden: true,
        },
        (prog) => {
          setScanProgress(`Found ${prog.count} files...`);
        }
      );

      if (result.files.length === 0) {
        setScanError('Selected folder contains no immediate accessible files.');
      } else {
        let finalFiles = result.files;
        if (enableDuplicateDetection) {
          const dupRes = detectDuplicateFiles(result.files);
          finalFiles = dupRes.annotatedFiles;
          setDuplicateCount(dupRes.duplicateItems.length);
        }

        setScannedFolderName(result.name);
        setScannedFiles(finalFiles);
        await saveDirectoryHandle('active_run_dir', result.handle, result.name);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const msg = (err.message || '').toLowerCase();
        if (
          err.name === 'SecurityError' ||
          msg.includes('sensitive') ||
          msg.includes('protected')
        ) {
          setScanError(
            'This folder is protected by your system or browser. Please pick a subfolder or make a new folder and copy files into it.'
          );
        } else {
          setScanError(err.message || 'Failed to access directory.');
        }
      }
    } finally {
      setScanning(false);
      setScanProgress('');
    }
  };

  const reparseCSV = (
    text: string,
    dCol: string,
    deCol: string,
    aCol: string,
    isSeparate: boolean,
    debCol: string,
    credCol: string,
    df: DateFormatOption
  ) => {
    if (!text) return;
    try {
      const parsed = parseCSVString(text, {
        dateCol: dCol,
        descCol: deCol,
        amountCol: aCol,
        debitCol: isSeparate ? debCol : undefined,
        creditCol: isSeparate ? credCol : undefined,
        dateFormat: df,
      });
      setParsedExpenses(parsed);
      setScanError(null);
    } catch (err: any) {
      setScanError(err.message || 'Failed to parse CSV file.');
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setScanError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvRawText(text);

      const headers = extractCSVHeaders(text);
      setCsvHeaders(headers);

      const lowerHeaders = headers.map((h) => h.toLowerCase());
      const dateIdx = lowerHeaders.findIndex((h) => h.includes('date') || h.includes('time'));
      const descIdx = lowerHeaders.findIndex(
        (h) =>
          h.includes('desc') ||
          h.includes('merchant') ||
          h.includes('name') ||
          h.includes('payee') ||
          h.includes('memo')
      );
      const amtIdx = lowerHeaders.findIndex(
        (h) => h.includes('amount') || h.includes('total') || h.includes('sum')
      );

      const debitIdx = lowerHeaders.findIndex((h) => h.includes('debit') || h.includes('spent'));
      const creditIdx = lowerHeaders.findIndex(
        (h) => h.includes('credit') || h.includes('deposit') || h.includes('refund')
      );

      const initialDate = dateIdx !== -1 ? headers[dateIdx] : headers[0] || '';
      const initialDesc = descIdx !== -1 ? headers[descIdx] : headers[1] || '';
      const initialAmt = amtIdx !== -1 ? headers[amtIdx] : headers[2] || '';

      const hasSeparate = debitIdx !== -1 && creditIdx !== -1;
      setUseSeparateDebitCredit(hasSeparate);

      const initialDeb = debitIdx !== -1 ? headers[debitIdx] : '';
      const initialCred = creditIdx !== -1 ? headers[creditIdx] : '';

      setDateCol(initialDate);
      setDescCol(initialDesc);
      setAmtCol(initialAmt);
      setDebitCol(initialDeb);
      setCreditCol(initialCred);

      if (headers.length > 0) {
        reparseCSV(
          text,
          initialDate,
          initialDesc,
          initialAmt,
          hasSeparate,
          initialDeb,
          initialCred,
          dateFormat
        );
      }
    };
    reader.readAsText(file);
  };

  const handleStartRun = () => {
    const runState: any = {
      isSampleData: isSample,
      mode: gameMode,
      durationSeconds: duration,
      aiSuggestionsEnabled: aiSuggestions,
      currency,
      dateFormat,
    };

    if (pack === 'files') {
      if (!isSample) {
        runState.customFiles = scannedFiles;
        runState.folderName = scannedFolderName;
      } else {
        if (enableDuplicateDetection) {
          const dupRes = detectDuplicateFiles(SAMPLE_FILES);
          runState.customFiles = dupRes.annotatedFiles;
        }
      }
      navigate('/play/files', { state: runState });
    } else {
      if (!isSample) {
        runState.customExpenses = parsedExpenses;
        runState.csvFileName = csvFileName;
      }
      navigate('/play/expenses', { state: runState });
    }
  };

  const canStart =
    isSample ||
    (pack === 'files' && scannedFiles.length > 0) ||
    (pack === 'expenses' && parsedExpenses.length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Header isSampleData={isSample} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Configure Run</h1>
          <p className="text-xs text-muted mt-1">
            Choose a pack, triage mode, and source data before starting.
          </p>
        </div>

        {/* Pack Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setPack('files')}
            className={`p-5 text-left border rounded-[6px] transition-all flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
              pack === 'files'
                ? 'border-ink bg-surface shadow-xs'
                : 'border-line bg-paper hover:bg-surface text-muted'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Folder
                className={`w-5 h-5 ${pack === 'files' ? 'text-accent-teal' : 'text-muted'}`}
              />
              <span className="font-mono text-xs text-muted">A local folder</span>
            </div>
            <div>
              <div className="font-bold text-sm text-ink">Files Pack</div>
              <div className="text-xs text-muted mt-1 leading-relaxed">
                Connect a folder to organize downloads, documents, installers, and screenshots into structured subfolders.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPack('expenses')}
            className={`p-5 text-left border rounded-[6px] transition-all flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
              pack === 'expenses'
                ? 'border-ink bg-surface shadow-xs'
                : 'border-line bg-paper hover:bg-surface text-muted'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Receipt
                className={`w-5 h-5 ${pack === 'expenses' ? 'text-accent-orange' : 'text-muted'}`}
              />
              <span className="font-mono text-xs text-muted">Bank CSV statement</span>
            </div>
            <div>
              <div className="font-bold text-sm text-ink">Expenses Pack</div>
              <div className="text-xs text-muted mt-1 leading-relaxed">
                Import CSV bank records to categorize spending, detect recurring subscriptions, and export clean accounting sheets.
              </div>
            </div>
          </button>
        </div>

        {/* Triage Mode Selection: Smart Cleanup vs Speed Challenge */}
        <div className="border border-line bg-surface rounded-[6px] p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold text-ink">Select Triage Mode</h2>
            <p className="text-xs text-muted mt-0.5">
              Choose between relaxed, high-quality review or high-energy timed sessions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGameMode('smart_cleanup')}
              className={`p-4 border rounded-[6px] text-left transition-all flex flex-col gap-2 focus-visible:outline-none ${
                gameMode === 'smart_cleanup'
                  ? 'border-accent-teal bg-accent-teal/5 text-ink'
                  : 'border-line bg-paper text-muted hover:border-ink/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-ink flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-teal" />
                  <span>Smart Cleanup Mode</span>
                </span>
                <span className="font-mono text-[10px] text-accent-teal font-semibold px-1.5 py-0.2 rounded-[2px] bg-accent-teal/10">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Untimed. Review clusters carefully with deep AI insights, confidence scores, and ability to skip and revisit cards.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setGameMode('speed_challenge')}
              className={`p-4 border rounded-[6px] text-left transition-all flex flex-col gap-2 focus-visible:outline-none ${
                gameMode === 'speed_challenge'
                  ? 'border-ink bg-surface text-ink'
                  : 'border-line bg-paper text-muted hover:border-ink/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-ink flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-accent-orange" />
                  <span>Speed Challenge Mode</span>
                </span>
                <span className="font-mono text-[10px] text-muted border border-line px-1.5 py-0.2 rounded-[2px] bg-paper">
                  Timed
                </span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Fast-paced timed run. Earn combo multipliers for rapid decisions within 2 seconds. Never destroys files during play.
              </p>
            </button>
          </div>

          {/* Time Limit Selector (for Speed Challenge) */}
          {gameMode === 'speed_challenge' && (
            <div className="flex items-center justify-between pt-3 border-t border-line text-xs">
              <span className="font-medium text-ink flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted" />
                <span>Session Duration</span>
              </span>
              <div className="flex items-center gap-1.5">
                {([30, 60, 90] as const).map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setDuration(secs)}
                    className={`px-3 py-1 text-xs font-mono font-bold rounded-[4px] border transition-colors ${
                      duration === secs
                        ? 'bg-ink text-surface border-ink'
                        : 'bg-paper text-muted border-line hover:text-ink'
                    }`}
                  >
                    {secs}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Data Source Configuration */}
        <div className="border border-line bg-surface rounded-[6px] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Source Data</h2>
              <p className="text-xs text-muted mt-0.5">
                Use deterministic simulated data or connect your real files.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-paper p-1 border border-line rounded-[5px]">
              <button
                type="button"
                onClick={() => setIsSample(true)}
                className={`px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                  isSample ? 'bg-surface text-ink shadow-xs font-semibold' : 'text-muted hover:text-ink'
                }`}
              >
                Sample Data
              </button>
              <button
                type="button"
                onClick={() => setIsSample(false)}
                className={`px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                  !isSample ? 'bg-surface text-ink shadow-xs font-semibold' : 'text-muted hover:text-ink'
                }`}
              >
                Custom Data
              </button>
            </div>
          </div>

          {/* Sample Mode Notice */}
          {isSample ? (
            <div className="p-4 bg-paper border border-line rounded-[6px] text-xs text-muted leading-relaxed flex flex-col gap-2">
              <div className="flex items-center gap-2 text-ink font-semibold">
                <Sparkles className="w-4 h-4 text-accent-teal" />
                <span>Deterministic Seed Dataset Loaded</span>
              </div>
              <p>
                {pack === 'files'
                  ? `Seeded with ${SAMPLE_FILES.length} real sample files including PDFs, screenshots, logs, installers, and duplicate candidates.`
                  : `Seeded with ${SAMPLE_EXPENSES.length} real sample bank transactions with Netflix, Spotify, whole foods, and recurring cadence detection.`}
              </p>
            </div>
          ) : (
            /* Custom Data Setup */
            <div className="flex flex-col gap-4">
              {pack === 'files' ? (
                /* Files custom folder setup */
                <div className="flex flex-col gap-4">
                  {!isFSSupported ? (
                    <div className="p-4 bg-paper border border-accent-red/30 rounded-[6px] text-xs text-accent-red">
                      The File System Access API is supported in Chromium browsers (Chrome, Edge, Brave, Opera). Safari and Firefox do not currently support direct folder access.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-paper border border-line rounded-[6px]">
                        <div>
                          <div className="text-xs font-semibold text-ink">
                            {scannedFolderName ? (
                              <span>Folder: <code className="font-mono">{scannedFolderName}</code></span>
                            ) : (
                              <span>No folder selected yet</span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5 font-mono">
                            {scannedFiles.length > 0 ? (
                              <span>
                                {scannedFiles.length} files detected
                                {duplicateCount > 0 && ` (${duplicateCount} duplicate candidates)`}
                              </span>
                            ) : (
                              <span>Pick any folder on your device</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handlePickDirectory}
                          disabled={scanning}
                          className="px-3.5 py-1.5 bg-ink text-surface rounded-[5px] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity focus-visible:outline-none shrink-0"
                        >
                          {scanning ? (scanProgress || 'Scanning...') : 'Choose Folder'}
                        </button>
                      </div>

                      {/* Advanced Folder Options */}
                      <div className="p-3 bg-paper/50 border border-line rounded-[6px] flex flex-col gap-2.5 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-ink">
                          <input
                            type="checkbox"
                            checked={isRecursiveScan}
                            onChange={(e) => setIsRecursiveScan(e.target.checked)}
                            className="w-3.5 h-3.5 accent-ink rounded-[2px]"
                          />
                          <span>Recursive subfolder scan (include nested subdirectories)</span>
                        </label>

                        {isRecursiveScan && (
                          <div className="flex items-center gap-2 pl-5 text-[11px] text-muted">
                            <span>Max Depth:</span>
                            {[1, 2, 3].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setScanDepth(d)}
                                className={`px-2 py-0.5 border rounded-[3px] font-mono ${
                                  scanDepth === d
                                    ? 'bg-ink text-surface border-ink'
                                    : 'bg-paper text-muted border-line'
                                }`}
                              >
                                {d} level{d === 1 ? '' : 's'}
                              </button>
                            ))}
                          </div>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-ink">
                          <input
                            type="checkbox"
                            checked={enableDuplicateDetection}
                            onChange={(e) => setEnableDuplicateDetection(e.target.checked)}
                            className="w-3.5 h-3.5 accent-ink rounded-[2px]"
                          />
                          <span>Detect duplicate file candidates (staged size + extension match)</span>
                        </label>
                      </div>

                      {scanError && (
                        <div className="p-3 bg-paper border border-accent-red/30 rounded-[6px] text-xs text-accent-red flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{scanError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Expenses custom CSV upload */
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-paper border border-line rounded-[6px] flex flex-col items-center justify-center gap-2.5 text-center">
                    <Upload className="w-6 h-6 text-muted" />
                    <div className="text-xs text-ink font-semibold">
                      {csvFileName || 'Upload bank transaction CSV'}
                    </div>
                    <label className="px-3.5 py-1.5 bg-ink text-surface rounded-[5px] text-xs font-semibold cursor-pointer hover:opacity-90">
                      <span>Select CSV File</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleCSVUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* CSV Column Mapper */}
                  {csvHeaders.length > 0 && (
                    <div className="p-4 border border-line rounded-[6px] bg-paper/60 flex flex-col gap-3 text-xs">
                      <span className="font-bold text-ink">Column Mapping</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-muted">Date Column</label>
                          <select
                            value={dateCol}
                            onChange={(e) => {
                              setDateCol(e.target.value);
                              reparseCSV(csvRawText, e.target.value, descCol, amtCol, useSeparateDebitCredit, debitCol, creditCol, dateFormat);
                            }}
                            className="px-2 py-1.5 bg-surface border border-line rounded-[4px] text-ink"
                          >
                            {csvHeaders.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-muted">Description Column</label>
                          <select
                            value={descCol}
                            onChange={(e) => {
                              setDescCol(e.target.value);
                              reparseCSV(csvRawText, dateCol, e.target.value, amtCol, useSeparateDebitCredit, debitCol, creditCol, dateFormat);
                            }}
                            className="px-2 py-1.5 bg-surface border border-line rounded-[4px] text-ink"
                          >
                            {csvHeaders.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-muted">Amount Column</label>
                          <select
                            value={amtCol}
                            onChange={(e) => {
                              setAmtCol(e.target.value);
                              reparseCSV(csvRawText, dateCol, descCol, e.target.value, useSeparateDebitCredit, debitCol, creditCol, dateFormat);
                            }}
                            className="px-2 py-1.5 bg-surface border border-line rounded-[4px] text-ink"
                          >
                            {csvHeaders.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Currency & AI Suggestions Settings */}
        <div className="border border-line bg-surface rounded-[6px] p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-ink">Preferences</h2>

          {/* Currency Select */}
          {pack === 'expenses' && (
            <div className="flex items-center justify-between text-xs border-b border-line pb-3">
              <span className="font-medium text-ink flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-muted" />
                <span>Display Currency</span>
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="px-2.5 py-1 text-xs font-mono bg-paper border border-line rounded-[4px] text-ink"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          )}

          {/* AI Decision Suggestions Toggle */}
          <div className="flex items-start justify-between gap-4 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-ink flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent-teal" />
                <span>Gemini Decision Suggestions</span>
              </span>
              <p className="text-[11px] text-muted leading-relaxed">
                Sends cluster summaries (labels and sample filenames) to Gemini 3.8 Flash to propose Keep, Sort, or Remove actions with structured reasoning. No financial amounts or document contents are transmitted.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={aiSuggestions}
                onChange={(e) => handleToggleAi(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-paper peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted peer-checked:after:bg-surface after:border-line after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-ink border border-line" />
            </label>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-xs text-muted hover:text-ink underline"
          >
            Back to Dashboard
          </button>

          <button
            type="button"
            onClick={handleStartRun}
            disabled={!canStart}
            className="px-6 py-2.5 bg-ink text-surface rounded-[6px] text-xs font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <span>Start {gameMode === 'smart_cleanup' ? 'Smart Cleanup' : 'Speed Challenge'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
