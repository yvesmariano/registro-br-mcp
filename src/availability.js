export const AVAILABILITY_BASE_URL = "https://registro.br/v2/ajax/avail/raw";

export const AVAILABILITY_STATUS_LABELS = {
  0: "available",
  1: "available",
  2: "registered",
  3: "unavailable",
  4: "invalid query",
  5: "awaiting release process start",
  6: "in release process",
  7: "in release process",
  8: "query failed",
};

export function normalizeDomain(domain) {
  const normalized = String(domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

  if (!normalized) {
    throw new Error("Domain is required");
  }

  return normalized;
}

export function isAvailable(data) {
  return data.status === 0 || data.status === 1;
}

export async function fetchAvailability(domain, { fetchImpl = fetch } = {}) {
  const normalized = normalizeDomain(domain);
  const url = `${AVAILABILITY_BASE_URL}/${encodeURIComponent(normalized)}`;
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Availability request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (typeof data?.status !== "number") {
    throw new Error("Availability request returned an unexpected response");
  }

  return data;
}

export function formatAvailability(data) {
  const lines = [];

  lines.push(`Domain: ${data.fqdn}`);
  lines.push(`Status: ${AVAILABILITY_STATUS_LABELS[data.status] ?? "unknown"} (${data.status})`);
  lines.push(`Available: ${isAvailable(data) ? "yes" : "no"}`);

  if (data["publication-status"]) {
    lines.push(`Publication status: ${data["publication-status"]}`);
  }

  if (data["expires-at"]) {
    lines.push(`Expires at: ${data["expires-at"]}`);
  }

  if (data.exempt) {
    lines.push("Exempt: yes");
  }

  if (data.hosts?.length) {
    lines.push("\nHosts:");
    for (const host of data.hosts) {
      lines.push(`  - ${host}`);
    }
  }

  if (data.suggestions?.length) {
    lines.push("\nSuggested categories:");
    for (const suggestion of data.suggestions) {
      lines.push(`  - ${suggestion}`);
    }
  }

  if (data.reasons?.length) {
    lines.push("\nReasons:");
    for (const reason of data.reasons) {
      lines.push(`  - ${reason}`);
    }
  }

  if (data["begins-at"] || data["ends-at"] || data["accepting-new-tickets-until"]) {
    lines.push("\nRelease process:");
    if (data["begins-at"]) {
      lines.push(`  - begins at: ${data["begins-at"]}`);
    }
    if (data["ends-at"]) {
      lines.push(`  - ends at: ${data["ends-at"]}`);
    }
    if (data["accepting-new-tickets-until"]) {
      lines.push(`  - accepting new tickets until: ${data["accepting-new-tickets-until"]}`);
    }
  }

  return lines.join("\n");
}
