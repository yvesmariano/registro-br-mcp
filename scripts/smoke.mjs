#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const serverPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.js");
const domain = process.argv[2] ?? "vivenciasazuis.com.br";

const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "inherit"] });
const pending = new Map();
let nextId = 0;

readline.createInterface({ input: child.stdout }).on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  const resolve = pending.get(message.id);
  if (resolve) {
    pending.delete(message.id);
    resolve(message);
  }
});

function request(method, params) {
  const id = ++nextId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

try {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "registro-br-mcp-smoke", version: "1.0.0" },
  });

  console.log(`server: ${init.result?.serverInfo?.name} v${init.result?.serverInfo?.version}`);
  notify("notifications/initialized", {});

  const list = await request("tools/list", {});
  console.log(`tools: ${list.result?.tools?.map((tool) => tool.name).join(", ")}`);

  const call = await request("tools/call", { name: "rdap_domain", arguments: { domain } });
  const text = call.result?.content?.[0]?.text ?? JSON.stringify(call, null, 2);

  console.log(`\n--- rdap_domain ${domain} ---\n${text}`);

  const dns = await request("tools/call", { name: "dns_lookup", arguments: { name: domain } });
  const dnsText = dns.result?.content?.[0]?.text ?? JSON.stringify(dns, null, 2);

  console.log(`\n--- dns_lookup ${domain} (A) ---\n${dnsText}`);

  const availability = await request("tools/call", {
    name: "domain_availability",
    arguments: { domain },
  });
  const availabilityText =
    availability.result?.content?.[0]?.text ?? JSON.stringify(availability, null, 2);

  console.log(`\n--- domain_availability ${domain} ---\n${availabilityText}`);

  const tld = "com.br";
  const price = await request("tools/call", { name: "domain_price", arguments: { tld } });
  const priceText = price.result?.content?.[0]?.text ?? JSON.stringify(price, null, 2);

  console.log(`\n--- domain_price ${tld} ---\n${priceText}`);

  if (
    call.result?.isError ||
    dns.result?.isError ||
    availability.result?.isError ||
    price.result?.isError
  ) {
    process.exitCode = 1;
  }
} finally {
  child.kill();
}
