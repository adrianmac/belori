## 2025-02-12 - Added ARIA label to Alerts button
**Learning:** The application has a pattern of using `title` attributes on buttons, but occasionally misses `aria-label` on pure icon buttons (like the Alerts bell in Sidebar). `title` provides a tooltip but isn't always sufficient for all screen readers depending on configuration.
**Action:** Always add explicit `aria-label` to icon-only buttons, even if a `title` is present, to guarantee robust accessibility.
