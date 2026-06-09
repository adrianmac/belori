
## 2024-06-11 - [Semantic Buttons for Interactive Divs]
**Learning:** Converting interactive `<div onClick={...}>` elements to semantic `<button>` elements requires careful CSS resetting to maintain visual parity. Browsers apply native margins, paddings, text alignments, borders, and backgrounds to buttons.
**Action:** When converting divs to buttons, always explicitly add inline resets such as `background: 'transparent'`, `border: 'none'`, `width: '100%'`, and `textAlign: 'left'`. Additionally, carefully manage `onMouseEnter` and `onMouseLeave` by integrating focus state (`onFocus`, `onBlur`) so keyboard users see the same visual feedback as mouse users, ensuring `document.activeElement !== e.currentTarget` on mouse leave so focus styles aren't accidentally removed.
