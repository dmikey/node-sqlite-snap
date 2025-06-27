[![npm version](https://badge.fury.io/js/sqlite-snap.svg)](https://badge.fury.io/js/sqlite-snap)
[![npm downloads](https://img.shields.io/npm/dm/sqlite-snap.svg)](https://www.npmjs.com/package/sqlite-snap)
[![npm license](https://img.shields.io/npm/l/sqlite-snap.svg)](https://www.npmjs.com/package/sqlite-snap)
[![Node.js supported](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-blue.svg)](https://www.sqlite.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-green.svg)](https://www.npmjs.com/package/sqlite-snap)

# SQLite Backup Library

A standalone, zero-dependency Node.js library for creating, managing, and verifying SQLite database backups. Perfect for automated backup systems, cron jobs, and database maintenance scripts.

## Features

- 🚀 **Multiple backup methods**: SQLite backup command, file copy, and vacuum
- ✅ **Backup verification**: Automatic integrity checking using SQLite's built-in PRAGMA
- 🧹 **Automated cleanup**: Remove old backups based on retention policies
- 📋 **Backup management**: List, verify, and restore backups
- 🔐 **Checksum calculation**: SHA-256 checksums for backup verification
- 📊 **Detailed reporting**: File sizes, durations, and comprehensive status reporting
- 🛠️ **CLI tool**: Command-line interface for easy scripting and automation
- 📦 **Zero dependencies**: Pure Node.js with no external dependencies

## Installation

```bash
npm install sqlite-snap
```

Or install globally for CLI usage:

```bash
npm install -g sqlite-snap
```

## Quick Start

### Programmatic Usage

```javascript
const { SQLiteBackup, BackupUtils } = require('sqlite-snap');

// Initialize backup instance
const backup = new SQLiteBackup({
    databasePath: './data/app.db',
    backupDirectory: './backups'
});

// Create a backup
const result = await backup.createBackup({
    includeTimestamp: true,
    verifyIntegrity: true,
    method: 'backup'
});

if (result.success) {
    console.log(`Backup created: ${result.backupPath}`);
    console.log(`Size: ${BackupUtils.formatSize(result.size)}`);
} else {
    console.error(`Backup failed: ${result.error}`);
}
```

### CLI Usage

```bash
# Create a backup
sqlite-backup create ./data/app.db

# Create backup with custom options
sqlite-backup create ./data/app.db --backup-dir ./custom-backups --method copy

# List all backups
sqlite-backup list ./data/app.db --include-checksums

# Clean up old backups (keep last 30 days)
sqlite-backup cleanup ./data/app.db --retention-days 30

# Restore a backup
sqlite-backup restore ./backups/backup.db ./data/app.db

# Verify backup integrity
sqlite-backup verify ./backups/backup.db
```

## API Reference

### SQLiteBackup Class

#### Constructor

```javascript
const backup = new SQLiteBackup(options)
```

**Options:**
- `databasePath` (string, required): Path to the SQLite database file
- `backupDirectory` (string, optional): Directory to store backups (default: `<database-dir>/backups`)
- `createBackupDir` (boolean, optional): Create backup directory if it doesn't exist (default: `true`)

#### Methods

##### `createBackup(options)`

Creates a backup of the SQLite database.

```javascript
const result = await backup.createBackup({
    filename: 'custom-backup.db',        // Custom filename (optional)
    includeTimestamp: true,              // Include timestamp in filename
    verifyIntegrity: true,               // Verify backup after creation
    method: 'backup'                     // Backup method: 'backup', 'copy', 'vacuum'
});
```

**Returns:** Promise<Object> with backup result

##### `listBackups(options)`

Lists all available backups.

```javascript
const backups = await backup.listBackups({
    pattern: '*.db',                     // File pattern to match
    includeChecksums: false              // Calculate checksums (slower)
});
```

**Returns:** Promise<Array> of backup information objects

##### `cleanup(options)`

Removes old backups based on retention policy.

```javascript
const result = await backup.cleanup({
    retentionDays: 30,                   // Keep backups from last 30 days
    maxBackups: 10,                      // Or keep only 10 most recent backups
    pattern: '*.db'                      // File pattern to match
});
```

**Returns:** Promise<Object> with cleanup results

##### `restore(backupPath, options)`

Restores a backup to the original or specified location.

```javascript
const result = await backup.restore('./backups/backup.db', {
    targetPath: './data/restored.db',    // Target path (optional)
    verifyBefore: true,                  // Verify backup before restore
    createBackupBeforeRestore: true     // Backup current database first
});
```

**Returns:** Promise<Object> with restore results

##### `verifyBackup(backupPath)`

Verifies the integrity of a backup file.

```javascript
const isValid = await backup.verifyBackup('./backups/backup.db');
```

**Returns:** Promise<boolean>

### BackupUtils Class

Utility functions for formatting and validation.

#### Static Methods

##### `formatSize(bytes)`

Formats file size in human-readable format.

```javascript
const size = BackupUtils.formatSize(1048576); // "1.00 MB"
```

##### `formatDuration(milliseconds)`

Formats duration in human-readable format.

```javascript
const duration = BackupUtils.formatDuration(5000); // "5.00s"
```

##### `validateDatabase(databasePath)`

Validates SQLite database integrity.

```javascript
const isValid = await BackupUtils.validateDatabase('./data/app.db');
```

## CLI Reference

### Commands

#### `create <database>`

Creates a backup of the specified database.

```bash
sqlite-backup create ./data/app.db [options]
```

**Options:**
- `--backup-dir <dir>`: Directory to store backups
- `--filename <name>`: Custom filename for backup
- `--no-timestamp`: Don't include timestamp in filename
- `--no-verify`: Skip backup verification
- `--method <method>`: Backup method (backup, copy, vacuum)

#### `list <database>`

Lists all backups for the specified database.

```bash
sqlite-backup list ./data/app.db [options]
```

**Options:**
- `--backup-dir <dir>`: Directory containing backups
- `--include-checksums`: Include checksums in output (slower)

#### `cleanup <database>`

Cleans up old backups based on retention policy.

```bash
sqlite-backup cleanup ./data/app.db [options]
```

**Options:**
- `--retention-days <days>`: Number of days to keep backups
- `--max-backups <number>`: Maximum number of backups to keep
- `--backup-dir <dir>`: Directory containing backups

#### `restore <backup> <database>`

Restores a backup to a database.

```bash
sqlite-backup restore ./backups/backup.db ./data/app.db [options]
```

**Options:**
- `--target <path>`: Target path for restore
- `--no-verify`: Skip backup verification before restore

#### `verify <backup>`

Verifies backup integrity.

```bash
sqlite-backup verify ./backups/backup.db [options]
```

**Options:**
- `--verbose`: Show detailed information

### Global Options

- `--verbose`: Enable verbose output for all commands

## Backup Methods

### 1. SQLite Backup (Default)

Uses SQLite's built-in `.backup` command. This is the recommended method as it creates a consistent backup even while the database is being used.

```javascript
const result = await backup.createBackup({ method: 'backup' });
```

### 2. File Copy

Simple file copy operation. Fast but may not be consistent if database is being written to during backup.

```javascript
const result = await backup.createBackup({ method: 'copy' });
```

### 3. Vacuum

Uses SQLite's VACUUM command to create a compact backup. Good for reducing file size but slower for large databases.

```javascript
const result = await backup.createBackup({ method: 'vacuum' });
```

## Examples

### Basic Automated Backup Script

```javascript
const { SQLiteBackup } = require('sqlite-snap');

async function dailyBackup() {
    const backup = new SQLiteBackup({
        databasePath: './data/production.db',
        backupDirectory: './backups/daily'
    });

    // Create backup
    const result = await backup.createBackup({
        includeTimestamp: true,
        verifyIntegrity: true
    });

    if (result.success) {
        console.log('✅ Daily backup completed');
        
        // Cleanup old backups (keep 30 days)
        await backup.cleanup({ retentionDays: 30 });
    } else {
        console.error('❌ Daily backup failed:', result.error);
        // Send alert/notification
    }
}

// Run daily backup
dailyBackup();
```

### Scheduled Backup with Cron

Create a backup script and schedule it with cron:

```javascript
// backup-script.js
const { SQLiteBackup, BackupUtils } = require('sqlite-snap');

async function scheduledBackup() {
    const backup = new SQLiteBackup({
        databasePath: process.env.DB_PATH || './data/app.db',
        backupDirectory: process.env.BACKUP_DIR || './backups'
    });

    try {
        const result = await backup.createBackup({
            includeTimestamp: true,
            verifyIntegrity: true,
            method: 'backup'
        });

        if (result.success) {
            console.log(`Backup successful: ${BackupUtils.formatSize(result.size)}`);
            
            // Log to file
            const logEntry = {
                timestamp: new Date().toISOString(),
                success: true,
                size: result.size,
                path: result.backupPath,
                duration: result.duration
            };
            
            require('fs').appendFileSync('./backup.log', JSON.stringify(logEntry) + '\n');
            
            // Cleanup old backups
            await backup.cleanup({ retentionDays: 7 });
            
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Backup failed:', error.message);
        process.exit(1);
    }
}

scheduledBackup();
```

Add to crontab for daily backups at 2 AM:
```bash
0 2 * * * /usr/bin/node /path/to/backup-script.js
```

### Backup with Health Monitoring

```javascript
const { SQLiteBackup, BackupUtils } = require('sqlite-snap');

class BackupMonitor {
    constructor(config) {
        this.backup = new SQLiteBackup(config);
        this.alerts = [];
    }

    async performBackupWithMonitoring() {
        const startTime = Date.now();
        
        try {
            // Health check first
            const isHealthy = await BackupUtils.validateDatabase(this.backup.databasePath);
            if (!isHealthy) {
                throw new Error('Database failed health check');
            }

            // Create backup
            const result = await this.backup.createBackup({
                includeTimestamp: true,
                verifyIntegrity: true
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            // Check backup quality
            const backups = await this.backup.listBackups();
            const latestBackup = backups[0];
            
            if (latestBackup.size < (result.size * 0.9)) {
                this.alerts.push('Warning: Backup size significantly smaller than expected');
            }

            // Cleanup
            const cleanupResult = await this.backup.cleanup({ retentionDays: 30 });
            
            return {
                success: true,
                duration: Date.now() - startTime,
                backupInfo: result,
                cleanupInfo: cleanupResult,
                alerts: this.alerts
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                alerts: this.alerts
            };
        }
    }
}

// Usage
const monitor = new BackupMonitor({
    databasePath: './data/app.db',
    backupDirectory: './monitored-backups'
});

monitor.performBackupWithMonitoring().then(result => {
    if (result.success) {
        console.log('✅ Monitored backup completed');
        if (result.alerts.length > 0) {
            console.warn('⚠️ Alerts:', result.alerts);
        }
    } else {
        console.error('❌ Monitored backup failed:', result.error);
    }
});
```

## Error Handling

The library provides comprehensive error handling with detailed error messages:

```javascript
try {
    const backup = new SQLiteBackup({
        databasePath: './nonexistent.db'
    });
} catch (error) {
    console.error('Initialization error:', error.message);
    // "Database file not found: ./nonexistent.db"
}

const result = await backup.createBackup();
if (!result.success) {
    console.error('Backup error:', result.error);
    // Handle backup failure
}
```

## Testing

Run the test suite:

```bash
npm test
```

Run examples:

```bash
npm run example
```

## Requirements

- Node.js 16.0.0 or higher
- SQLite3 command-line tool installed and available in PATH
- Read/write permissions for database and backup directories

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Changelog

### Version 1.0.0
- Initial release
- Core backup functionality
- CLI tool
- Comprehensive test suite
- Full documentation
