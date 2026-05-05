
## 2024-05-05 - [Accessibility] Collapsed menus and focus states
**Learning:** For components that expand/collapse visually but remain in the DOM (like FAB menus fanning out via CSS transforms/opacity), simply fading them out is not enough. Screen readers and keyboard navigation still consider them interactable.
**Action:** Use `aria-hidden={!isOpen}` on the container and `tabIndex={isOpen ? 0 : -1}` on internal buttons to explicitly remove them from accessibility trees when they are visually collapsed.
