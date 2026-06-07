# Vega MCP Architecture

This folder contains the foundation for future Model Context Protocol (MCP) integrations. 
By defining explicit tool contracts (`toolContracts.ts`) and validating inputs using Zod (`mcpSchemas.ts`), 
we ensure that any AI agent, Chrome extension, or external system interacts with our backend 
in a safe, deterministic, and consistent way.

## Why this architecture?
All MCP tools route directly to the core `services/`. Business logic never lives inside the MCP adapter. 
This means our standard REST APIs, browser extension endpoints, and MCP tools all share the same logic.

## Current state
`mcpAdapter.ts` currently acts as a mock adapter demonstrating how an MCP server would route requests.
To start a real MCP server, you'd integrate the `@modelcontextprotocol/sdk` and map these tools to standard MCP handlers.
