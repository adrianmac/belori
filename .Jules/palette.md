## 2026-06-19 - Added Close ARIA labels to icon-only modal close buttons
**Learning:** Found multiple instances where the icon-only '×' button to close modals did not have an `aria-label` or `title`, making them inaccessible to screen readers.
**Action:** Used an automated approach to replace `<button ...>×</button>` with `<button aria-label="Close" title="Close" ...>×</button>` across all components and modals.
