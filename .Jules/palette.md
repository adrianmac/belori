## 2024-05-18 - [QuickActionFAB Accessibility Improvements]
**Learning:** Collapsed FAB menus built with opacity/transform animations remain in the DOM and are fully accessible to screen readers and keyboard navigation (tabbing), creating a confusing experience where users can interact with invisible elements.
**Action:** Always apply `tabIndex={open ? 0 : -1}` to actionable elements inside purely visually hidden containers, and use `aria-hidden={!open}` alongside `aria-controls`/`aria-haspopup` on the toggle button to properly signal the menu state to assistive technologies.
