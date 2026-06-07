import { toolContracts } from './toolContracts';
import { mcpToolService } from './mcpToolService';

export const mcpAdapter = {
  registerToolContracts() {
    console.log("Registering MCP Tool Contracts:");
    toolContracts.forEach(contract => {
      console.log(`- ${contract.name}: ${contract.description}`);
    });
  },

  async executeTool(toolName: string, input: any) {
    console.log(`[MCP Adapter] Executing tool ${toolName} with input`, input);
    try {
      const result = await mcpToolService.executeTool(toolName, input);
      return this.formatToolResponse(result);
    } catch (error: any) {
      console.error(`[MCP Adapter] Error executing ${toolName}:`, error);
      return { error: true, message: error.message };
    }
  },

  formatToolResponse(result: any) {
    return {
      success: true,
      data: result
    };
  }
};
