💡 **What:** Wrapped derived arrays and aggregation reductions (`filtered`, `totalOverdue`, `totalPending`) in `useMemo` hooks in `Payments.jsx` and `ModuleStubs.jsx`.

🎯 **Why:** These complex map/reduce/filter operations were executing on every re-render (which happen frequently during text input or modal toggling), causing UI lag. Since the underlying payment and status variables change less frequently than other UI states, memoizing them prevents wasteful re-evaluation.

📊 **Impact:** Reduces main-thread blocking time significantly during fast state updates (like typing in search fields), limiting array allocations and computation loops on long payment arrays.

🔬 **Measurement:** Verify by typing in the client search bar on the Payments or Accounting pages and observing improved input latency. No functionality is changed.
