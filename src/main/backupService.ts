import { exec } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./constants";
import { VencordSettings } from "./settings";
import { CustomerStorageService } from "./customerStorage";

const BACKUP_DIR = join(DATA_DIR, "backups", "customerManager");
const MAX_BACKUPS = 30;
// Hardcoded path as per request/current location
const EXTERNAL_SCRIPT_PATH = "d:\\Skrypty\\Equibop\\scripts\\external_backup.ps1";

export const BackupService = {
    init() {
        try {
            mkdirSync(BACKUP_DIR, { recursive: true });
            this.performAutoBackup();
        } catch (err) {
            console.error("[BackupService] Failed to initialize:", err);
        }
    },

    performAutoBackup(retries = 3) {
        try {
            // Read from separate storage now
            const customerData = CustomerStorageService.readCustomers();
            
            // Algorithm: Don't back up if data looks empty or missing
            if (!customerData || Object.keys(customerData).length === 0) {
                console.log("[BackupService] Skipping backup: No customer data found or data is empty.");
                return;
            }

            const success = this.saveBackup(customerData);
            if (!success && retries > 0) {
                console.log(`[BackupService] Backup failed, retrying... (${retries} left)`);
                setTimeout(() => this.performAutoBackup(retries - 1), 5000);
                return;
            }

            this.cleanupOldBackups();
        } catch (err) {
            console.error("[BackupService] Auto-backup algorithm error:", err);
            if (retries > 0) {
                setTimeout(() => this.performAutoBackup(retries - 1), 5000);
            }
        }
    },

    saveBackup(data: any) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `customers_${timestamp}.json`;
            const filePath = join(BACKUP_DIR, filename);
            
            writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`[BackupService] Backup saved: ${filename}`);

            // Trigger external PowerShell script
            exec(`powershell -ExecutionPolicy Bypass -File "${EXTERNAL_SCRIPT_PATH}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[BackupService] External script error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    console.error(`[BackupService] External script stderr: ${stderr}`);
                }
                console.log(`[BackupService] External script executed: ${stdout}`);
            });

            return true;
        } catch (err) {
            console.error("[BackupService] Failed to save backup:", err);
            return false;
        }
    },

    cleanupOldBackups() {
        try {
            const files = readdirSync(BACKUP_DIR)
                .filter(f => f.endsWith(".json"))
                .map(f => ({ name: f, time: statSync(join(BACKUP_DIR, f)).mtime.getTime() }))
                .sort((a, b) => b.time - a.time);

            if (files.length > MAX_BACKUPS) {
                const toDelete = files.slice(MAX_BACKUPS);
                for (const file of toDelete) {
                    unlinkSync(join(BACKUP_DIR, file.name));
                    console.log(`[BackupService] Deleted old backup: ${file.name}`);
                }
            }
        } catch (err) {
            console.error("[BackupService] Cleanup failed:", err);
        }
    }
};
