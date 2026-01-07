const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

const tablesToDrop = [
    'chambers_backup',
    '_chambers_old_20250831',
    '_chambers_old_20250831_1',
    '_chambers_old_20250831_2',
    '_chambers_old_20250831_3',
    '_chambers_old_20250911'
];

console.log('Starting database cleanup...');

db.serialize(() => {
    // Disable foreign key checks temporarily
    db.run('PRAGMA foreign_keys = OFF;', (err) => {
        if (err) console.error('Error disabling foreign keys:', err);
        else console.log('Foreign key checks disabled.');
    });

    // Drop each backup table
    tablesToDrop.forEach(table => {
        db.run(`DROP TABLE IF EXISTS "${table}";`, (err) => {
            if (err) {
                console.error(`Error dropping ${table}:`, err.message);
            } else {
                console.log(`Dropped table: ${table}`);
            }
        });
    });

    // Re-enable foreign key checks
    db.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) console.error('Error re-enabling foreign keys:', err);
        else console.log('Foreign key checks re-enabled.');
    });

    // List remaining tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('Error listing tables:', err);
        } else {
            console.log('\nRemaining tables:', tables.map(t => t.name).join(', '));
        }
    });
});

db.close((err) => {
    if (err) console.error('Error closing database:', err);
    else console.log('\nDatabase cleanup complete!');
});
