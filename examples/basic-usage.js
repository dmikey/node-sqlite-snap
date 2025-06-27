const { SQLiteBackup, BackupUtils } = require('../lib/index.js');
const path = require('path');

/**
 * Basic usage examples for SQLite Backup Library
 */

async function basicExample() {
    console.log('=== Basic SQLite Backup Example ===\n');

    try {
        // Initialize the backup instance
        // Note: Make sure you have a sample database file for testing
        const databasePath = './data/app.db'; // Adjust path as needed

        const backup = new SQLiteBackup({
            databasePath: databasePath,
            backupDirectory: './data/backups'
        });

        console.log('📦 Creating backup...');

        // Create a backup
        const backupResult = await backup.createBackup({
            includeTimestamp: true,
            verifyIntegrity: true,
            method: 'backup'
        });

        if (backupResult.success) {
            console.log('✅ Backup created successfully!');
            console.log(`📁 Location: ${backupResult.backupPath}`);
            console.log(`📏 Size: ${BackupUtils.formatSize(backupResult.size)}`);
            console.log(`⏱️  Duration: ${BackupUtils.formatDuration(backupResult.duration)}`);
            console.log(`🔐 Checksum: ${backupResult.checksum}`);
        } else {
            console.error('❌ Backup failed:', backupResult.error);
            return;
        }

        console.log('\n📋 Listing all backups...');

        // List all backups
        const backups = await backup.listBackups({
            includeChecksums: true
        });

        backups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.filename}`);
            console.log(`   📏 Size: ${BackupUtils.formatSize(backup.size)}`);
            console.log(`   📅 Created: ${backup.created.toISOString()}`);
            console.log(`   ✅ Valid: ${backup.isValid ? 'Yes' : 'No'}`);
        });

        console.log('\n🧹 Cleaning up old backups (keeping last 5)...');

        // Cleanup old backups
        const cleanupResult = await backup.cleanup({
            maxBackups: 5
        });

        if (cleanupResult.success) {
            console.log(`✅ Cleanup completed. Removed ${cleanupResult.removed} backups`);
            console.log(`📊 Total: ${cleanupResult.totalFiles}, Remaining: ${cleanupResult.remainingFiles}`);
        } else {
            console.error('❌ Cleanup failed:', cleanupResult.error);
        }

    } catch (error) {
        console.error('❌ Example failed:', error.message);
    }
}

async function advancedExample() {
    console.log('\n=== Advanced SQLite Backup Example ===\n');

    try {
        const databasePath = './data/app.db';

        const backup = new SQLiteBackup({
            databasePath: databasePath,
            backupDirectory: './data/backups'
        });

        console.log('📦 Creating multiple backups with different methods...');

        // Create backups using different methods
        const methods = ['backup', 'copy', 'vacuum'];
        const results = [];

        for (const method of methods) {
            console.log(`\n🔄 Creating backup using method: ${method}`);

            const result = await backup.createBackup({
                filename: `test-${method}-backup.db`,
                includeTimestamp: false,
                verifyIntegrity: true,
                method: method
            });

            if (result.success) {
                console.log(`✅ ${method} backup created in ${BackupUtils.formatDuration(result.duration)}`);
                results.push(result);
            } else {
                console.error(`❌ ${method} backup failed:`, result.error);
            }
        }

        // Compare backup sizes
        console.log('\n📊 Backup comparison:');
        results.forEach(result => {
            console.log(`${path.basename(result.backupPath)}: ${BackupUtils.formatSize(result.size)} (${result.method})`);
        });

        // Demonstrate restore functionality
        if (results.length > 0) {
            console.log('\n🔄 Testing restore functionality...');

            const testRestorePath = './data/restored-test.db';
            const restoreResult = await backup.restore(results[0].backupPath, {
                targetPath: testRestorePath,
                verifyBefore: true,
                createBackupBeforeRestore: false
            });

            if (restoreResult.success) {
                console.log('✅ Restore test successful');
                console.log(`📁 Restored to: ${restoreResult.restoredTo}`);

                // Clean up test file
                const fs = require('fs');
                if (fs.existsSync(testRestorePath)) {
                    fs.unlinkSync(testRestorePath);
                    console.log('🧹 Cleaned up test restore file');
                }
            } else {
                console.error('❌ Restore test failed:', restoreResult.error);
            }
        }

    } catch (error) {
        console.error('❌ Advanced example failed:', error.message);
    }
}

async function scheduledBackupExample() {
    console.log('\n=== Scheduled Backup Example ===\n');

    try {
        const databasePath = './data/app.db';

        const backup = new SQLiteBackup({
            databasePath: databasePath,
            backupDirectory: './data/scheduled-backups'
        });

        console.log('⏰ Simulating scheduled backup routine...');

        // Simulate a scheduled backup that might run daily
        const performScheduledBackup = async () => {
            const startTime = Date.now();

            console.log(`\n🔄 Starting scheduled backup at ${new Date().toISOString()}`);

            // Create backup
            const backupResult = await backup.createBackup({
                includeTimestamp: true,
                verifyIntegrity: true,
                method: 'backup'
            });

            if (backupResult.success) {
                console.log('✅ Scheduled backup completed');

                // Cleanup old backups (keep 7 days)
                const cleanupResult = await backup.cleanup({
                    retentionDays: 7
                });

                if (cleanupResult.success && cleanupResult.removed > 0) {
                    console.log(`🧹 Cleaned up ${cleanupResult.removed} old backups`);
                }

                // Log the backup info (you might want to save this to a log file)
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    success: true,
                    duration: BackupUtils.formatDuration(Date.now() - startTime),
                    size: BackupUtils.formatSize(backupResult.size),
                    path: backupResult.backupPath,
                    checksum: backupResult.checksum
                };

                console.log('📝 Backup log entry:', JSON.stringify(logEntry, null, 2));

            } else {
                console.error('❌ Scheduled backup failed:', backupResult.error);

                // Log the failure
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    success: false,
                    error: backupResult.error,
                    duration: BackupUtils.formatDuration(Date.now() - startTime)
                };

                console.log('📝 Error log entry:', JSON.stringify(logEntry, null, 2));
            }
        };

        // Run the scheduled backup
        await performScheduledBackup();

        console.log('\n💡 To set up actual scheduled backups, you could:');
        console.log('   1. Use cron on Linux/macOS: 0 2 * * * /usr/bin/node /path/to/your/backup-script.js');
        console.log('   2. Use Windows Task Scheduler');
        console.log('   3. Use a process manager like PM2 with cron jobs');
        console.log('   4. Use cloud functions with scheduled triggers');

    } catch (error) {
        console.error('❌ Scheduled backup example failed:', error.message);
    }
}

async function runAllExamples() {
    console.log('🚀 SQLite Backup Library Examples\n');

    // Check if database exists
    const fs = require('fs');
    const testDbPath = './data/app.db';

    if (!fs.existsSync(testDbPath)) {
        console.log('⚠️  Test database not found. Creating a sample database...');

        // Create sample database
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        // Ensure data directory exists
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data', { recursive: true });
        }

        try {
            await execAsync(`sqlite3 "${testDbPath}" "CREATE TABLE IF NOT EXISTS sample (id INTEGER PRIMARY KEY, name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP); INSERT INTO sample (name) VALUES ('Sample Data 1'), ('Sample Data 2'), ('Sample Data 3');"`);
            console.log('✅ Sample database created');
        } catch (error) {
            console.error('❌ Failed to create sample database:', error.message);
            console.log('Please create a test database manually or adjust the database path in the examples');
            return;
        }
    }

    await basicExample();
    await advancedExample();
    await scheduledBackupExample();

    console.log('\n🎉 All examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples().catch(error => {
        console.error('❌ Examples failed:', error);
        process.exit(1);
    });
}

module.exports = {
    basicExample,
    advancedExample,
    scheduledBackupExample,
    runAllExamples
};
