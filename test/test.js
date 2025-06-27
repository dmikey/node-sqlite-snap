const { SQLiteBackup, BackupUtils } = require('../lib/index.js');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Simple test suite for SQLite Backup Library
 */

class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async run() {
        console.log('🧪 Running SQLite Backup Library Tests\n');

        for (const test of this.tests) {
            try {
                console.log(`🔍 Testing: ${test.name}`);
                await test.testFn();
                console.log(`✅ PASS: ${test.name}\n`);
                this.passed++;
            } catch (error) {
                console.error(`❌ FAIL: ${test.name}`);
                console.error(`   Error: ${error.message}\n`);
                this.failed++;
            }
        }

        console.log('📊 Test Results:');
        console.log(`   ✅ Passed: ${this.passed}`);
        console.log(`   ❌ Failed: ${this.failed}`);
        console.log(`   📈 Total: ${this.tests.length}`);

        if (this.failed > 0) {
            process.exit(1);
        }
    }
}

// Test utilities
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertExists(filePath, message) {
    if (!fs.existsSync(filePath)) {
        throw new Error(message || `File does not exist: ${filePath}`);
    }
}

// Setup and teardown
async function setupTestEnvironment() {
    const testDir = './test-data';
    const dbPath = path.join(testDir, 'test.db');
    const backupDir = path.join(testDir, 'backups');

    // Clean up any existing test data
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Create test directory
    fs.mkdirSync(testDir, { recursive: true });

    // Create test database
    await execAsync(`sqlite3 "${dbPath}" "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT); INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com'), ('Jane Smith', 'jane@example.com');"`);

    return { testDir, dbPath, backupDir };
}

function cleanupTestEnvironment(testDir) {
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
}

// Initialize test runner
const runner = new TestRunner();

