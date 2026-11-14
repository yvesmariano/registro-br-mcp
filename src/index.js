#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { z } from "zod";

import { fetchAvailability, formatAvailability } from "./availability.js";
import { DNS_RECORD_TYPES, DEFAULT_DNS_TYPE, resolveDns } from "./dns.js";
import { fetchPricePolicy, formatPricePolicy } from "./pricing.js";
import {
  fetchRdap,
  formatAsnInfo,
  formatDomainInfo,
  formatEntityInfo,
  formatIpInfo,
} from "./rdap.js";

function rdapTool({ name, description, schema, errorLabel, path, format }) {
  return {
    name,
    description,
    schema,
    errorLabel,
    run: async (args) => {
      const data = await fetchRdap(path(args));
      return { text: format(data), data };
    },
  };
}

export const TOOLS = [
  rdapTool({
    name: "rdap_domain",
    description: "Query RDAP information for a .br domain",
    schema: {
      domain: z.string().describe("The domain name to query (e.g., nic.br, registro.br)"),
    },
    errorLabel: "domain",
    path: ({ domain }) => `/domain/${domain}`,
    format: formatDomainInfo,
  }),
  rdapTool({
    name: "rdap_entity",
    description: "Query RDAP information for an entity (by CNPJ, CPF, or handle)",
    schema: {
      entity: z
        .string()
        .describe("The entity identifier (CNPJ without punctuation, CPF, or handle like 'FAN')"),
    },
    errorLabel: "entity",
    path: ({ entity }) => `/entity/${entity}`,
    format: formatEntityInfo,
  }),
  rdapTool({
    name: "rdap_ip",
    description: "Query RDAP information for an IP address or network",
    schema: {
      ip: z
        .string()
        .describe("The IP address or CIDR notation (e.g., 200.160.0.0, 200.160.0.0/20)"),
    },
    errorLabel: "IP",
    path: ({ ip }) => `/ip/${ip}`,
    format: formatIpInfo,
  }),
  rdapTool({
    name: "rdap_asn",
    description: "Query RDAP information for an Autonomous System Number",
    schema: {
      asn: z.string().describe("The AS number (e.g., 22548 or AS22548)"),
    },
    errorLabel: "ASN",
    path: ({ asn }) => `/autnum/${asn.replace(/^AS/i, "")}`,
    format: formatAsnInfo,
  }),
  {
    name: "dns_lookup",
    description:
      "Resolve DNS records (A, AAAA, CNAME, NS, MX, TXT) for a hostname, including .br domains",
    schema: {
      name: z.string().describe("The hostname to resolve (e.g., vivenciasazuis.com.br, a.dns.br)"),
      type: z
        .enum(DNS_RECORD_TYPES)
        .optional()
        .describe(`Record type to resolve (defaults to ${DEFAULT_DNS_TYPE})`),
    },
    errorLabel: "DNS record",
    run: async ({ name, type }) => ({ text: await resolveDns(name, type) }),
  },
  {
    name: "domain_availability",
    description:
      "Check whether a .br domain is available for registration (Registro.br availability API)",
    schema: {
      domain: z
        .string()
        .describe("The domain to check (e.g., exemplo.com.br; a bare label defaults to .com.br)"),
    },
    errorLabel: "domain availability",
    run: async ({ domain }) => {
      const data = await fetchAvailability(domain);
      return { text: formatAvailability(data), data };
    },
  },
  {
    name: "domain_price",
    description: "Get the current and previous registration price for a .br category (TLD), in BRL",
    schema: {
      tld: z.string().describe("The .br category (e.g., com.br, net.br, nom.br)"),
      years: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Registration period in years (defaults to 1; nom.br requires at least 3)"),
    },
    errorLabel: "domain price",
    run: async ({ tld, years }) => {
      const data = await fetchPricePolicy(tld);
      return { text: formatPricePolicy(data, tld, years), data };
    },
  },
];

export function createServer() {
  const server = new McpServer({
    name: "registro-br-rdap",
    version: "1.0.0",
  });

  for (const tool of TOOLS) {
    server.tool(tool.name, tool.description, tool.schema, async (args) => {
      try {
        const { text, data } = await tool.run(args);
        const content = [{ type: "text", text }];

        if (data !== undefined) {
          content.push({
            type: "text",
            text: "\n\n--- Raw JSON ---\n" + JSON.stringify(data, null, 2),
          });
        }

        return { content };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error querying ${tool.errorLabel}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Registro.br RDAP MCP Server running on stdio");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}
