import express from 'express';
import sqlite3 from 'sqlite3';

const app = express();

const db = new sqlite3.Database('./museum.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to SQLite database');
    }
});

app.get('/api/museums', (req, res) => {

    db.all(`
        SELECT 
            ID as id,
            name,
            description,
            created_at
        FROM museums
    `, [], (err, rows) => {

        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        res.json(rows);
    });
});

app.get('/api/rooms', (req, res) => {
    db.all('SELECT * FROM rooms', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        res.json(rows);
    });
});

app.get('/api/exhibits', (req, res) => {
    db.all('SELECT * FROM exhibits', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        res.json(rows);
    });
});

app.listen(3001, () => {
    console.log('Server running on port 3001');
}); 
