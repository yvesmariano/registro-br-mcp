# Registro.br MCP Server

Um servidor [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) para consultar o RDAP do Registro.br.

## Ferramentas Disponíveis

| Ferramenta            | Descrição                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `rdap_domain`         | Consulta informações de domínios .br (ex: `nic.br`, `registro.br`)                           |
| `rdap_entity`         | Consulta entidades por CNPJ, CPF ou handle (ex: `05506560000136`, `FAN`)                     |
| `rdap_ip`             | Consulta informações de IP ou rede (ex: `200.160.0.0`, `200.160.0.0/20`)                     |
| `rdap_asn`            | Consulta Autonomous System Numbers (ex: `22548`, `AS22548`)                                  |
| `dns_lookup`          | Resolve registros DNS A, AAAA, CNAME, NS, MX e TXT (ex: `vivenciasazuis.com.br`, `a.dns.br`) |
| `domain_availability` | Verifica se um domínio .br está disponível (ex: `meunovodominio.com.br`)                     |
| `domain_price`        | Consulta o preço atual e anterior de uma categoria .br (ex: `com.br`, `nom.br`)              |

> A API RDAP do Registro.br não implementa o endpoint `/nameserver` (responde `501 Not Implemented`),
> então a consulta de nameservers é feita via `dns_lookup` (tipos `NS`, `A`, `AAAA`) ou pelos
> nameservers que já vêm na resposta de `rdap_domain`.

## Instalação

### Via npx (recomendado)

Não é necessário instalar. Configure diretamente no seu cliente MCP.

### Via npm (global)

```bash
npm install -g registro-br-mcp
```

## Configuração

### Claude Desktop

Adicione ao arquivo de configuração:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "registro-br": {
      "command": "npx",
      "args": ["registro-br-mcp"]
    }
  }
}
```

### Claude Code

Adicione ao arquivo:

- **macOS/Linux**: `~/.claude/settings.json`
- **Windows**: `%USERPROFILE%\.claude\settings.json`

```json
{
  "mcpServers": {
    "registro-br": {
      "command": "npx",
      "args": ["registro-br-mcp"]
    }
  }
}
```

### Cursor

Adicione ao arquivo de configuração MCP:

- **macOS/Linux**: `~/.cursor/mcp.json`
- **Windows**: `%USERPROFILE%\.cursor\mcp.json`

```json
{
  "mcpServers": {
    "registro-br": {
      "command": "npx",
      "args": ["registro-br-mcp"]
    }
  }
}
```

### Windsurf

Adicione ao arquivo de configuração MCP:

- **macOS/Linux**: `~/.codeium/windsurf/mcp_config.json`
- **Windows**: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`

```json
{
  "mcpServers": {
    "registro-br": {
      "command": "npx",
      "args": ["registro-br-mcp"]
    }
  }
}
```

### Antigravity

Adicione ao arquivo de configuração MCP:

- **macOS/Linux**: `~/.antigravity/mcp.json`
- **Windows**: `%USERPROFILE%\.antigravity\mcp.json`

```json
{
  "mcpServers": {
    "registro-br": {
      "command": "npx",
      "args": ["registro-br-mcp"]
    }
  }
}
```

## Exemplos de Uso

Após configurar, você pode fazer perguntas como:

- "Consulte o domínio nic.br"
- "Quem é o registrante do domínio registro.br?"
- "Busque informações do ASN 22548"
- "Qual o IP do nameserver a.dns.br?"
- "Quais os registros A de vivenciasazuis.com.br?"
- "Consulte a entidade com CNPJ 05506560000136"
- "O domínio meunovodominio.com.br está disponível?"
- "Quanto custa registrar um domínio .com.br por 3 anos?"

## Exemplo de Resposta

Consulta do domínio `nic.br`:

```
Domain: nic.br
Handle: nic.br
Status: active

Events:
  - registration: 1997-07-11T12:00:00Z
  - last changed: 2018-03-27T20:09:08Z

Nameservers:
  - a.dns.br
  - b.dns.br
  - c.dns.br
  - d.dns.br
  - e.dns.br

DNSSEC: Signed
  - KeyTag: 47828, Algorithm: 13, DigestType: 2

Entities:
  - Núcleo de Inf. e Coord. do Ponto BR - NIC.BR (registrant)
  - Frederico Augusto de Carvalho Neves (technical)
```

## API RDAP

Este servidor utiliza a API RDAP pública do Registro.br:

- Base URL: `https://rdap.registro.br`
- Documentação: https://registro.br/rdap/

## Disponibilidade e preços

`domain_availability` e `domain_price` usam os endpoints que o próprio site do Registro.br consome
(APIs internas, não documentadas publicamente — podem mudar sem aviso):

- Disponibilidade: `GET https://registro.br/v2/ajax/avail/raw/<domínio>` (não exige token; um rótulo
  sem ponto assume `.com.br`). O campo `status` segue o mapeamento do site: `0`/`1` disponível,
  `2` já registrado, `3` indisponível/reservado, `4` consulta inválida, `5` aguardando início do
  processo de liberação, `6`/`7` em processo de liberação e `8` falha na consulta.
- Preços: `GET https://registro.br/v2/ajax/payment/policy/<categoria>` (exige o header
  `X-XSRF-TOKEN`; o servidor emite o cookie `XSRF-TOKEN` em qualquer resposta, inclusive `400`, e o
  MCP faz o retry automaticamente). Os valores vêm em centavos e o total é
  `(periodValue × anos + feeValue) / 100`; `nom.br` exige no mínimo 3 anos.

## Desenvolvimento

```bash
# Clonar o repositório
git clone https://github.com/yvesmariano/registro-br-mcp.git
cd registro-br-mcp

# Instalar dependências
npm install

# Executar localmente
npm start
```

### Scripts

| Script                 | O que faz                                                             |
| ---------------------- | --------------------------------------------------------------------- |
| `npm start`            | Sobe o servidor MCP no stdio                                          |
| `npm test`             | Suíte de testes (`node:test`)                                         |
| `npm run lint`         | ESLint                                                                |
| `npm run lint:fix`     | ESLint com `--fix`                                                    |
| `npm run format`       | Prettier (escreve)                                                    |
| `npm run format:check` | Prettier (só confere)                                                 |
| `npm run check`        | `format:check` + `lint` + `test`, exatamente o que o CI roda          |
| `npm run smoke`        | Consulta a API RDAP e o DNS ao vivo (`npm run smoke -- outro.com.br`) |

Os testes rodam **offline**: usam fixtures do RDAP e stubs de `fetch`/resolver DNS, então o CI não
depende da API pública. A verificação contra a API real é o `npm run smoke`.

### Pre-commit e CI

- **pre-commit** (husky + lint-staged): roda Prettier e ESLint nos arquivos alterados e depois a suíte
  completa de testes, bloqueando commits quebrados.
- **CI** (GitHub Actions): em `push` na main e em pull requests, roda `format:check`, `lint` e `test`
  numa matrix com Node 20, 22 e 24.

## Requisitos

- Node.js >= 18.0.0 para usar o servidor
- Node.js >= 20.19.0 para o tooling de desenvolvimento (ESLint, lint-staged)

## Licença

MIT
