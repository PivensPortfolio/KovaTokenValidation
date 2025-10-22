# Code Cleanup Analysis

Review the current repository and identify where the code can be cleaned up.

Do not include code, pseudocode, or invented names. Refer only to actual files/functions you find.
Keep your response concise and action-oriented.

## What to deliver (use these headings):

### Top Cleanup Opportunities (bullet list)
Short bullets naming the highest-impact areas to simplify or remove.

### Repeated Patterns to Consolidate
List recurring patterns/utilities/components that could be unified into a single reusable unit. Mention the exact locations where they recur.

### Duplication & Dead Code
Call out duplicated logic, unused files/exports, legacy flags, or unreachable branches. Provide exact locations.

### Complexity Hotspots
Identify oversized files/functions, deeply nested conditionals, or scattered state handling. Name the files/functions and why they're risky.

### State & Messaging Hygiene
Note places where state is duplicated, mutated from multiple locations, or where message/event handling is scattered. Point to the exact modules involved.

### Naming & Structure Inconsistencies
List unclear or inconsistent names, folder structures, or component boundaries that hinder readability. Reference the real items.

### Quick Wins (≤1 hour each)
A short, ordered checklist of small, low-risk cleanups (rename, move, delete, consolidate).

### High-Impact Refactors (safe, behavior-neutral)
A short list of larger but still behavior-neutral consolidations (e.g., unify handlers, centralize helpers, merge similar components). Cite exact targets.

### Risk Notes
Note any areas where cleanup might break behavior and what to watch for during verification.

### Verification Checklist (no code)
Step-by-step manual checks to ensure behavior didn't change after cleanup (what to open, what to click, what to confirm).

## Tone
Be precise, factual, and brief. No code, no guesses—use only names and locations that actually exist in the repo.