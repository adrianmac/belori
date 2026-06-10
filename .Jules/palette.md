## 2024-06-10 - Add aria-label to missing × buttons
**Learning:** Icon-only close buttons lacking aria-label make modal navigation inaccessible to screen readers.
**Action:** Adding `aria-label="Close"` and `title="Close"` across all instances.
## 2024-06-10 - Semantic buttons for inline actions & Missing ARIA labels
**Learning:** Found non-semantic `<span>` tags acting as interactive actions in `AlertBanner` without focus states, and `ModeIndicatorBtn` missing `aria-label`. Converts inline actions to buttons with explicit hover/focus visible state to make them fully keyboard accessible.
**Action:** Use semantic `<button>` tags with hover/focus handlers explicitly updating inline styles, rather than `<span>`. Ensure all icon-only buttons receive `aria-label` matching their `title`.