// Test: Basic backup creation
runner.test('Basic backup creation', async () => {
    const { testDir, dbPath, backupDir } = await setupTestEnvironment();

    try {
        const backup = new SQLiteBackup({
            databasePath: dbPath,
            backupDirectory: backupDir
        });

        const result = await backup.createBackup({
            filename: 'test-backup.db',
            includeTimestamp: false,
            verifyIntegrity: true
        });

        assert(result.success, 'Backup should succeed');
        assertExists(result.backupPath, 'Backup file should exist');
        assert(result.size > 0, 'Backup should have positive size');
        assert(result.checksum, 'Backup should have checksum');

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Test: Backup with timestamp
runner.test('Backup with timestamp', async () => {
    const { testDir, dbPath, backupDir } = await setupTestEnvironment();

    try {
        const backup = new SQLiteBackup({
            databasePath: dbPath,
            backupDirectory: backupDir
        });

        const result = await backup.createBackup({
            includeTimestamp: true,
            verifyIntegrity: true
        });

        assert(result.success, 'Backup should succeed');
        assert(result.filename.includes('-'), 'Filename should include timestamp');
        assertExists(result.backupPath, 'Backup file should exist');

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Test: Different backup methods
runner.test('Different backup methods', async () => {
    const { testDir, dbPath, backupDir } = await setupTestEnvironment();

    try {
        const backup = new SQLiteBackup({
            databasePath: dbPath,
            backupDirectory: backupDir
        });

        const methods = ['backup', 'copy'];

        for (const method of methods) {
            const result = await backup.createBackup({
                filename: `test-${method}.db`,
                includeTimestamp: false,
                method: method
            });

            assert(result.success, `${method} backup should succeed`);
            assertEquals(result.method, method, `Method should be ${method}`);
            assertExists(result.backupPath, `${method} backup file should exist`);
        }

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Test: Backup verification
runner.test('Backup verification', async () => {
    const { testDir, dbPath, backupDir } = await setupTestEnvironment();

    try {
        const backup = new SQLiteBackup({
            databasePath: dbPath,
            backupDirectory: backupDir
        });

        const result = await backup.createBackup({
            filename: 'verify-test.db',
            includeTimestamp: false,
            verifyIntegrity: true
        });

        assert(result.success, 'Backup should succeed');

        const isValid = await backup.verifyBackup(result.backupPath);
        assert(isValid, 'Backup should be valid');

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Test: List backups
runner.test('List backups', async () => {
    const { testDir, dbPath, backupDir } = await setupTestEnvironment();

    try {
        const backup = new SQLiteBackup({
            databasePath: dbPath,
            backupDirectory: backupDir
        });

        // Create multiple backups
        await backup.createBackup({ filename: 'backup1.db', includeTimestamp: false });
        await backup.createBackup({ filename: 'backup2.db', includeTimestamp: false });
        await backup.createBackup({ filename: 'backup3.db', includeTimestamp: false });

        const backups = await backup.listBackups({
            includeChecksums: true
        });

        assertEquals(backups.length, 3, 'Should have 3 backups');

        backups.forEach(backup => {
            assert(backup.filename, 'Backup should have filename');
            assert(backup.path, 'Backup should have path');
            assert(backup.size > 0, 'Backup should have positive size');
            assert(backup.created, 'Backup should have creation date');
        });

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Test: Cleanup by retention days
runner.test('Cleanup by retention days', async () => {
    const { testDir, dbPath, backupDir } = await setupTestEnvironment();

    try {
        const backup = new SQLiteBackup({
            databasePath: dbPath,
            backupDirectory: backupDir
        });

        // Create a backup
        const result = await backup.createBackup({
            filename: 'old-backup.db',
            includeTimestamp: false
        });

        // Manually change the file's modification time to make it "old"
        const oldTime = new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)); // 10 days ago
        fs.utimesSync(result.backupPath, oldTime, oldTime);

        // Run cleanup with 7 day retention
        const cleanupResult = await backup.cleanup({
            retentionDays: 7
        });

        assert(cleanupResult.success, 'Cleanup should succeed');
        assertEquals(cleanupResult.removed, 1, 'Should remove 1 old backup');

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Test: Cleanup by max backups
runner.test('Cleanup by max backups', async () => {
    const { testDir, dbPath, backupDir } = await setupTestEnvironment();

    try {
        const backup = new SQLiteBackup({
            databasePath: dbPath,
            backupDirectory: backupDir
        });

        // Create 5 backups
        for (let i = 1; i <= 5; i++) {
            await backup.createBackup({
                filename: `backup${i}.db`,
                includeTimestamp: false
            });

            // Small delay to ensure different modification times
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Keep only 3 most recent
        const cleanupResult = await backup.cleanup({
            maxBackups: 3
        });

        assert(cleanupResult.success, 'Cleanup should succeed');
        assertEquals(cleanupResult.removed, 2, 'Should remove 2 old backups');
        assertEquals(cleanupResult.remainingFiles, 3, 'Should have 3 remaining files');

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Test: Restore backup
runner.test('Restore backup', async () => {
    const { testDir, dbPath, backupDir } = await setupTestEnvironment();

    try {
        const backup = new SQLiteBackup({
            databasePath: dbPath,
            backupDirectory: backupDir
        });

        // Create backup
        const backupResult = await backup.createBackup({
            filename: 'restore-test.db',
            includeTimestamp: false
        });

        assert(backupResult.success, 'Backup creation should succeed');

        // Restore to a new location
        const restorePath = path.join(testDir, 'restored.db');
        const restoreResult = await backup.restore(backupResult.backupPath, {
            targetPath: restorePath,
            createBackupBeforeRestore: false
        });

        assert(restoreResult.success, 'Restore should succeed');
        assertEquals(restoreResult.restoredTo, restorePath, 'Should restore to correct path');
        assertExists(restorePath, 'Restored file should exist');

        // Verify restored database has same content
        const isValid = await BackupUtils.validateDatabase(restorePath);
        assert(isValid, 'Restored database should be valid');

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Test: BackupUtils functions
runner.test('BackupUtils functions', async () => {
    // Test formatSize
    assertEquals(BackupUtils.formatSize(0), '0 B', 'Should format 0 bytes');
    assertEquals(BackupUtils.formatSize(1024), '1.00 KB', 'Should format KB');
    assertEquals(BackupUtils.formatSize(1048576), '1.00 MB', 'Should format MB');

    // Test formatDuration
    assertEquals(BackupUtils.formatDuration(500), '500ms', 'Should format milliseconds');
    assertEquals(BackupUtils.formatDuration(5000), '5.00s', 'Should format seconds');
    assertEquals(BackupUtils.formatDuration(120000), '2.00m', 'Should format minutes');

    // Test validateDatabase
    const { testDir, dbPath } = await setupTestEnvironment();

    try {
        const isValid = await BackupUtils.validateDatabase(dbPath);
        assert(isValid, 'Valid database should return true');

        // Test with non-existent file
        const nonExistentPath = './test-non-existent-' + Date.now() + '.db';
        const invalidResult = await BackupUtils.validateDatabase(nonExistentPath);
        assert(!invalidResult, 'Non-existent database should return false');

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Test: Error handling
runner.test('Error handling', async () => {
    // Test with non-existent database
    const nonExistentPath = './test-non-existent-' + Date.now() + '.db';
    try {
        new SQLiteBackup({
            databasePath: nonExistentPath
        });
        assert(false, 'Should throw error for non-existent database');
    } catch (error) {
        assert(error.message.includes('not found'), 'Should throw appropriate error');
    }

    // Test cleanup without retention options
    const { testDir, dbPath } = await setupTestEnvironment();

    try {
        const backup = new SQLiteBackup({
            databasePath: dbPath,
            backupDirectory: path.join(testDir, 'backups')
        });

        try {
            await backup.cleanup({});
            assert(false, 'Should throw error without retention options');
        } catch (error) {
            assert(error.message.includes('retentionDays or maxBackups'), 'Should throw appropriate error');
        }

    } finally {
        cleanupTestEnvironment(testDir);
    }
});

// Run all tests
if (require.main === module) {
    runner.run().catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { runner };
