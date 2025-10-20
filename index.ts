import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { registerCreateAccountTool, registerDeleteAccountTool, registerGetAccountsTool, registerGetDomainsTool, registerSuspendAccountTool, registerUnsuspendAccountTool, registerPurgeAccountTool } from './tools/index.js';


const server = new McpServer({ name: "mxroute-mcp", version: "0.1.0" })

// Register tools
registerCreateAccountTool(server);
registerDeleteAccountTool(server);
registerGetAccountsTool(server);
registerGetDomainsTool(server);
registerSuspendAccountTool(server);
registerUnsuspendAccountTool(server);
registerPurgeAccountTool(server);

const app = express();
app.use(express.json());

// Simple authentication middleware
const authenticateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const mcpSecret = process.env.MCP_SECRET;
    if (!mcpSecret) {
        return next(); // Skip auth if no secret is set
    }

    const authHeader = req.headers.authorization;
    const providedSecret = authHeader?.replace('Bearer ', '');
    
    if (providedSecret !== mcpSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
};

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        uptime: process.uptime()
    });
});

app.post('/mcp', authenticateRequest, async (req, res) => {
    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});