## 2024-05-30 - [Quick Action FAB Focus State]
**Learning:** Added `onFocus` and `onBlur` to match `onMouseEnter` and `onMouseLeave` on inline-styled buttons, ensuring keyboard accessibility state styling. Critically, we needed a guard in `onMouseLeave`: `if (document.activeElement !== e.currentTarget)` to prevent the mouse moving away from clearing the style while the element was still keyboard-focused.
**Action:** When replicating hover effects for keyboard users via inline events, always guard `onMouseLeave` checks against `document.activeElement` to prevent conflicting hover/focus states.
