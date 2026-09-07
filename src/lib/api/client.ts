interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json() as T & ErrorEnvelope;
  if (!response.ok) throw new Error(body.error?.message ?? "Request failed.");
  return body;
}
