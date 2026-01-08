const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

console.log('Checking chambers table schema...\n');

db.serialize(() => {
    // First drop chambers_backup if it exists
    db.run('DROP TABLE IF EXISTS chambers_backup;', (err) => {
        if (err) console.error('Error dropping chambers_backup:', err);
        else console.log('Dropped chambers_backup (if existed)');
    });

    // Get the actual table schema
    db.all("PRAGMA table_info(chambers);", (err, columns) => {
        if (err) {
            console.error('Error getting schema:', err);
        } else {
            console.log('\nCurrent chambers table columns:');
            columns.forEach(col => {
                console.log(`  ${col.name}: ${col.type} (nullable: ${col.notnull === 0}, pk: ${col.pk})`);
            });
        }
    });

    // List all tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('Error listing tables:', err);
        } else {
            console.log('\nAll tables:', tables.map(t => t.name).join(', '));
        }
    });
});

db.close();
