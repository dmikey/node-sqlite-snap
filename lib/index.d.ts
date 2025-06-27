declare module 'sqlite-backup-lib' {
    export interface BackupOptions {
        filename?: string;
        includeTimestamp?: boolean;
        verifyIntegrity?: boolean;
        method?: 'backup' | 'copy' | 'vacuum';
    }

    export interface BackupResult {
        success: boolean;
        backupPath?: string;
        filename?: string;
        size?: number;
        checksum?: string;
        duration?: number;
        timestamp?: string;
        method?: string;
        error?: string;
    }

    export interface ListBackupOptions {
        pattern?: string;
        includeChecksums?: boolean;
    }

    export interface BackupInfo {
        filename: string;
        path: string;
        size: number;
        created: Date;
        modified: Date;
        isValid?: boolean;
        checksum?: string;
    }

    export interface CleanupOptions {
        retentionDays?: number;
        maxBackups?: number;
        pattern?: string;
    }

    export interface CleanupResult {
        success: boolean;
        removed: number;
        removedFiles?: string[];
        errors?: string[];
        totalFiles?: number;
        remainingFiles?: number;
        error?: string;
    }

    export interface RestoreOptions {
        targetPath?: string;
        verifyBefore?: boolean;
        createBackupBeforeRestore?: boolean;
    }

    export interface RestoreResult {
        success: boolean;
        restoredFrom?: string;
        restoredTo?: string;
        preRestoreBackup?: string;
        timestamp?: string;
        error?: string;
    }

    export interface SQLiteBackupConfig {
        databasePath: string;
        backupDirectory?: string;
        createBackupDir?: boolean;
    }

    export class SQLiteBackup {
        constructor(options: SQLiteBackupConfig);

        createBackup(options?: BackupOptions): Promise<BackupResult>;
        
        listBackups(options?: ListBackupOptions): Promise<BackupInfo[]>;
        
        cleanup(options: CleanupOptions): Promise<CleanupResult>;
        
        restore(backupPath: string, options?: RestoreOptions): Promise<RestoreResult>;
        
        verifyBackup(backupPath: string): Promise<boolean>;
    }

    export class BackupUtils {
        static formatSize(bytes: number): string;
        
        static formatDuration(milliseconds: number): string;
        
        static validateDatabase(databasePath: string): Promise<boolean>;
    }
}
