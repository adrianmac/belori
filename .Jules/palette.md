## 2024-05-18 - [Convert List Items to Buttons]
**Learning:** When converting interactive list items (`div onClick`) to accessible `button` elements, the default hover background colors will not trigger when a keyboard user focuses the element.
**Action:** Add `onFocus` and `onBlur` handlers to match the visual states of `onMouseEnter` and `onMouseLeave`. Also ensure `onMouseLeave` checks `if (document.activeElement !== e.currentTarget)` before reverting styles, so focused elements don't incorrectly lose their visual state when the mouse moves away.
