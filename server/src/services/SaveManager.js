import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAVES_DIR = path.join(__dirname, "../saves");

// Créer le répertoire s'il n'existe pas
if (!fs.existsSync(SAVES_DIR)) {
  fs.mkdirSync(SAVES_DIR, { recursive: true });
}

export class SaveManager {
  static saveGame(room, game) {
    const filename = path.join(SAVES_DIR, `room_${room.code}.json`);

    const saveData = {
      room: room.toJSON(),
      game: game ? game.toJSON() : null,
      savedAt: Date.now(),
    };

    try {
      fs.writeFileSync(filename, JSON.stringify(saveData, null, 2));
      console.log(`Partie sauvegardée: ${filename}`);
      return true;
    } catch (error) {
      console.error(`Erreur sauvegarde: ${error}`);
      return false;
    }
  }

  static loadGame(code) {
    const filename = path.join(SAVES_DIR, `room_${code}.json`);

    try {
      if (!fs.existsSync(filename)) {
        return null;
      }

      const data = fs.readFileSync(filename, "utf-8");
      const saveData = JSON.parse(data);

      return saveData;
    } catch (error) {
      console.error(`Erreur chargement: ${error}`);
      return null;
    }
  }

  static deleteGame(code) {
    const filename = path.join(SAVES_DIR, `room_${code}.json`);

    try {
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
        console.log(`Partie supprimée: ${filename}`);
        return true;
      }
    } catch (error) {
      console.error(`Erreur suppression: ${error}`);
      return false;
    }

    return false;
  }

  static cleanupOldSaves() {
    const maxAge = 24 * 60 * 60 * 1000; // 24 heures
    const now = Date.now();

    try {
      const files = fs.readdirSync(SAVES_DIR);

      files.forEach((file) => {
        if (file.startsWith("room_") && file.endsWith(".json")) {
          const filePath = path.join(SAVES_DIR, file);
          const stats = fs.statSync(filePath);

          if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`Sauvegarde ancienne supprimée: ${file}`);
          }
        }
      });
    } catch (error) {
      console.error(`Erreur nettoyage: ${error}`);
    }
  }
}

// Nettoyage des anciennes sauvegardes toutes les heures
setInterval(() => {
  SaveManager.cleanupOldSaves();
}, 60 * 60 * 1000);
