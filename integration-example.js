const { SQLiteBackup, BackupUtils } = require('./lib/index.js');

/**
 * Simple integration example showing how to use the SQLite Backup Library
 * This replaces the functionality from the original index.js script
 */

async function performDatabaseBackup(options = {}) {
    const {
        databasePath = './data/app.db',
        backupDirectory = './data/backups',
        method = 'backup',
        retention = 30,
        verify = true
    } = options;

    console.log('🚀 Starting database backup...');
    console.log(`📝 Database: ${databasePath}`);
    console.log(`📁 Backup directory: ${backupDirectory}`);
    console.log(`🔧 Method: ${method}, Retention: ${retention}d, Verify: ${verify}`);

    try {
        // Initialize backup instance
        const backup = new SQLiteBackup({
            databasePath,
            backupDirectory
        });

        // Health check
        console.log('🔍 Performing database health check...');
        const isHealthy = await BackupUtils.validateDatabase(databasePath);
        if (!isHealthy) {
            throw new Error('Database failed health check');
        }
        console.log('✅ Database health check passed');

        // Create backup
        console.log('📦 Creating backup...');
        const startTime = Date.now();

        const backupResult = await backup.createBackup({
            includeTimestamp: true,
            verifyIntegrity: verify,
            method: method
        });

        if (backupResult.success) {
            console.log('✅ Backup created successfully!');
            console.log(`📁 Location: ${backupResult.backupPath}`);
            console.log(`📏 Size: ${BackupUtils.formatSize(backupResult.size)}`);
            console.log(`🔐 Checksum: ${backupResult.checksum}`);
            console.log(`⏱️  Duration: ${BackupUtils.formatDuration(backupResult.duration)}`);
        } else {
            throw new Error(backupResult.error);
        }

        // Cleanup old backups
        if (retention > 0) {
            console.log(`🧹 Cleaning up backups older than ${retention} days...`);

            const cleanupResult = await backup.cleanup({
                retentionDays: retention
            });

            if (cleanupResult.success) {
                if (cleanupResult.removed > 0) {
                    console.log(`✅ Removed ${cleanupResult.removed} old backup(s)`);
                } else {
                    console.log('ℹ️  No old backups to remove');
                }
            } else {
                console.warn('⚠️  Cleanup failed:', cleanupResult.error);
            }
        }

        console.log('==================================================');
        console.log('✅ Backup process completed successfully!');
        console.log('==================================================');

        return {
            success: true,
            backupInfo: backupResult,
            duration: Date.now() - startTime
        };

    } catch (error) {
        console.error('❌ Backup process failed:', error.message);

        console.log('==================================================');
        console.log('❌ Backup process failed!');
        console.log('==================================================');

        return {
            success: false,
            error: error.message
        };
    }
}

// Command line argument parsing (simplified version of original)
function parseSimpleArgs() {
    const args = process.argv.slice(2);
    const options = {
        method: 'backup',
        retention: 30,
        verify: true
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--method':
                options.method = args[++i];
                break;
            case '--retention':
                options.retention = parseInt(args[++i]);
                break;
            case '--no-verify':
                options.verify = false;
                break;
            case '--database':
                options.databasePath = args[++i];
                break;
            case '--backup-dir':
                options.backupDirectory = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(`
SQLite Database Backup Tool (Library Version)

Usage: node integration-example.js [options]

Options:
  --database <path>      Path to SQLite database (default: ./data/app.db)
  --backup-dir <path>    Backup directory (default: ./data/backups)
  --method <method>      Backup method: backup, copy, vacuum (default: backup)
  --retention <days>     Days to keep backups (default: 30)
  --no-verify           Skip backup verification
  --help, -h            Show this help

For more advanced usage, use the CLI tool:
  sqlite-backup create ./data/app.db --method backup --retention 30

Or use the library programmatically - see examples/ directory.
                `);
                process.exit(0);
                break;
        }
    }

    return options;
}

// Main execution (compatible with original script usage)
async function main() {
    const options = parseSimpleArgs();

    console.log('==================================================');
    console.log('📦 SQLite Database Backup Tool (Library Version)');
    console.log('==================================================');

    const result = await performDatabaseBackup(options);

    if (!result.success) {
        process.exit(1);
    }
}

// Handle errors (same as original)
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Run the script if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
}

// Export functions for use as a module
module.exports = {
    performDatabaseBackup,
    SQLiteBackup,
    BackupUtils
};
