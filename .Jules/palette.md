## 2024-06-18 - [Add missing ARIA labels to close buttons]
**Learning:** Common pattern: `×` close buttons in modals often lack `aria-label="Close"` and `title="Close"`. Screen readers might announce these as "times" or "multiplication sign" without the label.
**Action:** Add `aria-label="Close"` and `title="Close"` to all icon-only close buttons.
