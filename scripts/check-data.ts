import { Database } from "bun:sqlite";
import { join } from "node:path";

const APPDATA = process.env.APPDATA || "";
const DB_FILE = join(APPDATA, "equibop", "vencordStorage", "customers.db");

try {
    const db = new Database(DB_FILE);
    const customers = db.query("SELECT COUNT(*) as count FROM customers").get();
    const messages = db.query("SELECT COUNT(*) as count FROM messages").get();
    
    console.log(JSON.stringify({
        dbPath: DB_FILE,
        customerCount: customers?.count || 0,
        messageCount: messages?.count || 0
    }, null, 2));
} catch (err) {
    console.error("Error checking database:", err);
}
