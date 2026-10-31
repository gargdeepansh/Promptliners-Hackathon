import { FileItem, AppliedOperation, FolderScanOptions } from '../types';

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export interface PickedDirectory {
  handle: FileSystemDirectoryHandle;
  name: string;
  files: FileItem[];
}

export interface ScanProgress {
  count: number;
  currentFolder: string;
}

const DEFAULT_SCAN_OPTIONS: FolderScanOptions = {
  recursive: false,
  maxDepth: 1,
  excludeHidden: true,
  ignoredPatterns: ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.venv'],
};

/**
 * Recursively scans directory entries according to options, emitting progress events.
 */
export async function scanDirectoryEntries(
  dirHandle: FileSystemDirectoryHandle,
  options: Partial<FolderScanOptions> = {},
  onProgress?: (progress: ScanProgress) => void,
  currentDepth: number = 0,
  pathPrefix: string = ''
): Promise<FileItem[]> {
  const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const files: FileItem[] = [];

  for await (const entry of (dirHandle as any).values()) {
    const name = entry.name;

    // Check hidden files
    if (opts.excludeHidden && name.startsWith('.')) {
      continue;
    }

    // Check ignored directory patterns
    if (opts.ignoredPatterns.some((pattern) => name.toLowerCase() === pattern.toLowerCase())) {
      continue;
    }

    if (entry.kind === 'file') {
      const fileHandle = entry as FileSystemFileHandle;
      try {
        const file = await fileHandle.getFile();
        const lastDot = name.lastIndexOf('.');
        const ext = lastDot !== -1 ? name.slice(lastDot).toLowerCase() : '';
        const relPath = pathPrefix ? `${pathPrefix}/${name}` : name;

        files.push({
          id: `file_${relPath}_${file.lastModified}_${file.size}`,
          name: file.name,
          path: relPath,
          size: file.size,
          lastModified: file.lastModified,
          extension: ext,
          handle: fileHandle,
          relativeDepth: currentDepth,
        });

        if (onProgress && files.length % 5 === 0) {
          onProgress({ count: files.length, currentFolder: dirHandle.name });
        }
      } catch {
        // Skip inaccessible file
      }
    } else if (entry.kind === 'directory' && opts.recursive && currentDepth < opts.maxDepth) {
      try {
        const subHandle = entry as FileSystemDirectoryHandle;
        const subFiles = await scanDirectoryEntries(
          subHandle,
          opts,
          onProgress,
          currentDepth + 1,
          pathPrefix ? `${pathPrefix}/${name}` : name
        );
        files.push(...subFiles);
      } catch {
        // Skip inaccessible subfolder
      }
    }
  }

  return files;
}

/**
 * Scans a selected user directory for files. Supports optional recursive scanning.
 * Catches protected folder security rejections and returns a user-friendly message.
 */
export async function pickAndScanDirectory(
  options: Partial<FolderScanOptions> = {},
  onProgress?: (progress: ScanProgress) => void
): Promise<PickedDirectory> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser.');
  }

  let dirHandle: FileSystemDirectoryHandle;
  try {
    dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
    const msg = (err.message || '').toLowerCase();
    if (
      err.name === 'SecurityError' ||
      msg.includes('sensitive') ||
      msg.includes('protected') ||
      msg.includes('permission')
    ) {
      throw new Error(
        'This folder is protected by your system or browser. Please pick a subfolder or make a new folder and copy files into it.'
      );
    }
    throw err;
  }

  const files = await scanDirectoryEntries(dirHandle, options, onProgress);

  return {
    handle: dirHandle,
    name: dirHandle.name,
    files,
  };
}

/**
 * Detects duplicate file candidates based on identical byte sizes and extensions.
 */
export function detectDuplicateFiles(files: FileItem[]): {
  duplicateGroups: Map<string, FileItem[]>;
  duplicateItems: FileItem[];
  annotatedFiles: FileItem[];
} {
  const sizeMap: Map<string, FileItem[]> = new Map();

  for (const file of files) {
    // Only compare files with non-zero size
    if (file.size > 0) {
      const key = `${file.size}_${file.extension.toLowerCase()}`;
      if (!sizeMap.has(key)) {
        sizeMap.set(key, []);
      }
      sizeMap.get(key)!.push(file);
    }
  }

  const duplicateGroups: Map<string, FileItem[]> = new Map();
  const duplicateSet = new Set<string>();

  for (const [key, group] of sizeMap.entries()) {
    if (group.length > 1) {
      duplicateGroups.set(key, group);
      group.forEach((f) => duplicateSet.add(f.id));
    }
  }

  const annotatedFiles = files.map((file) => {
    if (duplicateSet.has(file.id)) {
      return {
        ...file,
        isDuplicate: false,
        possibleDuplicate: true,
        duplicateGroupKey: `${file.size}_${file.extension.toLowerCase()}`,
      };
    }
    return file;
  });

  const duplicateItems = annotatedFiles.filter((f) => f.isDuplicate);

  return {
    duplicateGroups,
    duplicateItems,
    annotatedFiles,
  };
}

/**
 * Generates collision-free filename by adding numeric suffix e.g. "report (1).pdf".
 */
