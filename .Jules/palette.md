## 2026-05-02 - Modal Close Button Accessibility
**Learning:** Found a widespread pattern across the app's modal components where icon-only (`×`) close buttons were missing `aria-label` attributes. This makes them completely invisible to screen readers, violating a core accessibility principle for semantic UI elements.
**Action:** Always ensure that icon-only interactive elements (like standard close buttons in modals) include descriptive `aria-label`s (e.g., `aria-label="Close"`).
