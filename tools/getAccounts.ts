import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerGetAccountsTool(server: McpServer) {
    server.registerTool(
        "mx_getAccounts",
        {
            title: 'MXRoute Email Accounts List Tool',
            description: "Retrieves a list of all email accounts for a specific domain along with metadata and usage information. Also returns information about the domain account as well.",
            inputSchema: { 
                domain: z.string().describe("The domain to list email accounts for."),
            },
            outputSchema: { 
                ok: z.boolean(),
                data: accountsPayloadSchema,
             }
        },
        async ({ domain }) => {
            const host = process.env.MX_HOST
            const port = Number(process.env.MX_PORT)
            const url = `https://${host}:${port}/CMD_API_EMAIL_POP?json=yes&domain=${encodeURIComponent(domain)}`;

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

            // Validate (optional but nice; catches surprises early)
            const parsed = accountsPayloadSchema.parse(data);

            if (!resp.ok) {
                throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
            }

            return {
                content: [{
                    type: "text",
                    text: `Fetched ${parsed.EMAIL_COUNT ?? Object.keys(parsed.emails).length} accounts for ${domain}`,
                }],
                structuredContent: {
                    ok: true,
                    data: data,
                }
            };
        }
    );
}

// usage: sometimes has "quota" and sometimes "last_password_change"
const lastPasswordChangeSchema = z.object({
  ip: z.string(),
  when: z.string(),
});

const usageSchema = z.object({
  apparent_usage: z.string(),
  imap_bytes: z.string(),
  usage: z.string(),
  webmail_bytes: z.string(),
  quota: z.string().optional(),
  last_password_change: lastPasswordChangeSchema.optional(),
});

// "sent" is sometimes an object, sometimes an empty string
const sentSchema = z.union([
  z.object({
    send_limit: z.string(),
    sent: z.string(),
  }),
  z.string(), // ""
]);

const emailEntrySchema = z.object({
  account: z.string(),           // e.g., "administrator"
  login: z.string(),             // e.g., "administrator@domain.com"
  usage: usageSchema,
  sent: sentSchema,
  suspended: z.string(),         // "no" / "yes"
});

// special "info" row inside emails
const emailsInfoSchema = z.object({
  columns: z.object({
    account: z.string(),
    login: z.string(),
    usage: z.string(),
    sent: z.string(),
    suspended: z.string(),
  }),
  current_page: z.string(),
  ipp: z.string(),
  rows: z.string(),
  total_pages: z.string(),
});

// emails: object keyed by "0","1","2",... plus "info"
const emailsMapSchema = z.record(
  z.string(),
  z.union([emailEntrySchema, emailsInfoSchema])
);

// common “select” option maps (purge_select, when_select)
const selectOptionSchema = z.object({
  text: z.string(),
  value: z.string(),
  selected: z.string().optional(), // sometimes "yes"
});

const selectMapSchema = z.record(z.string(), selectOptionSchema);
const accountsPayloadSchema = z
  .object({
    DEFAULT_POP_QUOTA: z.string().optional(),
    DKIM: z.string().optional(),
    DKIM_ENABLED: z.string().optional(),
    EMAIL_COUNT: z.string().optional(),
    EMAIL_MESSAGE: z.string().optional(),
    EMAIL_SENDS: z.string().optional(),
    GLOBAL_PER_EMAIL_LIMIT: z.string().optional(),
    HAVE_ONE_CLICK_WEBMAIL_LOGIN: z.string().optional(),
    MAX_PER_EMAIL_SEND_LIMIT: z.string().optional(),
    USER_CAN_SET_SEND_LIMIT: z.string().optional(),
    USER_EMAIL_SEND_LIMIT: z.string().optional(),
    block_cracking_unblock: z.string().optional(),
    clean_forwarders_on_email_delete: z.string().optional(),
    count_pop_usage: z.string().optional(),

    emails: emailsMapSchema,   // ← main table

    pop_disk_usage_cache: z.string().optional(),
    pop_disk_usage_true_bytes: z.string().optional(),
    purge_select: selectMapSchema.optional(),
    system_user_to_virtual_passwd: z.string().optional(),
    total_usage: z.string().optional(),
    total_usage_bytes: z.string().optional(),
    user_can_set_email_limit: z.string().optional(),
    user_email_quota_max: z.string().optional(),
    when_select: selectMapSchema.optional(),
  })
  .passthrough();