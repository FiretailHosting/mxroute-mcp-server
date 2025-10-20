import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPurgeAccountTool(server: McpServer) {
    server.registerTool(
        "mx_purgeAccount",
        {
            title: 'MXRoute Email Account Purge Tool',
            description: "Purges emails from an email account based on age and mailbox type",
            inputSchema: { 
                domain: z.string().describe("The domain of the email account to purge"),
                user: z.string().describe("The username of the email account to purge (without @domain.com)"),
                file: z.enum(["spambox", "imap", "inbox"]).describe("The mailbox type to purge from: spambox, imap, or inbox"),
                what: z.string().describe("How many days old emails to delete (e.g., '30') or 'all' to delete everything"),
            },
            outputSchema: { 
                ok: z.boolean(),
                data: z.any().optional(),
                error: z.string().optional(),
                result: z.string().optional(),
                purgedAccount: z.string().optional(),
                purgeDetails: z.object({
                    mailbox: z.string(),
                    ageFilter: z.string()
                }).optional()
            }
        },
        async ({ domain, user, file, what }) => {
            const host = process.env.MX_HOST
            const port = Number(process.env.MX_PORT)
            const url = `https://${host}:${port}/CMD_API_EMAIL_POP?json=yes`;
            const body = new URLSearchParams({
                domain: domain,
                json: "yes",
                action: "delete",
                purge: "yes",
                file: file,
                what: what,
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
                        text: `Email account purge failed: ${data?.error || data?.result || text}`
                    }],
                    structuredContent: {
                        ok: false,
                        error: data?.error || "Purge failed",
                        result: data?.result || text
                    }
                };
            }

            // Success case
            const ageDescription = what === "all" ? "all emails" : `emails older than ${what} days`;
            return {
                content: [{
                    type: "text",
                    text: `Email account purged successfully!\n\nPurged: ${user}@${domain}\nMailbox: ${file}\nPurged: ${ageDescription}`
                }],
                structuredContent: {
                    ok: true,
                    data: data,
                    purgedAccount: `${user}@${domain}`,
                    purgeDetails: {
                        mailbox: file,
                        ageFilter: what
                    }
                }
            };
        }
    );
}