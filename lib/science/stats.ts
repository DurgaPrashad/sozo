export function descriptiveStatistics(input: string) {
  const pieces = input
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (pieces.length < 2 || pieces.length > 10000)
    throw new Error("Enter between 2 and 10,000 numbers.");
  const values = pieces.map(Number);
  if (values.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e100))
    throw new Error(
      "Use finite numeric values separated by commas, spaces, or new lines.",
    );
  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const mean = values.reduce((a, b) => a + b / count, 0);
  const variance = values.reduce(
    (a, b) => a + (b - mean) ** 2 / (count - 1),
    0,
  );
  return {
    count,
    mean,
    median:
      count % 2
        ? sorted[(count - 1) / 2]
        : (sorted[count / 2 - 1] + sorted[count / 2]) / 2,
    min: sorted[0],
    max: sorted[count - 1],
    sampleStandardDeviation: Math.sqrt(variance),
    method: "Descriptive statistics; sample standard deviation uses n − 1.",
    input: values,
    computedAt: new Date().toISOString(),
  };
}
