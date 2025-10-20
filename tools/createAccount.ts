import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import crypto from "node:crypto";

// Helper: generate random secure password
function generatePassword(length = 16) {
    return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

export function registerCreateAccountTool(server: McpServer) {
    server.registerTool(
        "mx_createAccount",
        {
            title: 'MXRoute Email Account Creation Tool',
            description: "Creates a new email account with a randomly generated secure password",
            inputSchema: { 
                domain: z.string().describe("The domain under which the email account will be created"),
                user: z.string().describe("The desired username for the email account not including the @domain.com"),
                quota: z.string().default("500").describe("The mailbox quota in MB, default is 500MB"),
                limit: z.string().default("300").describe("The sending limit per day, default is 300 emails"),
            },
            outputSchema: { 
                ok: z.boolean(),
                data: z.any().optional(),
                error: z.string().optional(),
                result: z.string().optional(),
                credentials: z.object({
                    email: z.string(),
                    password: z.string(),
                    quota: z.string(),
                    limit: z.string()
                }).optional()
            }
        },
        async ({ domain, user, quota, limit }) => {
            const password = generatePassword(16);
            const host = process.env.MX_HOST
            const port = Number(process.env.MX_PORT)
            const url = `https://${host}:${port}/CMD_API_EMAIL_POP?json=yes`;
            const body = new URLSearchParams({
                action: "create",
                domain,
                user,
                passwd: password,
                passwd2: password,
                quota,
                limit,
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
            if (!resp.ok || /error=1/i.test(text) || data?.error) {
                return {
                    content: [{
                        type: "text",
                        text: `Email account creation failed: ${data?.error || data?.result || text}`
                    }],
                    structuredContent: {
                        ok: false,
                        error: data?.error || "Creation failed",
                        result: data?.result || text
                    }
                };
            }

            // Success case
            return {
                content: [{
                    type: "text",
                    text: `Email account created successfully!\n\nEmail: ${user}@${domain}\nPassword: ${password}\nQuota: ${quota}MB\nDaily limit: ${limit} emails`
                }],
                structuredContent: {
                    ok: true,
                    data: data,
                    credentials: {
                        email: `${user}@${domain}`,
                        password: password,
                        quota: quota,
                        limit: limit
                    }
                }
            };
        }
    );
}