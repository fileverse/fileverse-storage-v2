// Monotonic elapsed-time helper for latency logging.
//
// hrtime is unaffected by wall-clock adjustments, and passing the start mark
// explicitly keeps each measurement local to its own call. console.time cannot
// be used for request timing: its labels are process-global, so two concurrent
// requests using the same label overwrite each other's start mark and report
// meaningless durations.
export const startMark = () => process.hrtime.bigint();

export const elapsedMs = (mark: bigint) =>
  Math.round(Number(process.hrtime.bigint() - mark) / 1e3) / 1e3;
