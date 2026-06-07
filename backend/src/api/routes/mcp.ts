import { Router } from 'express';
import { mcpAdapter } from '../../mcp/mcpAdapter';

const router = Router();

// Endpoint to simulate an MCP tool call over HTTP (for testing the adapter)
router.post('/call-tool', async (req, res) => {
  try {
    const { toolName, input } = req.body;
    if (!toolName) {
      return res.status(400).json({ error: "toolName is required" });
    }
    const result = await mcpAdapter.executeTool(toolName, input);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
