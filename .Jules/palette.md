## 2026-07-11 - [FAB Keyboard Focus Fix]
**Learning:** Using `opacity` and `transform` to visually hide action buttons inside a FAB leaves them accessible via keyboard (Tab) and screen reader.
**Action:** When hiding a FAB menu, ensure the container has `aria-hidden={!isOpen}` and action buttons have `tabIndex={isOpen ? 0 : -1}` to prevent ghost keyboard focus and screen reader visibility.
