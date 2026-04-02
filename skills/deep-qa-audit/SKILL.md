---
name: deep-qa-audit
description: Run a 6-round deep QA audit on any app — finds and fixes every bug layer by layer. Works for iOS, web, or mobile. RIGID — follow the rounds in order.
user_invocable: true
---

# Deep QA Audit — 6-Round Bug Hunt

**Universal audit framework.** Works on any iOS, web, or mobile app. Each round targets a different bug layer — run them in order. Fix all bugs found in each round before moving to the next.

## Input Required

Ask for:
- **Project path** (the codebase to audit)
- **Platform** (`ios`, `web`, `mobile`)
- **Which rounds to run** (default: all 6)

## The 6 Rounds

```
Round 1 → Round 2 → Round 3 (run twice) → Round 4 → Round 5 → Round 6
```

---

### Round 1: Structural Gaps

**What you're looking for:** Features that don't work at all.

- Dead buttons and stub functions
- TODO/FIXME placeholders left in production code
- Missing cases in switch statements
- Hardcoded values that should be dynamic (thresholds, URLs, keys)
- Features referenced in UI but never implemented
- Functions that return dummy/mock data
- API endpoints called but never wired up
- Missing enum cases causing silent fallthrough

**How to run:**
1. Grep for `TODO`, `FIXME`, `HACK`, `XXX`, `stub`, `placeholder`, `dummy`
2. Search for empty function bodies and functions returning hardcoded values
3. Check all switch statements for missing cases
4. Trace every button/action to its handler — verify it does real work
5. Compare UI promises (onboarding text, settings labels) against actual implementations

**Output:** List every finding with file:line. Fix all before Round 2.

---

### Round 2: Integration Bugs

**What you're looking for:** Things that break when A talks to B.

- API calls with wrong headers, params, or auth tokens
- Data format mismatches between client and server (date formats, JSON keys, enums)
- Auth token handling gaps (missing Bearer prefix, no refresh logic, stale tokens)
- Sync race conditions (concurrent writes, optimistic updates that never reconcile)
- State not clearing on sign-out (tokens, cached data, user preferences)
- Data not persisting across app restarts (in-memory state that should be on disk)
- Callback/delegate chains that break silently
- Error responses not parsed or surfaced to the user

**How to run:**
1. Trace every network call: request construction → response handling → error path
2. Check auth headers on every API call (correct format, token refresh)
3. Verify sign-out clears ALL user state (search for every UserDefaults/localStorage key)
4. Check every async operation for race conditions (concurrent access, missing locks)
5. Verify data persistence: what happens after app restart / page reload?

**Output:** List every finding with file:line. Fix all before Round 3.

---

### Round 3: Data & Display Bugs

**What you're looking for:** Wrong strings, missing fields, edge cases.

- Zero/nil/empty states not handled (division by zero, nil access, empty arrays)
- Wrong number formatting (percentages > 100%, negative values where impossible)
- Labels that don't match their data source
- Date/time edge cases (midnight, timezone boundaries, DST)
- UI showing stale, placeholder, or mock data
- Truncated text, missing units, wrong decimal places
- Localization issues (hardcoded strings that should be localized)
- Conditional UI that doesn't cover all states

**How to run:**
1. Check every computed property and formatter for edge cases (0, nil, empty, max)
2. Verify every label/text matches the data it displays
3. Look for division operations without zero checks
4. Check percentage calculations are clamped to valid ranges
5. Verify empty states have proper UI (not just blank screens)

**IMPORTANT: Run this round TWICE.** The first pass catches obvious issues. Fixing those often reveals a second layer of bugs. The second pass typically finds 40-60% as many bugs as the first.

**Output:** List every finding with file:line. Fix all before Round 4.

---

### Round 4: Crash & Safety

**What you're looking for:** Force unwraps, thread safety, memory leaks.

- **iOS:** `@MainActor` violations on `@Observable`/`@Published` classes, force unwraps (`!`), unsafe continuation access, retain cycles in closures
- **Web:** Unhandled promise rejections, memory leaks in event listeners, XSS vectors, SQL injection, missing input sanitization
- **All platforms:** Unclamped values passed to system APIs, unprotected concurrent mutations, missing Task/Promise cancellation, empty catch blocks swallowing errors

