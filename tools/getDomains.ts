import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerGetDomainsTool(server: McpServer) {
    server.registerTool(
        "mx_getDomains",
        {
            title: 'MXRoute Domains List Tool',
            description: "Retrieves a list of all domains associated with the account",
            inputSchema: {},
            outputSchema: { 
                ok: z.boolean(),
                data: domainsPayloadSchema,
             }
        },
        async () => {
            const host = process.env.MX_HOST
            const port = Number(process.env.MX_PORT)
            const url = `https://${host}:${port}/CMD_ADDITIONAL_DOMAINS?json=yes`;

            const basic = Buffer.from(`${process.env.MX_USER}:${process.env.MX_KEY}`).toString('base64');

            const resp = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Basic ${basic}`,
                },
            });

            const text = await resp.text();
            let data: unknown;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error(`Expected JSON but got: ${text.slice(0, 200)}`);
            }

            // Validate the response structure
            const parsed = domainsPayloadSchema.parse(data);

            if (!resp.ok) {
                throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
            }

            const domainCount = Object.keys(parsed).length;

            return {
                content: [{
                    type: "text",
                    text: `Fetched ${domainCount} domains from the account`,
                }],
                structuredContent: {
                    ok: true,
                    data: data,
                }
            };
        }
    );
}

// Schema for individual domain configuration - made more flexible
const domainConfigSchema = z.object({
    UseCanonicalName: z.string(),
    acme_provider: z.string(),
    active: z.string(),
    bandwidth: z.string(),
    bandwidth_limit: z.string(),
    cgi: z.string(),
    defaultdomain: z.string(),
    domain: z.string(),
    ip: z.string(),
    ips: z.array(z.string()),
    local_mail: z.string(),
    open_basedir: z.string(),
    php: z.string(),
    pointers: z.record(z.any()), // Empty object or could contain pointer configurations
    quota: z.string(),
    quota_limit: z.string(),
    safemode: z.string(),
    ssl: z.string(),
    subdomain: z.string(),
    suspended: z.string(),
    username: z.string(),
}).passthrough(); // Allow additional properties

// Schema for the entire domains response - use a more flexible approach
const domainsPayloadSchema = z.record(z.string(), z.any());