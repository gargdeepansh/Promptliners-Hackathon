# Sortie safety patch (2026-10-31)

## Implemented
- Nested files now carry path-unique IDs; move and undo resolve the original subdirectory rather than treating every file as a root file.
- Moves and undo use a streamed copy and byte-for-byte chunk verification before deleting their source. Existing destination names receive collision-safe suffixes. Folder destinations are restricted to a single child name.
- Equal file sizes/extensions are now annotated as **possible** duplicates, not confirmed duplicates. An opt-in SHA-256 verification helper is provided; it is not yet wired into the user interface. Be aware the hashing helper reads the entire file into memory.
- Scores no longer favor Remove or Sort over Keep.
- AI responses are validated more strictly; unknown cluster IDs are ignored and missing risk fields cause manual-review recommendations.
- API endpoints gained same-origin checks, size limits, basic in-memory per-process request throttling, and generic error responses. This throttle is **not** a distributed production-grade rate limiter; replace with a shared persistent limiter before public deployment.
- Vercel route configuration includes an explicit /api rewrite before its SPA fallback.

## Must verify before real-file use
- Run `npm install`, `npm run lint`, `npm test`, and `npm run build` on a machine with dependency access. Dependency installation was unavailable in the editing environment, so these checks could **not** complete. TypeScript reported missing `vite/client` because node_modules is absent.
- Test nested moves, collision/undo, copy interruption, permission errors, and scan progress in Chrome/Edge against disposable test directories. Do not use valuable originals for initial tests.
- Deploy to Vercel and confirm /api/suggest and /api/chat actually execute with GEMINI_API_KEY configured. Verify the model ID supported by your Gemini account.
- Local Vite development middleware still uses its original request handling; production API hardening primarily affects the serverless endpoints.
- Real multi-instance rate limiting and fully transactional file recovery remain future work.
- Candidate duplicates are deliberately **not** promoted to confirmed duplicates until content hashing is wired into the UI.
