#!/usr/bin/env node

/**
 * SQLite Backup CLI Tool
 * 
 * Command-line interface for the SQLite Backup Library
 */

const { SQLiteBackup, BackupUtils } = require('../lib/index.js');
const path = require('path');
const fs = require('fs');

function showHelp() {
    console.log(`
SQLite Backup CLI Tool

Usage: sqlite-backup <command> [options]

Commands:
  create <database>              Create a backup of the specified database
  list <database>                List all backups for the specified database  
  cleanup <database>             Clean up old backups
  restore <backup> <database>    Restore a backup to a database
  verify <backup>                Verify backup integrity
  help                           Show this help message

Options:
  --backup-dir <dir>             Directory to store backups (default: <database-dir>/backups)
  --filename <name>              Custom filename for backup
  --no-timestamp                 Don't include timestamp in filename
  --no-verify                    Skip backup verification
  --method <method>              Backup method: backup, copy, vacuum (default: backup)
  --retention-days <days>        Number of days to keep backups for cleanup
  --max-backups <number>         Maximum number of backups to keep
  --target <path>                Target path for restore
  --include-checksums            Include checksums when listing backups
  --verbose                      Enable verbose output

Examples:
  sqlite-backup create ./data/app.db
  sqlite-backup create ./data/app.db --backup-dir ./backups --filename custom-backup
  sqlite-backup list ./data/app.db --include-checksums
  sqlite-backup cleanup ./data/app.db --retention-days 30
  sqlite-backup restore ./backups/backup.db ./data/app.db
  sqlite-backup verify ./backups/backup.db
    `);
}

function parseArgs() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
        showHelp();
        process.exit(0);
    }

    const command = args[0];
    const options = {
        verbose: false,
        includeTimestamp: true,
        verifyIntegrity: true,
        method: 'backup'
    };

    let positionalArgs = [];

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--')) {
            const key = arg.slice(2);

            switch (key) {
                case 'backup-dir':
                    options.backupDirectory = args[++i];
                    break;
                case 'filename':
                    options.filename = args[++i];
                    break;
                case 'no-timestamp':
                    options.includeTimestamp = false;
                    break;
                case 'no-verify':
                    options.verifyIntegrity = false;
                    break;
                case 'method':
                    options.method = args[++i];
                    break;
                case 'retention-days':
                    options.retentionDays = parseInt(args[++i]);
                    break;
                case 'max-backups':
                    options.maxBackups = parseInt(args[++i]);
                    break;
                case 'target':
                    options.targetPath = args[++i];
                    break;
                case 'include-checksums':
                    options.includeChecksums = true;
                    break;
                case 'verbose':
                    options.verbose = true;
                    break;
                default:
                    console.error(`Unknown option: --${key}`);
                    process.exit(1);
            }
        } else {
            positionalArgs.push(arg);
        }
    }

    return { command, args: positionalArgs, options };
}

