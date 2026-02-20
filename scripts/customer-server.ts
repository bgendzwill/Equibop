import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";

const PORT = 3055;
const APPDATA = process.env.APPDATA || join(process.env.HOME || "", "AppData", "Roaming");
const DEFAULT_DATA_DIR = join(APPDATA, "equibop");
const DATA_DIR = process.env.EQUICORD_DATA_DIR || DEFAULT_DATA_DIR;
const STORAGE_DIR = join(DATA_DIR, "vencordStorage");
const DB_FILE = join(STORAGE_DIR, "customers.db");
const LEGACY_FILE = join(STORAGE_DIR, "customers.json");
const LOG_FILE = join(STORAGE_DIR, "server.log");

function log(msg: string, level: "INFO" | "ERROR" | "WARN" = "INFO") {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${msg}`;
    console.log(line);
    try {
        appendFileSync(LOG_FILE, line + "\n");
    } catch (e) {
        console.error(`[CRITICAL] Failed to write to log file: ${e}`);
    }
}

log(`Starting on port ${PORT}`);
log(`Database: ${DB_FILE}`);

if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
}

let db: Database;
try {
    db = new Database(DB_FILE);
    log("Database connection established");
} catch (e) {
    log(`Failed to open database: ${e}`, "ERROR");
    process.exit(1);
}

// Initialize Schema
db.run(`
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        data TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT,
        author_id TEXT,
        content TEXT,
        timestamp TEXT,
        raw TEXT,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Migration from JSON
if (existsSync(LEGACY_FILE)) {
    try {
        log("Migrating legacy JSON data to SQLite...");
        const data = JSON.parse(readFileSync(LEGACY_FILE, "utf-8"));
        const insert = db.prepare("INSERT OR REPLACE INTO customers (id, data) VALUES ($id, $data)");
        db.transaction((entries) => {
            for (const [id, val] of Object.entries(entries)) {
                insert.run({ $id: id, $data: JSON.stringify(val) });
            }
        })(data);
        log(`Migration complete (${Object.keys(data).length} entries)`);
        // We'll keep the legacy file for now just in case, renamed
        // renameSync(LEGACY_FILE, LEGACY_FILE + ".bak"); 
    } catch (err) {
        log(`Migration failed: ${err}`, "ERROR");
    }
}

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        // CORS Headers
        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        // Handle CORS Preflight
        if (req.method === "OPTIONS") {
            return new Response(null, { headers });
        }

        if (url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok", db: DB_FILE }), { headers });
        }

        // GET All Customers
        if (url.pathname === "/customers" && req.method === "GET") {
            const rows = db.query("SELECT id, data FROM customers").all() as any[];
            const result: Record<string, any> = {};
            for (const row of rows) {
                result[row.id] = JSON.parse(row.data);
            }
            return new Response(JSON.stringify(result), { headers });
        }

        // POST/Batch Sync (Customers & Messages)
        if (url.pathname === "/sync/batch" && req.method === "POST") {
            try {
                const { customers, messages } = await req.json();
                
                db.transaction(() => {
                    if (customers) {
                        const upsertCustomer = db.prepare("INSERT OR REPLACE INTO customers (id, data, updated_at) VALUES ($id, $data, CURRENT_TIMESTAMP)");
                        for (const [id, data] of Object.entries(customers)) {
                            upsertCustomer.run({ $id: id, $data: JSON.stringify(data) });
                        }
                    }

                    if (messages && Array.isArray(messages)) {
                        const upsertMessage = db.prepare(`
                            INSERT OR REPLACE INTO messages (id, channel_id, author_id, content, timestamp, raw, synced_at) 
                            VALUES ($id, $channel_id, $author_id, $content, $timestamp, $raw, CURRENT_TIMESTAMP)
                        `);
                        for (const m of messages) {
                            upsertMessage.run({
                                $id: m.id,
                                $channel_id: m.channel_id || m.channelId,
                                $author_id: m.author?.id || m.authorId,
                                $content: m.content,
                                $timestamp: m.timestamp,
                                $raw: JSON.stringify(m)
                            });
                        }
                    }
                })();

                const cCount = customers ? Object.keys(customers).length : 0;
                const mCount = messages ? messages.length : 0;
                log(`Batch Synced: ${cCount} customers, ${mCount} messages`);
                
                return new Response(JSON.stringify({ success: true, customers: cCount, messages: mCount }), { headers });
            } catch (err) {
                log(`Sync Batch Error: ${err}`, "ERROR");
                return new Response(JSON.stringify({ error: String(err) }), {
                    status: 500,
                    headers
                });
            }
        }

        // POST Customers (Legacy support)
        if (url.pathname === "/customers" && req.method === "POST") {
            try {
                const body = await req.json();
                const insert = db.prepare("INSERT OR REPLACE INTO customers (id, data, updated_at) VALUES ($id, $data, CURRENT_TIMESTAMP)");
                db.transaction((entries) => {
                    for (const [id, val] of Object.entries(entries)) {
                        insert.run({ $id: id, $data: JSON.stringify(val) });
                    }
                })(body);
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (err) {
                return new Response(JSON.stringify({ error: String(err) }), {
                    status: 500,
                    headers
                });
            }
        }

        // POST Backup
        if (url.pathname === "/backup" && req.method === "POST") {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const backupFile = join(STORAGE_DIR, `customers_server_${timestamp}.db`);
                db.run(`VACUUM INTO '${backupFile.replace(/'/g, "''")}'`);
                log(`DB Backup created: ${backupFile}`);
                return new Response(JSON.stringify({ success: true, backup: backupFile }), { headers });
            } catch (err) {
                log(`Backup error: ${err}`, "ERROR");
                return new Response(JSON.stringify({ error: String(err) }), {
                    status: 500,
                    headers
                });
            }
        }

        return new Response("Not Found", { status: 404, headers });
    }
});

// --- Automatic Backups ---
const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_SERVER_BACKUPS = 10;

function performAutoBackup() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupFile = join(STORAGE_DIR, `customers_auto_${timestamp}.db`);
        db.run(`VACUUM INTO '${backupFile.replace(/'/g, "''")}'`);
        log(`Automatic DB Backup created: ${backupFile}`);
        cleanupOldBackups();
    } catch (err) {
        log(`Automatic backup failed: ${err}`, "ERROR");
    }
}

function cleanupOldBackups() {
    try {
        const { readdirSync, statSync, unlinkSync } = require("node:fs");
        const files = readdirSync(STORAGE_DIR)
            .filter(f => f.startsWith("customers_auto_") || f.startsWith("customers_server_"))
            .map(f => ({ name: f, time: statSync(join(STORAGE_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (files.length > MAX_SERVER_BACKUPS) {
            const toDelete = files.slice(MAX_SERVER_BACKUPS);
            for (const file of toDelete) {
                unlinkSync(join(STORAGE_DIR, file.name));
                log(`Deleted old backup: ${file.name}`);
            }
        }
    } catch (err) {
        log(`Cleanup failed: ${err}`, "ERROR");
    }
}

// Initial backup on startup after 10s
setTimeout(performAutoBackup, 10000);
// Periodic backups
setInterval(performAutoBackup, BACKUP_INTERVAL_MS);

// --- Crash Protection ---
process.on("uncaughtException", (err) => {
    log(`UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`, "ERROR");
});

process.on("unhandledRejection", (reason, promise) => {
    log(`UNHANDLED REJECTION: ${reason}`, "ERROR");
});

log(`Listening on http://localhost:${PORT}`);
