## 2024-05-24 - Accessibility labels on modals
**Learning:** Found multiple modal close buttons (×) across 32 components without `aria-label="Close"`, hindering screen reader accessibility.
**Action:** Always add `aria-label="Close"` to icon-only close buttons.
