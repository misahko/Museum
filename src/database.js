import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./museum.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to SQLite database');
    }
});

export function getMuseums() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM museums', [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export default db;