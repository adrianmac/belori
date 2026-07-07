## 2023-10-27 - [FAB Keyboard Accessibility]
**Learning:** Collapsed custom FAB menus might visually hide buttons via opacity and transform, but they remain focusable in the DOM. This causes invisible keyboard traps for users navigating with Tab.
**Action:** Always explicitly apply `aria-hidden={!isOpen}` to the collapsed FAB menu container and set `tabIndex={isOpen ? 0 : -1}` on actionable child elements to align visual hidden state with focusability.
