import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerSuspendAccountTool(server: McpServer) {
    server.registerTool(
        "mx_suspendAccount",
        {
            title: 'MXRoute Email Account Suspension Tool',
            description: "Suspends an existing email account",
            inputSchema: { 
                domain: z.string().describe("The domain of the email account to suspend"),
                user: z.string().describe("The username of the email account to suspend (without @domain.com)"),
            },
            outputSchema: { 
                ok: z.boolean(),
                data: z.any().optional(),
                error: z.string().optional(),
                result: z.string().optional(),
                suspendedAccount: z.string().optional()
            }
        },
        async ({ domain, user }) => {
            const host = process.env.MX_HOST
            const port = Number(process.env.MX_PORT)
            const url = `https://${host}:${port}/CMD_API_EMAIL_POP?json=yes`;
            const body = new URLSearchParams({
                domain: domain,
                json: "yes",
                action: "delete",
                suspend: "yes",
                select0: user
            });

            const basic = Buffer.from(`${process.env.MX_USER}:${process.env.MX_KEY}`).toString('base64');

            const resp = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Basic ${basic}`,
                },
                body: body.toString(),
            });
            const text = await resp.text();
            let data: any;
            try {
                data = JSON.parse(text);
            } catch {
                data = { raw: text };
            }

            // Check for errors in the response
            if (!resp.ok || /error=1/i.test(text) || data?.error === "1") {
                return {
                    content: [{
                        type: "text",
                        text: `Email account suspension failed: ${data?.error || data?.result || text}`
                    }],
                    structuredContent: {
                        ok: false,
                        error: data?.error || "Suspension failed",
                        result: data?.result || text
                    }
                };
            }

            // Success case
            return {
                content: [{
                    type: "text",
                    text: `Email account suspended successfully!\n\nSuspended: ${user}@${domain}`
                }],
                structuredContent: {
                    ok: true,
                    data: data,
                    suspendedAccount: `${user}@${domain}`
                }
            };
        }
    );
}