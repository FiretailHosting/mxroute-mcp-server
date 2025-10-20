import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerUnsuspendAccountTool(server: McpServer) {
    server.registerTool(
        "mx_unsuspendAccount",
        {
            title: 'MXRoute Email Account Unsuspension Tool',
            description: "Unsuspends a suspended email account",
            inputSchema: { 
                domain: z.string().describe("The domain of the email account to unsuspend"),
                user: z.string().describe("The username of the email account to unsuspend (without @domain.com)"),
            },
            outputSchema: { 
                ok: z.boolean(),
                data: z.any().optional(),
                error: z.string().optional(),
                result: z.string().optional(),
                unsuspendedAccount: z.string().optional()
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
                unsuspend: "yes",
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
                        text: `Email account unsuspension failed: ${data?.error || data?.result || text}`
                    }],
                    structuredContent: {
                        ok: false,
                        error: data?.error || "Unsuspension failed",
                        result: data?.result || text
                    }
                };
            }

            // Success case
            return {
                content: [{
                    type: "text",
                    text: `Email account unsuspended successfully!\n\nUnsuspended: ${user}@${domain}`
                }],
                structuredContent: {
                    ok: true,
                    data: data,
                    unsuspendedAccount: `${user}@${domain}`
                }
            };
        }
    );
}