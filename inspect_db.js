const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

async function inspect() {
    return new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='table'", async (err, tables) => {
            if (err) {
                console.error(err);
                resolve();
                return;
            }

            for (const table of tables) {
                console.log('--- Table:', table.name, '---');
                await new Promise((res) => {
                    db.all(`SELECT * FROM ${table.name}`, (err, rows) => {
                        if (err) {
                            console.log(`Error reading ${table.name}:`, err.message);
                        } else {
                            console.log(`Table ${table.name} has ${rows.length} rows.`);
                            if (rows.length > 0) {
                                // show first 3 rows
                                console.log(`Sample rows from ${table.name}:`, rows.slice(0, 3));

                                if (table.name === 'chambers' || table.name.includes('backup') || table.name.includes('old')) {
                                    const ids = rows.map(r => r.id);
                                    const uniqueIds = new Set(ids);
                                    if (ids.length !== uniqueIds.size) {
                                        console.log(`WARNING: Duplicate IDs found in ${table.name}!`);
                                    } else {
                                        console.log(`IDs in ${table.name} are unique.`);
                                    }
                                }
                            }
                        }
                        res();
                    });
                });
            }
            resolve();
        });
    });
}

inspect().then(() => {
    db.close();
});
