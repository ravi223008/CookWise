---
name: Metro cache stale file issue
description: Metro bundler caches files aggressively; after a syntax-error fix, it may keep serving the old broken bundle.
---

**Rule:** After fixing a syntax error in an Expo/Metro project, always clear the Metro disk cache before restarting the workflow.

**Why:** Metro caches transformed files to disk. If a syntax error was present during a previous bundle attempt, Metro may serve the stale bad transform even after the file is corrected on disk. The symptom is "same error persists after file fix".

**How to apply:**
```bash
rm -rf /tmp/metro-* ~/.metro 2>/dev/null
```
Then restart the Expo workflow. Verify by curling the bundle endpoint and checking the first 300 chars for `var __BUNDLE_START_TIME__` (success) vs `{"type":"TransformError"...` (still broken).
