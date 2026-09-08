// Brand mark for secondary surfaces: a small ink square with the "co"
// abbreviation, set in the interface face. The desk's top bar uses a bare
// square; this keeps the older surfaces' imports working.
export function CoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-md bg-ink font-semibold text-sheet"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5), lineHeight: 1 }}
    >
      co
    </span>
  );
}
