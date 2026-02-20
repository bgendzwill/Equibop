import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./constants";

const STORAGE_DIR = join(DATA_DIR, "vencordStorage");
const STORAGE_FILE = join(STORAGE_DIR, "customers.json");

export const CustomerStorageService = {
    init() {
        try {
            if (!existsSync(STORAGE_DIR)) {
                mkdirSync(STORAGE_DIR, { recursive: true });
            }
        } catch (err) {
            console.error("[CustomerStorage] Failed to init storage dir:", err);
        }
    },

    readCustomers(): any {
        try {
            if (existsSync(STORAGE_FILE)) {
                const data = readFileSync(STORAGE_FILE, "utf-8");
                return JSON.parse(data);
            }
        } catch (err) {
            console.error("[CustomerStorage] Failed to read customers:", err);
        }
        return null;
    },

    writeCustomers(data: any): boolean {
        try {
            this.init();
            writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
            return true;
        } catch (err) {
            console.error("[CustomerStorage] Failed to write customers:", err);
            return false;
        }
    },

    // Helper to get the absolute path for other services (like backup)
    getStoragePath(): string {
        return STORAGE_FILE;
    }
};
