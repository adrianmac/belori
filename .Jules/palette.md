## 2026-04-23 - [Add ARIA labels to modal close buttons]
**Learning:** Icon-only buttons without `aria-label` are a common accessibility issue. Found multiple instances of close ('×') buttons in modals lacking proper labels.
**Action:** Replaced `<button ...>×</button>` with `<button ... aria-label="Close"><span aria-hidden="true">×</span></button>` globally across components to improve screen reader experience.
