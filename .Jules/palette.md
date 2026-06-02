## 2026-04-19 - [Added ARIA Labels to Modal Close Buttons]
**Learning:** Found an accessibility issue pattern specific to this app's components: Modal close buttons across the 'src/components/modals/' directory were consistently missing an aria-label, which makes them inaccessible to screen readers as they are just icon-only buttons with '×'.
**Action:** Adding `aria-label="Close"` to these buttons provides necessary context for screen reader users.
