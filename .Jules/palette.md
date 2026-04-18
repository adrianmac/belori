## 2024-05-18 - Component Accessibility
**Learning:** Custom inline actionable elements (like `<span onClick>`) need structural conversion to `<button>` to be accessible via keyboard. Dialogs need their warning/informational text directly linked using `aria-describedby` so screen readers announce it instantly upon opening. Decorative SVG icons inside actions should be hidden with `aria-hidden="true"`.
**Action:** Always verify components like `AlertBanner`, `ModeIndicatorBtn` and `ConfirmModal` for these specific a11y roles during UX enhancements.
