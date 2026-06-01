
## 2024-06-01 - [QuickActionFAB Accessibility and Keyboard Focus]
**Learning:** Animated, stateful components that hide sub-menus visually using opacity/transform require strict ARIA management (like `aria-hidden` and `tabIndex={-1}`) to truly hide them from assistive technology and prevent ghost tabbing. Keyboard focus indicators must also mirror hover states to ensure consistent user feedback.
**Action:** Always add `onFocus` and `onBlur` alongside `onMouseEnter` and `onMouseLeave`, and ensure `onMouseLeave` does not overwrite the visual focused state if the element is actively focused by checking `document.activeElement`. Ensure `tabIndex` toggle tracks the `isOpen` state for visually hidden interactive elements.