export async function resolveUniqueFileName(
  targetDirHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<string> {
  const lastDot = fileName.lastIndexOf('.');
  const baseName = lastDot !== -1 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot !== -1 ? fileName.slice(lastDot) : '';

  let candidate = fileName;
  let suffix = 1;

  while (true) {
    try {
      await targetDirHandle.getFileHandle(candidate, { create: false });
      // File exists, bump suffix
      candidate = `${baseName} (${suffix})${ext}`;
      suffix++;
    } catch {
      // File does not exist, safe to use candidate name
      return candidate;
    }
  }
}

/** Restrict destination names to one safe child of the user-selected root. */
function safeFolderName(name: string): string {
  if (!name || name === '.' || name === '..' || /[\\/\x00-\x1f]/.test(name) || name.includes('..')) {
    throw new Error('Unsafe destination folder name.');
  }
  return name;
}

async function sourceDirectory(root: FileSystemDirectoryHandle, relativePath: string) {
  const parts = relativePath.split('/');
  const name = parts.pop()!;
  if (!name || parts.some(p => !p || p === '.' || p === '..')) throw new Error('Invalid relative file path.');
  let parent = root;
  for (const part of parts) parent = await parent.getDirectoryHandle(part, { create: false });
  return { parent, name };
}

/** Constant-memory content comparison using SHA-256 on modest files and byte-stream comparison for larger files. */
async function equalFiles(a: File, b: File): Promise<boolean> {
  if (a.size !== b.size) return false;
  // Compare bounded chunks to avoid loading very large files into memory.
  const chunk = 1024 * 1024;
  for (let offset = 0; offset < a.size; offset += chunk) {
    const [left, right] = await Promise.all([
      a.slice(offset, offset + chunk).arrayBuffer(),
      b.slice(offset, offset + chunk).arrayBuffer(),
    ]);
    const x = new Uint8Array(left), y = new Uint8Array(right);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  }
  return true;
}

/** Uses copy, verifies every byte, and only then removes the source. */
async function verifiedCopyAndRemove(
  source: FileSystemFileHandle,
  sourceDir: FileSystemDirectoryHandle,
  sourceName: string,
  destDir: FileSystemDirectoryHandle,
  targetName: string
) {
  const src = await source.getFile();
  const dest = await destDir.getFileHandle(targetName, { create: true });
  try {
    const writable = await dest.createWritable();
    await src.stream().pipeTo(writable);
    if (!await equalFiles(src, await dest.getFile())) throw new Error('Copied content failed integrity verification');
    await sourceDir.removeEntry(sourceName);
  } catch (err) {
    // Do not delete an existing destination after an uncertain failure; targetName is collision-free.
    try { await destDir.removeEntry(targetName); } catch { /* retain for manual recovery */ }
    throw err;
  }
}

export async function safelyMoveFile(
  rootDirHandle: FileSystemDirectoryHandle,
  fileItem: FileItem,
  destinationFolder: string
): Promise<AppliedOperation> {
  const folder = safeFolderName(destinationFolder);
  const operation: AppliedOperation = {
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: 'file_move', sourceName: fileItem.name, sourcePath: fileItem.path || fileItem.name,
    destFolder: folder, reverted: false,
  };
  if (!fileItem.handle) {
    operation.resolvedName = fileItem.name;
    return operation;
  }
  const { parent, name } = await sourceDirectory(rootDirHandle, fileItem.path || fileItem.name);
  const source = await parent.getFileHandle(name, { create: false });
  const target = await rootDirHandle.getDirectoryHandle(folder, { create: true });
  const targetName = await resolveUniqueFileName(target, fileItem.name);
  operation.resolvedName = targetName;
  // Verified copy-first prevents deleting the wrong file after a move fails.
  await verifiedCopyAndRemove(source, parent, name, target, targetName);
  return operation;
}

export async function safelyRevertFileMove(
  rootDirHandle: FileSystemDirectoryHandle,
  operation: AppliedOperation
): Promise<void> {
  if (!operation.sourceName || !operation.destFolder || !operation.resolvedName) return;
  const sourcePath = operation.sourcePath || operation.sourceName;
  const { parent, name } = await sourceDirectory(rootDirHandle, sourcePath);
  const movedDir = await rootDirHandle.getDirectoryHandle(safeFolderName(operation.destFolder), { create: false });
  const moved = await movedDir.getFileHandle(operation.resolvedName, { create: false });
  const restoredName = await resolveUniqueFileName(parent, name);
  await verifiedCopyAndRemove(moved, movedDir, operation.resolvedName, parent, restoredName);
}

/** Content-verified duplicate detection, opt-in because hashing files can take time. */
export async function verifyDuplicateCandidates(files: FileItem[]): Promise<Map<string, FileItem[]>> {
  const candidates = detectDuplicateFiles(files).duplicateGroups;
  const confirmed = new Map<string, FileItem[]>();
  for (const [key, group] of candidates) {
    const byDigest = new Map<string, FileItem[]>();
    for (const item of group) {
      if (!item.handle) continue;
      const bytes = await (await item.handle.getFile()).arrayBuffer();
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      const digest = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
      const k = `${key}_${digest}`;
      byDigest.set(k, [...(byDigest.get(k) || []), item]);
    }
    for (const [k, value] of byDigest) if (value.length > 1) confirmed.set(k, value);
  }
  return confirmed;
}

/**
 * Removes destination folders created by Sortie if they are empty after a revert.
 */
export async function cleanupEmptyDestinationFolders(
  rootDirHandle: FileSystemDirectoryHandle,
  folderNames: string[]
): Promise<void> {
  for (const folderName of folderNames) {
    try {
      const dirHandle = await rootDirHandle.getDirectoryHandle(folderName, { create: false });
      let isEmpty = true;
      for await (const _entry of (dirHandle as any).values()) {
        isEmpty = false;
        break;
      }
      if (isEmpty) {
        await rootDirHandle.removeEntry(folderName);
      }
    } catch {
      // Ignore if folder does not exist or removal fails
    }
  }
}
