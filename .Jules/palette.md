## 2024-06-16 - Add missing focus styles to mirror hover states

**Learning:** When using inline styles for `onMouseEnter` and `onMouseLeave`, equivalent `onFocus` and `onBlur` handlers are often forgotten. This breaks keyboard accessibility because users tabbed into the component see no visual feedback. Additionally, naive implementations of `onMouseLeave` can inadvertently clear styles even while the element remains keyboard-focused (e.g. clicking the element and then moving the mouse away).
**Action:** When working with inline hover effects in this project, always add matching `onFocus` and `onBlur` handlers, and verify that `onMouseLeave` contains an active element safeguard (e.g., `if (document.activeElement !== e.currentTarget)`).
