import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./museum.db');

app.get('/api/museums', (req, res) => {
    db.all('SELECT * FROM museums', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

app.listen(3001, () => {
    console.log('Server running on http://localhost:3001');
});