## 2024-05-15 - [Improve FAB accessibility for screen readers and keyboard users]
**Learning:** Using `pointerEvents: "none"` or `opacity: 0` for collapsed FAB menus is insufficient for accessibility. Without `aria-hidden` and `tabIndex`, screen readers can still read the collapsed menu items and keyboard users can still focus on them.
**Action:** When implementing collapsed menus (like FABs), explicitly toggle `aria-hidden` on the menu container and `tabIndex` on focusable items based on the open state.
