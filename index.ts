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

// Request logging middleware (enabled when LOG_LEVEL=debug or DEBUG=true)
const isDebugMode = process.env.LOG_LEVEL === 'debug' || process.env.DEBUG === 'true';
if (isDebugMode) {
    app.use((req, res, next) => {
        const start = Date.now();

        // After response finishes, log details.
        res.on('finish', () => {
            try {
                const duration = Date.now() - start;
                let extra = '';

                // If this is the MCP endpoint, try to log JSON-RPC tool call details.
                if (req.path === '/mcp' && req.body && typeof req.body === 'object') {
                    const body = req.body as any;
                    const method = body.method;
                    if (method === 'tools/call') {
                        // params may contain { name, arguments }
                        const params = body.params || {};
                        const toolName = params.name || params?.arguments?.name || params?.arguments?.tool || '<unknown>';
                        const toolArgs = params.arguments || params || {};
                        extra = ` tool=${toolName} args=${JSON.stringify(toolArgs)}`;
                    } else {
                        extra = ` rpcMethod=${method} id=${body.id ?? '-'} `;
                    }
                }

                console.log(`${new Date().toISOString()} ${req.ip} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms${extra}`);
            } catch (err) {
                console.error('Request logging error', err);
            }
        });

        next();
    });
}

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
// Allow configuring bind address via HOST or BIND_ADDRESS env var. Default to localhost for safety.
const host = process.env.HOST || process.env.BIND_ADDRESS || '127.0.0.1';

// Log startup configuration (non-sensitive values only)
console.log(`MXRoute MCP Server v0.1.0 starting...`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Log Level: ${process.env.LOG_LEVEL || 'info'}`);
console.log(`Debug Mode: ${isDebugMode ? 'enabled' : 'disabled'}`);
console.log(`Bind Address: ${host}:${port}`);
console.log(`MX Host: ${process.env.MX_HOST || 'not configured'}`);
console.log(`MX Port: ${process.env.MX_PORT || 'not configured'}`);
console.log(`MX User: ${process.env.MX_USER ? '***configured***' : 'not configured'}`);
console.log(`MX API Key: ${process.env.MX_KEY ? '***configured***' : 'not configured'}`);
console.log(`MCP Secret: ${process.env.MCP_SECRET ? '***configured***' : 'not configured (auth disabled)'}`);
console.log(`Request Logging: ${isDebugMode ? 'enabled' : 'disabled'}`);
console.log(`Available Tools: mx_createAccount, mx_deleteAccount, mx_suspendAccount, mx_unsuspendAccount, mx_purgeAccount, mx_getAccounts, mx_getDomains`);

app.listen(port, host, () => {
    console.log(`✓ MCP Server running on http://${host}:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});