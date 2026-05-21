## 2024-05-24 - Accessibility for standard modal close buttons
**Learning:** Found multiple modals using a plain "×" character inside a standard `<button>` without aria-labels or screen reader text, leaving them inaccessible.
**Action:** Always verify that plain character buttons (like "×" for close, "✏" for edit) have explicit `aria-label`s to ensure they are read out correctly by assistive technologies.
