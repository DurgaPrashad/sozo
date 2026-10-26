export async function api<T = Record<string, any>>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok)
    throw new Error(
      data.error?.message || "Something went wrong. Please try again.",
    );
  return data;
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
