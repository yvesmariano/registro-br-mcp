export const PRICE_POLICY_BASE_URL = "https://registro.br/v2/ajax/payment/policy";

export const DEFAULT_PRICE_YEARS = 1;
export const MIN_YEARS_BY_TLD = { "nom.br": 3 };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function normalizeTld(input) {
  const value = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\.+/, "")
    .replace(/\.$/, "");

  if (!value) {
    throw new Error("TLD is required");
  }

  const labels = value.split(".").filter(Boolean);
  return labels.slice(-2).join(".");
}

export function priceYears(tld, years = DEFAULT_PRICE_YEARS) {
  const requested = Number(years);

  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Years must be a positive integer");
  }

  return Math.max(requested, MIN_YEARS_BY_TLD[tld] ?? 1);
}

function readXsrfToken(response) {
  const cookies =
    typeof response.headers?.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers?.get("set-cookie")].filter(Boolean);

  for (const cookie of cookies) {
    const match = /(?:^|,\s*)XSRF-TOKEN=([^;]+)/i.exec(cookie);

    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }

  return null;
}

export async function fetchPricePolicy(tld, { fetchImpl = fetch } = {}) {
  const normalized = normalizeTld(tld);
  const url = `${PRICE_POLICY_BASE_URL}/${encodeURIComponent(normalized)}`;
  const headers = { Accept: "application/json" };

  const first = await fetchImpl(url, { headers });

  if (first.ok) {
    return first.json();
  }

  const token = readXsrfToken(first);

  if (!token) {
    throw new Error(`Price policy request failed: ${first.status} ${first.statusText}`);
  }

  const response = await fetchImpl(url, {
    headers: { ...headers, "X-XSRF-TOKEN": token },
  });

  if (!response.ok) {
    throw new Error(`Price policy request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function formatPricePolicy(data, tld, years = DEFAULT_PRICE_YEARS) {
  const normalized = normalizeTld(tld);
  const period = priceYears(normalized, years);
  const lines = [];

  const currentTotal = (data.newPeriodValue * period + data.newFeeValue) / 100;
  const oldTotal = (data.oldPeriodValue * period + data.oldFeeValue) / 100;

  lines.push(`TLD: ${normalized}`);
  lines.push(`Years: ${period}${period > Number(years) ? ` (minimum for ${normalized})` : ""}`);
  lines.push(`Registration fee: ${brl.format(data.newFeeValue / 100)}`);
  lines.push(`Annual fee: ${brl.format(data.newPeriodValue / 100)}`);
  lines.push(`Current total: ${brl.format(currentTotal)}`);
  lines.push(`Previous total: ${brl.format(oldTotal)}`);
  lines.push(`  - previous registration fee: ${brl.format(data.oldFeeValue / 100)}`);
  lines.push(`  - previous annual fee: ${brl.format(data.oldPeriodValue / 100)}`);

  return lines.join("\n");
}
