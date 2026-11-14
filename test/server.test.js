import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { dirname, join } from "node:path";
import readline from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { TOOLS, createServer } from "../src/index.js";

const serverPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.js");

const EXPECTED_TOOLS = [
  ["rdap_domain", "domain"],
  ["rdap_entity", "entity"],
  ["rdap_ip", "ip"],
  ["rdap_asn", "asn"],
  ["dns_lookup", "name"],
  ["domain_availability", "domain"],
  ["domain_price", "tld"],
];

function startServer() {
  const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  let stderr = "";
  let nextId = 0;

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

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

  return {
    get stderr() {
      return stderr;
    },

    request(method, params) {
      const id = ++nextId;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    },

    notify(method, params) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },

    async close() {
      if (child.exitCode === null) {
        child.kill();
        await once(child, "exit");
      }
    },
  };
}

test("createServer registers every tool with its main argument", () => {
  assert.equal(typeof createServer, "function");
  assert.deepEqual(
    TOOLS.map((tool) => [tool.name, Object.keys(tool.schema)[0]]),
    EXPECTED_TOOLS,
  );
});

test("the server answers initialize and lists the tools over stdio", async (t) => {
  const server = startServer();
  t.after(() => server.close());

  const init = await server.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "registro-br-mcp-tests", version: "1.0.0" },
  });

  assert.equal(init.result?.serverInfo?.name, "registro-br-rdap");
  assert.equal(init.result?.serverInfo?.version, "1.0.0");

  server.notify("notifications/initialized", {});

  const list = await server.request("tools/list", {});
  assert.deepEqual(
    list.result?.tools?.map((tool) => tool.name),
    EXPECTED_TOOLS.map(([name]) => name),
  );

  for (const tool of list.result.tools) {
    assert.equal(typeof tool.description, "string");
    assert.ok(tool.description.length > 0);
    assert.equal(tool.inputSchema.type, "object");
  }

  assert.match(server.stderr, /running on stdio/);
});

test("a tool call with a missing argument is rejected without touching the network", async (t) => {
  const server = startServer();
  t.after(() => server.close());

  await server.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "registro-br-mcp-tests", version: "1.0.0" },
  });
  server.notify("notifications/initialized", {});

  const response = await server.request("tools/call", { name: "rdap_domain", arguments: {} });

  assert.ok(response.error || response.result?.isError, JSON.stringify(response));
});
