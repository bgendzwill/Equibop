import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";

const BACKUP_PATH = `C:\\OneDrive\\EQ_backups\\external_script\\customers_standalone_2026-01-24_14-00-03.json`;
const APPDATA = process.env.APPDATA || "";
const DB_FILE = join(APPDATA, "equibop", "vencordStorage", "customers.db");

console.log(`Starting migration from: ${BACKUP_PATH}`);
console.log(`Targeting Database: ${DB_FILE}`);

if (!existsSync(BACKUP_PATH)) {
    console.error("Backup file not found!");
    process.exit(1);
}

try {
    const db = new Database(DB_FILE);
    const data = JSON.parse(readFileSync(BACKUP_PATH, "utf-8"));
    
    // The backup seems to be Record<userId, CustomerData>
    const customers = data.customers || data; // Handle both direct and wrapped
    
    const insert = db.prepare("INSERT OR REPLACE INTO customers (id, data, updated_at) VALUES ($id, $data, CURRENT_TIMESTAMP)");
    
    db.transaction((entries) => {
        let count = 0;
        for (const [id, val] of Object.entries(entries)) {
            insert.run({ $id: id, $data: JSON.stringify(val) });
            count++;
        }
        return count;
    })(customers);

    const total = db.query("SELECT COUNT(*) as c FROM customers").get() as any;
    console.log(`Successfully imported ${Object.keys(customers).length} customers.`);
    console.log(`Total customers in DB now: ${total.c}`);
    
} catch (err) {
    console.error("Migration failed:", err);
}
