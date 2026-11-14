import assert from "node:assert/strict";
import test from "node:test";

import {
  AVAILABILITY_BASE_URL,
  fetchAvailability,
  formatAvailability,
  isAvailable,
  normalizeDomain,
} from "../src/availability.js";

test("normalizeDomain trims, lowercases and drops a trailing dot", () => {
  assert.equal(normalizeDomain("  Registro.BR. "), "registro.br");
  assert.throws(() => normalizeDomain("   "), { message: "Domain is required" });
});

test("isAvailable accepts statuses 0 and 1 only", () => {
  assert.equal(isAvailable({ status: 0 }), true);
  assert.equal(isAvailable({ status: 1 }), true);

  for (const status of [2, 3, 4, 5, 6, 7, 8]) {
    assert.equal(isAvailable({ status }), false);
  }
});

test("fetchAvailability calls the availability endpoint with the normalized domain", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ status: 0, fqdn: "exemplo.com.br" }) };
  };

  const data = await fetchAvailability("  Exemplo.COM.BR. ", { fetchImpl });

  assert.deepEqual(data, { status: 0, fqdn: "exemplo.com.br" });
  assert.deepEqual(calls, [
    {
      url: `${AVAILABILITY_BASE_URL}/exemplo.com.br`,
      options: { headers: { Accept: "application/json" } },
    },
  ]);
});

test("fetchAvailability reports HTTP failures", async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, statusText: "Service Unavailable" });

  await assert.rejects(() => fetchAvailability("exemplo.com.br", { fetchImpl }), {
    message: "Availability request failed: 503 Service Unavailable",
  });
});

test("fetchAvailability rejects a response without a numeric status", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ fqdn: "exemplo.com.br" }) });

  await assert.rejects(() => fetchAvailability("exemplo.com.br", { fetchImpl }), {
    message: "Availability request returned an unexpected response",
  });
});

test("formatAvailability renders a registered domain", () => {
  const output = formatAvailability({
    status: 2,
    fqdn: "registro.br",
    exempt: true,
    hosts: ["a.dns.br", "b.dns.br"],
    "publication-status": "published",
    "expires-at": "2027-05-18T00:00:00-03:00",
    suggestions: ["agr.br", "ong.br"],
  });

  assert.equal(
    output,
    [
      "Domain: registro.br",
      "Status: registered (2)",
      "Available: no",
      "Publication status: published",
      "Expires at: 2027-05-18T00:00:00-03:00",
      "Exempt: yes",
      "",
      "Hosts:",
      "  - a.dns.br",
      "  - b.dns.br",
      "",
      "Suggested categories:",
      "  - agr.br",
      "  - ong.br",
    ].join("\n"),
  );
});

test("formatAvailability renders an available domain", () => {
  const output = formatAvailability({ status: 0, fqdn: "exemplo.com.br", exempt: false });

  assert.equal(
    output,
    ["Domain: exemplo.com.br", "Status: available (0)", "Available: yes"].join("\n"),
  );
});

test("formatAvailability includes reasons and the release window", () => {
  const output = formatAvailability({
    status: 6,
    fqdn: "exemplo.com.br",
    reasons: ["Domínio em processo de liberação"],
    "begins-at": "2026-11-11T15:00:00-03:00",
    "ends-at": "2026-11-18T15:00:00-03:00",
    "accepting-new-tickets-until": "2026-11-17T15:00:00-03:00",
  });

  assert.match(output, /^Status: in release process \(6\)$/m);
  assert.match(output, /^Available: no$/m);
  assert.match(output, /^Reasons:$/m);
  assert.match(output, /^ {2}- Domínio em processo de liberação$/m);
  assert.match(output, /^Release process:$/m);
  assert.match(output, /^ {2}- begins at: 2026-11-11T15:00:00-03:00$/m);
  assert.match(output, /^ {2}- ends at: 2026-11-18T15:00:00-03:00$/m);
  assert.match(output, /^ {2}- accepting new tickets until: 2026-11-17T15:00:00-03:00$/m);
});
