import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";

const db = new Database("database.sqlite");

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS player_teams (
    player_id INTEGER,
    team_id INTEGER,
    FOREIGN KEY(player_id) REFERENCES players(id),
    FOREIGN KEY(team_id) REFERENCES teams(id),
    PRIMARY KEY(player_id, team_id)
  );
`);

// Seed data if empty
const teamCount = db.prepare("SELECT COUNT(*) as count FROM teams").get() as { count: number };
if (teamCount.count === 0) {
  const insertTeam = db.prepare("INSERT INTO teams (name, logo_url) VALUES (?, ?)");
  const insertPlayer = db.prepare("INSERT INTO players (name) VALUES (?)");
  const insertPlayerTeam = db.prepare("INSERT INTO player_teams (player_id, team_id) VALUES (?, ?)");

  db.transaction(() => {
    // Teams
    const juveId = insertTeam.run("Juventus", "https://upload.wikimedia.org/wikipedia/commons/b/bc/Juventus_FC_-_pictogram_black_%28Italy%2C_2017%29.svg").lastInsertRowid;
    const interId = insertTeam.run("Inter", "https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg").lastInsertRowid;
    const milanId = insertTeam.run("AC Milan", "https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg").lastInsertRowid;
    const romaId = insertTeam.run("AS Roma", "https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo_%282017%29.svg").lastInsertRowid;
    const napoliId = insertTeam.run("SSC Napoli", "https://upload.wikimedia.org/wikipedia/commons/2/28/S.S.C._Napoli_logo.svg").lastInsertRowid;

    // Players
    const ibraId = insertPlayer.run("Zlatan Ibrahimovic").lastInsertRowid;
    const ronaldoId = insertPlayer.run("Ronaldo").lastInsertRowid;
    const pirloId = insertPlayer.run("Andrea Pirlo").lastInsertRowid;
    const baggioId = insertPlayer.run("Roberto Baggio").lastInsertRowid;
    const vieriId = insertPlayer.run("Christian Vieri").lastInsertRowid;
    const seedorfId = insertPlayer.run("Clarence Seedorf").lastInsertRowid;

    // Relations
    // Ibra: Juve, Inter, Milan
    insertPlayerTeam.run(ibraId, juveId);
    insertPlayerTeam.run(ibraId, interId);
    insertPlayerTeam.run(ibraId, milanId);

    // Ronaldo: Inter, Milan
    insertPlayerTeam.run(ronaldoId, interId);
    insertPlayerTeam.run(ronaldoId, milanId);

    // Pirlo: Inter, Milan, Juve
    insertPlayerTeam.run(pirloId, interId);
    insertPlayerTeam.run(pirloId, milanId);
    insertPlayerTeam.run(pirloId, juveId);

    // Baggio: Juve, Milan, Inter
    insertPlayerTeam.run(baggioId, juveId);
    insertPlayerTeam.run(baggioId, milanId);
    insertPlayerTeam.run(baggioId, interId);

    // Vieri: Juve, Inter, Milan
    insertPlayerTeam.run(vieriId, juveId);
    insertPlayerTeam.run(vieriId, interId);
    insertPlayerTeam.run(vieriId, milanId);

    // Seedorf: Inter, Milan
    insertPlayerTeam.run(seedorfId, interId);
    insertPlayerTeam.run(seedorfId, milanId);
  })();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/match", (req, res) => {
    // Get two random teams that share at least one player
    const query = `
      SELECT t1.id as team1_id, t1.name as team1_name, t1.logo_url as team1_logo,
             t2.id as team2_id, t2.name as team2_name, t2.logo_url as team2_logo
      FROM teams t1
      JOIN teams t2 ON t1.id < t2.id
      WHERE EXISTS (
        SELECT 1 FROM player_teams pt1
        JOIN player_teams pt2 ON pt1.player_id = pt2.player_id
        WHERE pt1.team_id = t1.id AND pt2.team_id = t2.id
      )
      ORDER BY RANDOM() LIMIT 1
    `;
    const match = db.prepare(query).get();
    res.json(match);
  });

  app.post("/api/validate", (req, res) => {
    const { team1_id, team2_id, player_name } = req.body;
    if (!team1_id || !team2_id || !player_name) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    // Fuzzy search simulation using LIKE
    const query = `
      SELECT p.name FROM players p
      JOIN player_teams pt1 ON p.id = pt1.player_id
      JOIN player_teams pt2 ON p.id = pt2.player_id
      WHERE pt1.team_id = ? AND pt2.team_id = ?
      AND p.name LIKE ?
    `;
    
    // Allow partial matches
    const searchTerm = `%${player_name}%`;
    const result = db.prepare(query).get(team1_id, team2_id, searchTerm);

    if (result) {
      res.json({ valid: true, player: result });
    } else {
      res.json({ valid: false });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