async function createBackup(databasePath, options) {
    try {
        if (options.verbose) {
            console.log(`🚀 Creating backup for: ${databasePath}`);
            console.log(`📝 Options:`, options);
        } else {
            console.log(`🚀 Creating backup for: ${path.basename(databasePath)}`);
        }

        const backup = new SQLiteBackup({
            databasePath,
            backupDirectory: options.backupDirectory
        });

        const result = await backup.createBackup({
            filename: options.filename,
            includeTimestamp: options.includeTimestamp,
            verifyIntegrity: options.verifyIntegrity,
            method: options.method
        });

        if (result.success) {
            console.log('✅ Backup created successfully!');
            console.log(`📁 Location: ${result.backupPath}`);
            console.log(`📏 Size: ${BackupUtils.formatSize(result.size)}`);
            console.log(`⏱️  Duration: ${BackupUtils.formatDuration(result.duration)}`);

            if (result.checksum) {
                console.log(`🔐 Checksum: ${result.checksum}`);
            }
        } else {
            console.error('❌ Backup failed:', result.error);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function listBackups(databasePath, options) {
    try {
        console.log(`📋 Listing backups for: ${path.basename(databasePath)}`);

        const backup = new SQLiteBackup({
            databasePath,
            backupDirectory: options.backupDirectory
        });

        const backups = await backup.listBackups({
            includeChecksums: options.includeChecksums
        });

        if (backups.length === 0) {
            console.log('ℹ️  No backups found');
            return;
        }

        console.log(`\nFound ${backups.length} backup(s):\n`);

        backups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.filename}`);
            console.log(`   📁 Path: ${backup.path}`);
            console.log(`   📏 Size: ${BackupUtils.formatSize(backup.size)}`);
            console.log(`   📅 Created: ${backup.created.toISOString()}`);

            if (options.includeChecksums) {
                console.log(`   🔐 Checksum: ${backup.checksum || 'N/A'}`);
                console.log(`   ✅ Valid: ${backup.isValid !== null ? (backup.isValid ? 'Yes' : 'No') : 'Unknown'}`);
            }

            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function cleanupBackups(databasePath, options) {
    try {
        if (!options.retentionDays && !options.maxBackups) {
            console.error('❌ Either --retention-days or --max-backups must be specified');
            process.exit(1);
        }

        const retentionText = options.retentionDays ?
            `older than ${options.retentionDays} days` :
            `keeping only ${options.maxBackups} most recent`;

        console.log(`🧹 Cleaning up backups ${retentionText} for: ${path.basename(databasePath)}`);

        const backup = new SQLiteBackup({
            databasePath,
            backupDirectory: options.backupDirectory
        });

        const result = await backup.cleanup({
            retentionDays: options.retentionDays,
            maxBackups: options.maxBackups
        });

        if (result.success) {
            if (result.removed > 0) {
                console.log(`✅ Removed ${result.removed} old backup(s)`);

                if (options.verbose && result.removedFiles.length > 0) {
                    console.log('📁 Removed files:');
                    result.removedFiles.forEach(file => console.log(`   - ${file}`));
                }
            } else {
                console.log('ℹ️  No old backups to remove');
            }

            console.log(`📊 Total backups: ${result.totalFiles}, Remaining: ${result.remainingFiles}`);

            if (result.errors.length > 0) {
                console.warn('⚠️  Some errors occurred:');
                result.errors.forEach(error => console.warn(`   ${error}`));
            }
        } else {
            console.error('❌ Cleanup failed:', result.error);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function restoreBackup(backupPath, databasePath, options) {
    try {
        console.log(`🔄 Restoring backup: ${path.basename(backupPath)}`);
        console.log(`📍 Target: ${databasePath}`);

        const backup = new SQLiteBackup({
            databasePath,
            backupDirectory: options.backupDirectory
        });

        const result = await backup.restore(backupPath, {
            targetPath: options.targetPath || databasePath,
            verifyBefore: options.verifyIntegrity,
            createBackupBeforeRestore: true
        });

        if (result.success) {
            console.log('✅ Restore completed successfully!');
            console.log(`📁 Restored to: ${result.restoredTo}`);

            if (result.preRestoreBackup) {
                console.log(`💾 Pre-restore backup: ${result.preRestoreBackup}`);
            }
        } else {
            console.error('❌ Restore failed:', result.error);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function verifyBackup(backupPath, options) {
    try {
        console.log(`🔍 Verifying backup: ${path.basename(backupPath)}`);

        const isValid = await BackupUtils.validateDatabase(backupPath);

        if (isValid) {
            console.log('✅ Backup is valid');
        } else {
            console.log('❌ Backup is corrupted or invalid');
            process.exit(1);
        }

        if (options.verbose) {
            const stats = fs.statSync(backupPath);
            console.log(`📏 Size: ${BackupUtils.formatSize(stats.size)}`);
            console.log(`📅 Modified: ${stats.mtime.toISOString()}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function main() {
    const { command, args, options } = parseArgs();

    try {
        switch (command) {
            case 'create':
                if (args.length !== 1) {
                    console.error('❌ Usage: sqlite-backup create <database>');
                    process.exit(1);
                }
                await createBackup(args[0], options);
                break;

            case 'list':
                if (args.length !== 1) {
                    console.error('❌ Usage: sqlite-backup list <database>');
                    process.exit(1);
                }
                await listBackups(args[0], options);
                break;

            case 'cleanup':
                if (args.length !== 1) {
                    console.error('❌ Usage: sqlite-backup cleanup <database>');
                    process.exit(1);
                }
                await cleanupBackups(args[0], options);
                break;

            case 'restore':
                if (args.length !== 2) {
                    console.error('❌ Usage: sqlite-backup restore <backup> <database>');
                    process.exit(1);
                }
                await restoreBackup(args[0], args[1], options);
                break;

            case 'verify':
                if (args.length !== 1) {
                    console.error('❌ Usage: sqlite-backup verify <backup>');
                    process.exit(1);
                }
                await verifyBackup(args[0], options);
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }

    } catch (error) {
        console.error('❌ Command failed:', error.message);
        process.exit(1);
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Run the CLI
if (require.main === module) {
    main();
}

module.exports = { main };
