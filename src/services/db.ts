import { LocalRule, PlanItem, ApplyLog, RunSummary } from '../types';

const DB_NAME = 'sortie_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('rules')) {
        db.createObjectStore('rules', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('plan')) {
        db.createObjectStore('plan', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('apply_logs')) {
        db.createObjectStore('apply_logs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// In-memory fallback if IndexedDB fails
const memoryFallback = {
  rules: new Map<string, LocalRule>(),
  plan: new Map<string, PlanItem>(),
  history: new Map<string, RunSummary>(),
  applyLogs: new Map<string, ApplyLog>(),
  settings: new Map<string, any>(),
  handles: new Map<string, any>(),
};

/* --- RULES --- */
export async function getRules(): Promise<LocalRule[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rules', 'readonly');
      const store = tx.objectStore('rules');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return Array.from(memoryFallback.rules.values());
  }
}

export async function saveRule(rule: LocalRule): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rules', 'readwrite');
      const store = tx.objectStore('rules');
      const request = store.put(rule);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    memoryFallback.rules.set(rule.id, rule);
  }
}

export async function deleteRule(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rules', 'readwrite');
      const store = tx.objectStore('rules');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    memoryFallback.rules.delete(id);
  }
}

/* --- PLAN --- */
export async function getCurrentPlan(): Promise<PlanItem[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('plan', 'readonly');
      const store = tx.objectStore('plan');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return Array.from(memoryFallback.plan.values());
  }
}

export async function saveCurrentPlan(items: PlanItem[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('plan', 'readwrite');
      const store = tx.objectStore('plan');
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memoryFallback.plan.clear();
    for (const item of items) {
      memoryFallback.plan.set(item.id, item);
    }
  }
}

export async function clearPlan(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('plan', 'readwrite');
      const store = tx.objectStore('plan');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    memoryFallback.plan.clear();
  }
}

/* --- RUN HISTORY --- */
export async function saveRunSummary(summary: RunSummary): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      const request = store.put(summary);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    memoryFallback.history.set(summary.id, summary);
  }
}

export async function getRunHistory(): Promise<RunSummary[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('history', 'readonly');
      const store = tx.objectStore('history');
      const request = store.getAll();
      request.onsuccess = () => {
        const list: RunSummary[] = request.result || [];
        resolve(list.sort((a, b) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return Array.from(memoryFallback.history.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
}

/* --- APPLY LOGS & UNDO --- */
export async function saveApplyLog(log: ApplyLog): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('apply_logs', 'readwrite');
      const store = tx.objectStore('apply_logs');
      const request = store.put(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    memoryFallback.applyLogs.set(log.id, log);
  }
}

export async function getApplyLogs(): Promise<ApplyLog[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('apply_logs', 'readonly');
      const store = tx.objectStore('apply_logs');
      const request = store.getAll();
      request.onsuccess = () => {
        const list: ApplyLog[] = request.result || [];
        resolve(list.sort((a, b) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return Array.from(memoryFallback.applyLogs.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
}

export async function getLastActiveApplyLog(): Promise<ApplyLog | null> {
  const logs = await getApplyLogs();
  return logs.find((log) => !log.reverted) || null;
}

export async function markApplyLogReverted(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('apply_logs', 'readwrite');
      const store = tx.objectStore('apply_logs');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record: ApplyLog = getReq.result;
        if (record) {
          record.reverted = true;
          record.revertedAt = Date.now();
          store.put(record);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    const log = memoryFallback.applyLogs.get(id);
    if (log) {
      log.reverted = true;
      log.revertedAt = Date.now();
    }
  }
}

/* --- DIRECTORY HANDLES IN INDEXEDDB --- */
export async function saveDirectoryHandle(
  key: string,
  handle: FileSystemDirectoryHandle,
  folderName: string
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      const store = tx.objectStore('handles');
      const request = store.put({ key, handle, folderName, savedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    memoryFallback.handles.set(key, { handle, folderName, savedAt: Date.now() });
  }
}

export async function getStoredDirectoryHandle(
  key: string
): Promise<{ handle: FileSystemDirectoryHandle; folderName: string } | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.handle) {
          resolve({ handle: req.result.handle, folderName: req.result.folderName || '' });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    const res = memoryFallback.handles.get(key);
    return res ? { handle: res.handle, folderName: res.folderName || '' } : null;
  }
}

export async function clearDirectoryHandle(key: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      const store = tx.objectStore('handles');
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.handles.delete(key);
  }
}

/* --- SETTINGS --- */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.value !== undefined) {
          resolve(req.result.value as T);
        } else {
          resolve(defaultValue);
        }
      };
      req.onerror = () => resolve(defaultValue);
    });
  } catch {
    return memoryFallback.settings.has(key) ? memoryFallback.settings.get(key) : defaultValue;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.settings.set(key, value);
  }
}

export async function clearAllLocalData(): Promise<void> {
  try {
    const db = await getDB();
    const stores = ['rules', 'plan', 'history', 'apply_logs', 'settings', 'handles'];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      for (const name of stores) {
        if (db.objectStoreNames.contains(name)) {
          tx.objectStore(name).clear();
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memoryFallback.rules.clear();
    memoryFallback.plan.clear();
    memoryFallback.history.clear();
    memoryFallback.applyLogs.clear();
    memoryFallback.settings.clear();
    memoryFallback.handles.clear();
  }
}
