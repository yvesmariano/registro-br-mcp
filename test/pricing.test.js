import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PRICE_YEARS,
  PRICE_POLICY_BASE_URL,
  fetchPricePolicy,
  formatPricePolicy,
  normalizeTld,
  priceYears,
} from "../src/pricing.js";

const COM_BR_POLICY = {
  newFeeValue: 400,
  newPeriodValue: 3600,
  oldFeeValue: 300,
  oldPeriodValue: 2700,
};

function stubResponse({ ok = true, status = 200, statusText = "OK", body, setCookie = [] } = {}) {
  return {
    ok,
    status,
    statusText,
    headers: {
      getSetCookie: () => setCookie,
      get: () => null,
    },
    json: async () => body,
  };
}

test("normalizeTld strips dots and keeps the last two labels", () => {
  assert.equal(normalizeTld(" .NOM.BR. "), "nom.br");
  assert.equal(normalizeTld("exemplo.com.br"), "com.br");
  assert.throws(() => normalizeTld(""), { message: "TLD is required" });
});

test("priceYears defaults to one year and enforces the nom.br minimum", () => {
  assert.equal(DEFAULT_PRICE_YEARS, 1);
  assert.equal(priceYears("com.br"), 1);
  assert.equal(priceYears("com.br", 4), 4);
  assert.equal(priceYears("nom.br", 1), 3);
  assert.throws(() => priceYears("com.br", 0), { message: "Years must be a positive integer" });
});

test("fetchPricePolicy retries with the XSRF token when the first call is rejected", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });

    if (calls.length === 1) {
      return stubResponse({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        setCookie: ["XSRF-TOKEN=ABC123; Path=/; Secure; SameSite=Strict"],
      });
    }

    return stubResponse({ body: COM_BR_POLICY });
  };

  const data = await fetchPricePolicy("com.br", { fetchImpl });

  assert.deepEqual(data, COM_BR_POLICY);
  assert.deepEqual(calls, [
    {
      url: `${PRICE_POLICY_BASE_URL}/com.br`,
      options: { headers: { Accept: "application/json" } },
    },
    {
      url: `${PRICE_POLICY_BASE_URL}/com.br`,
      options: {
        headers: { Accept: "application/json", "X-XSRF-TOKEN": "ABC123" },
      },
    },
  ]);
});

test("fetchPricePolicy returns the first response when it already succeeds", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return stubResponse({ body: COM_BR_POLICY });
  };

  const data = await fetchPricePolicy("net.br", { fetchImpl });

  assert.deepEqual(data, COM_BR_POLICY);
  assert.equal(calls.length, 1);
});

test("fetchPricePolicy fails when the rejection has no XSRF cookie", async () => {
  const fetchImpl = async () => stubResponse({ ok: false, status: 403, statusText: "Forbidden" });

  await assert.rejects(() => fetchPricePolicy("com.br", { fetchImpl }), {
    message: "Price policy request failed: 403 Forbidden",
  });
});

test("fetchPricePolicy reports a failure from the authenticated retry", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return calls === 1
      ? stubResponse({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          setCookie: ["XSRF-TOKEN=ABC123; Path=/"],
        })
      : stubResponse({ ok: false, status: 500, statusText: "Internal Server Error" });
  };

  await assert.rejects(() => fetchPricePolicy("com.br", { fetchImpl }), {
    message: "Price policy request failed: 500 Internal Server Error",
  });
});

test("formatPricePolicy computes current and previous totals in BRL", () => {
  const output = formatPricePolicy(COM_BR_POLICY, "com.br");

  assert.match(output, /^TLD: com\.br$/m);
  assert.match(output, /^Years: 1$/m);
  assert.match(output, /^Registration fee: R\$\s4,00$/m);
  assert.match(output, /^Annual fee: R\$\s36,00$/m);
  assert.match(output, /^Current total: R\$\s40,00$/m);
  assert.match(output, /^Previous total: R\$\s30,00$/m);
  assert.match(output, /^ {2}- previous registration fee: R\$\s3,00$/m);
  assert.match(output, /^ {2}- previous annual fee: R\$\s27,00$/m);
});

test("formatPricePolicy applies multi-year pricing and the nom.br minimum", () => {
  const output = formatPricePolicy(
    { newFeeValue: 400, newPeriodValue: 1200, oldFeeValue: 300, oldPeriodValue: 900 },
    "nom.br",
    1,
  );

  assert.match(output, /^Years: 3 \(minimum for nom\.br\)$/m);
  assert.match(output, /^Current total: R\$\s40,00$/m);
  assert.match(output, /^Previous total: R\$\s30,00$/m);
});
