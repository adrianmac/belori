## 2026-06-25 - [Accessible FAB Menus]
**Learning:** Adding `pointerEvents: 'none'` prevents mouse interaction, but actionable elements in collapsed FAB menus (like our fan-out style) are still focusable by keyboard and readable by screen readers if their opacity is 0 or they are translated out of view.
**Action:** When a custom menu or FAB visually hides its children without removing them from the DOM, explicitly apply `aria-hidden={!isOpen}` to the container and `tabIndex={isOpen ? 0 : -1}` to focusable child elements to properly hide them from AT and keyboard users.
