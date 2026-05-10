## 2024-05-24 - Accessibility: Close buttons missing ARIA labels
**Learning:** Found multiple instances of icon-only '×' modal close buttons missing `aria-label="Close"` in the components directory. This prevents screen readers from understanding the button's purpose.
**Action:** Wrote a simple regex script to automatically add `aria-label="Close"` to all `×` buttons missing an aria-label across all JSX files.