**How to run:**
1. Search for force unwraps, force casts, implicitly unwrapped optionals
2. Check every `@Observable`/`@Published` property is mutated on the correct thread
3. Look for closures capturing `self` without `[weak self]` in long-lived contexts
4. Verify every continuation/callback is called exactly once (not zero, not twice)
5. Check concurrent data structures have proper synchronization (locks, actors, queues)
6. Verify error handling: no empty catch blocks, errors surfaced to user or logged

**Output:** List every finding with file:line and severity (crash/data-corruption/silent-failure). Fix all before Round 5.

---

### Round 5: UX Flow

**What you're looking for:** Dead-end screens, missing loading states, stuck states.

- Screens with no way out (missing back/cancel/close buttons)
- Paywalls or gates with no escape route (no sign-out, no dismiss)
- Flash of wrong content on launch (paywall flash, auth screen flash)
- No loading indicators during async operations
- No error feedback on failures (silent failures, actions that appear to do nothing)
- Missing cancel buttons on overlays, sheets, and modals
- Empty state screens with no guidance (blank screen, no "add your first X" prompt)
- Form validation gaps (submit enabled with invalid data, no inline errors)
- Actions that should be disabled but aren't (double-tap issues, submit while loading)

**How to run:**
1. Map every screen → list all exit paths (back, close, cancel, navigate away)
2. Check every async operation has a loading state AND error state
3. Trace the cold-launch flow: what does the user see at each step?
4. Verify every form validates before submission
5. Check every destructive action has a confirmation dialog
6. Look for buttons that should be disabled during loading/processing

**Output:** List every finding with file:line. Fix all before Round 6.

---

### Round 6: Live Smoke Test

**What you're looking for:** Runtime-only bugs that static code review misses.

- **iOS:** Launch in Simulator using computer use tools. Walk through: cold launch → auth → onboarding → core action → settings → sign out → sign back in.
- **Web:** Launch dev server. Walk through: landing page → signup → onboarding → core action → settings → logout → login.
- **Mobile:** Launch on emulator. Same flow as iOS.

**What to watch for:**
- Animations that glitch or stutter
- State bleeding between screens (error messages persisting, stale data showing)
- Permission prompts appearing at wrong times
- Keyboard covering input fields
- Scroll issues (content hidden behind nav bars, overscroll bounce)
- Dark mode / light mode rendering issues
- Network error handling (toggle airplane mode mid-action)

**How to run:**
1. Take screenshots at each step
2. Try the happy path first, then deliberately trigger edge cases
3. Test both first-launch (no data) and returning-user (with data) flows
4. Try rapid actions (double-tap, quick navigation back-and-forth)

**Output:** Screenshots + descriptions of every runtime bug found. Fix all.

---

## After All Rounds Complete

1. **Store results as memory:**
   ```
   memory_store(
     category="fix",
     title="[App] deep QA audit — [N] bugs fixed",
     content="6-round deep QA completed. [summary of bugs per round]",
     tags=["[slug]", "qa", "deep-audit"],
     project="[slug]"
   )
   ```

2. **Report final scorecard:**

   | Round | Focus | Found | Fixed |
   |-------|-------|-------|-------|
   | 1 | Structural gaps | ? | ? |
   | 2 | Integration bugs | ? | ? |
   | 3a | Data/display | ? | ? |
   | 3b | Data/display (2nd pass) | ? | ? |
   | 4 | Crash & safety | ? | ? |
   | 5 | UX flow | ? | ? |
   | 6 | Live smoke test | ? | ? |
   | **Total** | | **?** | **?** |

## Agent Delegation

Each round can be run as a standalone agent task. When spawning agents, include:
- The specific round's checklist and "how to run" steps
- The project path and tech stack
- Any critical memories from preflight
- Instruction: produce a file:line report, then fix everything found

Rounds 1-5 can be parallelized in pairs (1+4 are independent, 2+5 are independent). Round 3 must run twice sequentially. Round 6 must run last (needs all fixes applied).
