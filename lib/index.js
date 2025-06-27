const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * SQLite Backup Library
 * 
 * A standalone library for creating, managing, and verifying SQLite database backups.
 */
class SQLiteBackup {
    /**
     * Create a new SQLiteBackup instance
     * @param {Object} options - Configuration options
     * @param {string} options.databasePath - Path to the SQLite database file
     * @param {string} options.backupDirectory - Directory to store backups (default: same directory as database)
     * @param {boolean} options.createBackupDir - Create backup directory if it doesn't exist (default: true)
     */
    constructor(options = {}) {
        if (!options.databasePath) {
            throw new Error('Database path is required');
        }

        this.databasePath = path.resolve(options.databasePath);
        this.backupDirectory = options.backupDirectory ?
            path.resolve(options.backupDirectory) :
            path.join(path.dirname(this.databasePath), 'backups');
        this.createBackupDir = options.createBackupDir !== false;

        // Validate database file exists
        if (!fs.existsSync(this.databasePath)) {
            throw new Error(`Database file not found: ${this.databasePath}`);
        }

        // Create backup directory if needed
        if (this.createBackupDir && !fs.existsSync(this.backupDirectory)) {
            fs.mkdirSync(this.backupDirectory, { recursive: true });
        }
    }

    /**
     * Create a backup of the SQLite database
     * @param {Object} options - Backup options
     * @param {string} options.filename - Custom filename for backup (default: auto-generated)
     * @param {boolean} options.includeTimestamp - Include timestamp in filename (default: true)
     * @param {boolean} options.verifyIntegrity - Verify backup integrity (default: true)
     * @param {string} options.method - Backup method: 'backup', 'copy', 'vacuum' (default: 'backup')
     * @returns {Promise<Object>} Backup result object
     */
    async createBackup(options = {}) {
        const {
            filename,
            includeTimestamp = true,
            verifyIntegrity = true,
            method = 'backup'
        } = options;

        try {
            const startTime = Date.now();

            // Generate backup filename
            const backupFileName = this._generateBackupFilename(filename, includeTimestamp);
            const backupPath = path.join(this.backupDirectory, backupFileName);

            // Create backup based on method
            await this._performBackup(method, backupPath);

            // Verify backup integrity if requested
            if (verifyIntegrity) {
                const isValid = await this.verifyBackup(backupPath);
                if (!isValid) {
                    fs.unlinkSync(backupPath);
                    throw new Error('Backup failed integrity check');
                }
            }

            // Get backup file stats
            const stats = fs.statSync(backupPath);
            const checksum = await this._calculateChecksum(backupPath);
            const duration = Date.now() - startTime;

            const result = {
                success: true,
                backupPath,
                filename: backupFileName,
                size: stats.size,
                checksum,
                duration,
                timestamp: new Date().toISOString(),
                method
            };

            return result;

        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Verify the integrity of a backup file
     * @param {string} backupPath - Path to the backup file
     * @returns {Promise<boolean>} True if backup is valid
     */
    async verifyBackup(backupPath) {
        try {
            // Check if file exists first
            if (!fs.existsSync(backupPath)) {
                return false;
            }

            const command = `sqlite3 "${backupPath}" "PRAGMA integrity_check;"`;
            const { stdout } = await execAsync(command);
            return stdout.trim() === 'ok';
        } catch (error) {
            return false;
        }
    }

    /**
     * Clean up old backup files based on retention policy
     * @param {Object} options - Cleanup options
     * @param {number} options.retentionDays - Number of days to keep backups
     * @param {number} options.maxBackups - Maximum number of backups to keep (alternative to retentionDays)
     * @param {string} options.pattern - File pattern to match (default: '*.db')
     * @returns {Promise<Object>} Cleanup result object
     */
    async cleanup(options = {}) {
        const {
            retentionDays,
            maxBackups,
            pattern = '*.db'
        } = options;

        if (!retentionDays && !maxBackups) {
            throw new Error('Either retentionDays or maxBackups must be specified');
        }

        try {
            const files = this._getBackupFiles(pattern);
            let filesToRemove = [];

            if (retentionDays) {
                const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
                filesToRemove = files.filter(file => file.stats.mtime < cutoffDate);
            } else if (maxBackups) {
                // Sort by modification time (newest first) and keep only maxBackups
                files.sort((a, b) => b.stats.mtime - a.stats.mtime);
                filesToRemove = files.slice(maxBackups);
            }

            const removed = [];
            const errors = [];

            for (const file of filesToRemove) {
                try {
                    fs.unlinkSync(file.path);
                    removed.push(file.name);
                } catch (error) {
                    errors.push(`Failed to remove ${file.name}: ${error.message}`);
                }
            }

            return {
                success: true,
                removed: removed.length,
                removedFiles: removed,
                errors,
                totalFiles: files.length,
                remainingFiles: files.length - removed.length
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                removed: 0,
                errors: [error.message]
            };
        }
    }

    /**
     * Get information about existing backups
     * @param {Object} options - List options
     * @param {string} options.pattern - File pattern to match (default: '*.db')
     * @param {boolean} options.includeChecksums - Calculate checksums for each backup (default: false)
     * @returns {Promise<Array>} Array of backup information objects
     */
    async listBackups(options = {}) {
        const {
            pattern = '*.db',
            includeChecksums = false
        } = options;

        try {
            const files = this._getBackupFiles(pattern);
            const backups = [];

            for (const file of files) {
                const backup = {
                    filename: file.name,
                    path: file.path,
                    size: file.stats.size,
                    created: file.stats.birthtime,
                    modified: file.stats.mtime,
                    isValid: null,
                    checksum: null
                };

                if (includeChecksums) {
                    backup.checksum = await this._calculateChecksum(file.path);
                    backup.isValid = await this.verifyBackup(file.path);
                }

                backups.push(backup);
            }

            // Sort by creation time (newest first)
            backups.sort((a, b) => b.created - a.created);

            return backups;

        } catch (error) {
            throw new Error(`Failed to list backups: ${error.message}`);
        }
    }

    /**
     * Restore a backup to the original database location or a new location
     * @param {string} backupPath - Path to the backup file
     * @param {Object} options - Restore options
     * @param {string} options.targetPath - Target path for restore (default: original database path)
     * @param {boolean} options.verifyBefore - Verify backup before restore (default: true)
     * @param {boolean} options.createBackupBeforeRestore - Create backup of current database before restore (default: true)
     * @returns {Promise<Object>} Restore result object
     */
    async restore(backupPath, options = {}) {
        const {
            targetPath = this.databasePath,
            verifyBefore = true,
            createBackupBeforeRestore = true
        } = options;

        try {
            // Verify backup before restore
            if (verifyBefore) {
                const isValid = await this.verifyBackup(backupPath);
                if (!isValid) {
                    throw new Error('Backup file failed integrity check');
                }
            }

            let currentBackupPath = null;

            // Create backup of current database if requested
            if (createBackupBeforeRestore && fs.existsSync(targetPath)) {
                const currentBackupResult = await this.createBackup({
                    filename: `pre-restore-backup-${Date.now()}.db`,
                    includeTimestamp: false
                });

                if (currentBackupResult.success) {
                    currentBackupPath = currentBackupResult.backupPath;
                } else {
                    throw new Error(`Failed to create pre-restore backup: ${currentBackupResult.error}`);
                }
            }

            // Perform restore (copy backup to target location)
            fs.copyFileSync(backupPath, targetPath);

            // Verify restored database
            const restoredIsValid = await this.verifyBackup(targetPath);
            if (!restoredIsValid) {
                throw new Error('Restored database failed integrity check');
            }

            return {
                success: true,
                restoredFrom: backupPath,
                restoredTo: targetPath,
                preRestoreBackup: currentBackupPath,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Private methods

    _generateBackupFilename(customFilename, includeTimestamp) {
        if (customFilename) {
            return customFilename.endsWith('.db') ? customFilename : `${customFilename}.db`;
        }

        const baseName = path.basename(this.databasePath, '.db');
        const timestamp = includeTimestamp ?
            `-${new Date().toISOString().replace(/[:.]/g, '-')}` : '';

        return `${baseName}-backup${timestamp}.db`;
    }

    async _performBackup(method, backupPath) {
        switch (method) {
            case 'backup':
                return this._backupUsingBackupCommand(backupPath);
            case 'copy':
                return this._backupUsingCopy(backupPath);
            case 'vacuum':
                return this._backupUsingVacuum(backupPath);
            default:
                throw new Error(`Unknown backup method: ${method}`);
        }
    }

    async _backupUsingBackupCommand(backupPath) {
        const command = `sqlite3 "${this.databasePath}" ".backup '${backupPath}'"`;
        await execAsync(command);
    }

    async _backupUsingCopy(backupPath) {
        fs.copyFileSync(this.databasePath, backupPath);
    }

    async _backupUsingVacuum(backupPath) {
        const command = `sqlite3 "${this.databasePath}" ".backup '${backupPath}'" ".exit"`;
        await execAsync(command);
    }

    async _calculateChecksum(filePath) {
        try {
            const { stdout } = await execAsync(`shasum -a 256 "${filePath}"`);
            return stdout.split(' ')[0];
        } catch (error) {
            return null;
        }
    }

    _getBackupFiles(pattern) {
        if (!fs.existsSync(this.backupDirectory)) {
            return [];
        }

        const files = fs.readdirSync(this.backupDirectory);
        const backupFiles = [];

        for (const filename of files) {
            if (this._matchesPattern(filename, pattern)) {
                const filePath = path.join(this.backupDirectory, filename);
                const stats = fs.statSync(filePath);

                backupFiles.push({
                    name: filename,
                    path: filePath,
                    stats
                });
            }
        }

        return backupFiles;
    }

    _matchesPattern(filename, pattern) {
        // Simple pattern matching - could be enhanced with a proper glob library
        if (pattern === '*' || pattern === '*.*') return true;
        if (pattern.startsWith('*.')) {
            const extension = pattern.slice(2);
            return filename.endsWith('.' + extension);
        }
        return filename === pattern;
    }
}

/**
 * Utility functions for format and helpers
 */
class BackupUtils {
    /**
     * Format file size in human readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size string
     */
    static formatSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }

    /**
     * Format duration in human readable format
     * @param {number} milliseconds - Duration in milliseconds
     * @returns {string} Formatted duration string
     */
    static formatDuration(milliseconds) {
        if (milliseconds < 1000) return `${milliseconds}ms`;
        if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(2)}s`;
        return `${(milliseconds / 60000).toFixed(2)}m`;
    }

    /**
     * Validate SQLite database file
     * @param {string} databasePath - Path to database file
     * @returns {Promise<boolean>} True if database is valid
     */
    static async validateDatabase(databasePath) {
        try {
            // Check if file exists first
            if (!require('fs').existsSync(databasePath)) {
                return false;
            }

            const command = `sqlite3 "${databasePath}" "PRAGMA integrity_check;"`;
            const { stdout } = await execAsync(command);
            return stdout.trim() === 'ok';
        } catch (error) {
            return false;
        }
    }
}

module.exports = {
    SQLiteBackup,
    BackupUtils
};
