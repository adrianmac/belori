## 2024-06-25 - [Accessibility] Added semantic HTML and ARIA to Sidebar / FAB buttons
**Learning:** Found multiple instances where non-semantic tags (`<span>`, `<div>`) with `onClick` were used instead of `<button>`, and icon-only interactive elements lacking `aria-label`s. Also, stateful toggles like FABs need `aria-expanded` and `aria-haspopup`.
**Action:** When working on Belori UI, check that all interactive elements are semantic `<button>`s with proper inline CSS resets (`background: "none", border: "none"`) and include ARIA labels for accessibility, especially for icon-only actions.
