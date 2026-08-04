# mcp-biostudies

EBI BioStudies MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_studies` | Search EBI BioStudies — a keyless database of biological study descriptions that links across EBI archives (ArrayExpress, PRIDE, etc.). Find studies by keyword and get accession, title, authors, type, release date, and link/file counts. |
| `get_study` | Get the metadata for a single EBI BioStudies study by accession (e.g. "S-EPMC6010251"). Returns the title, flattened attributes (abstract, release date, data source, etc.), and counts of links and subsections. EBI BioStudies links across EBI archives. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "biostudies": {
      "url": "https://gateway.pipeworx.io/biostudies/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Biostudies data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
