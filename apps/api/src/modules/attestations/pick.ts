/** Атестація свого курсу має пріоритет над спільною (course = 0, для всіх курсів). */
export function pickAttestation<T extends { kind: string; course: number }>(
  rows: readonly T[],
  kind: string,
  course: number,
): T | undefined {
  return (
    rows.find((r) => r.kind === kind && r.course === course) ??
    rows.find((r) => r.kind === kind && r.course === 0)
  );
}
