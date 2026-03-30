# 🎮 Jeu Algorithmique Multijoueur en Réseau

Un jeu éducatif multijoueur temps réel pour tester vos compétences en algorithmique et programmation. Développé selon le rapport de conception "Jeu Algorithmique Multijoueur en Réseau" de Billal MECHEKOUR et Anas ATERTOR.

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 16+ (LTS recommandé)
- npm ou yarn
- Python 3 (pour validation des questions CODE en Python)
- Java/C/C++ compilateurs (optionnels, pour les questions correspondantes)

### Installation et Lancement

```bash
cd /Users/mac/Desktop/algo-game\ 2

# Option 1: Lancer les deux serveurs en parallèle
./start.sh

# Option 2: Lancer manuellement
# Terminal 1 - Serveur Node.js
cd server
npm start

# Terminal 2 - Client React
cd client
npm run dev
```

Le jeu sera accessible à:
- **Serveur WebSocket**: ws://localhost:8080
- **Client Web**: http://localhost:5173

## 📁 Structure du Projet

```
algo-game 2/
├── server/
│   ├── src/
│   │   ├── index.js              # Serveur WebSocket principal
│   │   ├── roomManager.js        # Gestion des salons
│   │   ├── models/               # Modèles de données (Room, Player, Game, etc.)
│   │   │   ├── Room.js
│   │   │   ├── Player.js
│   │   │   ├── Game.js
│   │   │   ├── Level.js
│   │   │   ├── Question.js
│   │   │   ├── Submission.js
│   │   │   ├── Score.js
│   │   │   └── GameConfig.js
│   │   ├── services/             # Services métier
│   │   │   ├── GameManager.js    # Orchestration des parties
│   │   │   ├── QuestionBank.js   # Sélection des questions
│   │   │   ├── CodeEvaluator.js  # Validation et exécution de code
│   │   │   ├── ScoreCalculator.js# Calcul des scores
│   │   │   ├── TimerManager.js   # Gestion des timers
│   │   │   └── SaveManager.js    # Persistance des parties
│   │   ├── questions/            # Banque de questions JSON
│   │   │   ├── python_simple.json
│   │   │   ├── python_medium.json
│   │   │   ├── java_simple.json
│   │   │   ├── java_medium.json
│   │   │   ├── c_simple.json
│   │   │   ├── c_medium.json
│   │   │   ├── cpp_simple.json
│   │   │   └── cpp_medium.json
│   │   └── saves/                # Sauvegardes de parties
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.jsx               # Composant principal
│   │   ├── main.jsx              # Point d'entrée
│   │   ├── ws.js                 # Client WebSocket
│   │   ├── context/              # Contextes React
│   │   │   ├── GameContext.jsx
│   │   │   └── UIContext.jsx
│   │   ├── hooks/                # Hooks personnalisés
│   │   ├── components/           # Composants réutilisables
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Timer.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── PlayerList.jsx
│   │   │   ├── FlashQuestion.jsx
│   │   │   ├── CodeEditor.jsx
│   │   │   └── QuestionNavigation.jsx
│   │   ├── screens/              # Écrans du jeu
│   │   │   ├── Home.jsx
│   │   │   ├── ConfigureGame.jsx
│   │   │   ├── JoinRoom.jsx
│   │   │   ├── Lobby.jsx
│   │   │   ├── Level.jsx
│   │   │   └── Scoreboard.jsx
│   │   ├── styles/
│   │   │   ├── theme.css
│   │   │   └── global.css
│   │   └── assets/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── start.sh
```

## 🎮 Fonctionnalités Implémentées

### Backend
- ✅ Gestion des salons avec code unique (6 caractères)
- ✅ Architecture client-serveur avec WebSocket
- ✅ Gestion d'état des joueurs et parties
- ✅ Génération automatique de niveaux avec progression de difficulté
- ✅ Sélection aléatoire de questions (Fisher-Yates shuffle)
- ✅ Deux types de questions:
  - **FLASH**: Questions à choix multiples (4 options)
  - **CODE**: Questions de programmation avec tests unitaires
- ✅ Validation syntaxique du code
- ✅ Calcul des scores avec:
  - Score de base selon justesse
  - Bonus de temps
  - Coefficients de difficulté
- ✅ Timer synchronisé en temps réel
- ✅ Persistance des parties en JSON
- ✅ Nettoyage automatique des salons inactifs

### Frontend
- ✅ Interface React moderne et réactive
- ✅ Gestion d'état avec Context API
- ✅ Écrans:
  - Accueil avec menu principal
  - Configuration et création de salon
  - Rejoindre un salon existant
  - Lobby avec liste des joueurs
  - Niveau avec questions et timer
  - Scoreboard avec résultats
- ✅ Composants réutilisables
- ✅ Design responsif avec Tailwind CSS

## 🎯 Flux de Jeu Principal

1. **Accueil**: Joueur choisit de créer ou rejoindre un salon
2. **Configuration** (Host uniquement):
   - Choisir langage (Python, Java, C, C++)
   - Choisir nombre de niveaux (3, 6, 9)
   - Choisir questions par niveau (1, 2, 3)
   - Choisir durée par niveau (30-300s)
3. **Lobby**: Attendre les autres joueurs, cliquer "Prêt"
4. **Jeu**: Pour chaque niveau:
   - Affichage des questions
   - Répondre et soumettre
   - Timer qui compte à rebours
   - Synchronisation en temps réel entre joueurs
5. **Résultats**: Scoreboard avec classement

## 💬 Messages WebSocket

### Client → Serveur
- `CREATE_ROOM`: Créer un nouveau salon
- `JOIN_ROOM`: Rejoindre un salon existant
- `SET_READY`: Indiquer que vous êtes prêt
- `UPDATE_CONFIG`: Modifier la configuration (Host)
- `START_GAME`: Démarrer la partie (Host)
- `SUBMIT_ANSWER`: Soumettre une réponse
- `KICK_PLAYER`: Expulser un joueur (Host)
- `SAVE_AND_QUIT`: Sauvegarder et quitter (Host)

### Serveur → Client
- `HELLO`: Premier message avec socketId
- `ROOM_CREATED`: Confirmation création salon
- `ROOM_UPDATE`: Mise à jour état du salon
- `GAME_STARTED`: Confirmation démarrage partie
- `LEVEL_START`: Début d'un niveau avec questions
- `TICK`: Mise à jour du timer (chaque seconde)
- `ANSWER_RECEIVED`: Confirmation réponse
- `LEVEL_END`: Fin d'un niveau avec scores
- `GAME_END`: Fin de la partie
- `ERROR`: Message d'erreur

## 🔐 Sécurité

- ✅ Validation de toutes les entrées
- ✅ Sanitization du code utilisateur
- ✅ Détection du code malveillant
- ✅ Rate limiting (max 10 messages/seconde)
- ✅ Timeout de 2 secondes pour compilation
- ✅ Pas d'exécution arbitraire de code

## 📊 Langages Supportés

- **Python** 3.x (validation avec py_compile)
- **Java** (compilation avec javac)
- **C** (compilation avec gcc)
- **C++** (compilation avec g++)

## 🧪 Banque de Questions

Chaque langage a 3 niveaux de difficulté:
- **SIMPLE** (5 questions)
- **MEDIUM** (5 questions)
- **HARD** (5 questions)

Total: 4 langages × 3 niveaux × 5 questions = 60 questions

Types de questions:
- **FLASH**: 75% des questions
- **CODE**: 25% des questions

## 📈 Scoring

La formule de score est:
```
Score = (Score_base + Bonus_temps) × Coefficient_difficulté

où:
- Score_base = 70 pts (FLASH correct) ou Nb_tests_réussis/Nb_tests_total × 70
- Bonus_temps = (1 - temps_écoulé/durée_totale) × 30
- Coefficient = 1.0 (SIMPLE), 1.2 (MEDIUM), 1.5 (HARD)
```

## 🛠️ Scripts Disponibles

```bash
# Serveur
cd server
npm start          # Démarrer le serveur en production
npm run dev        # Démarrer en mode développement (si ajouté)

# Client
cd client
npm run dev        # Démarrer en développement (Vite)
npm run build      # Build pour production
npm run preview    # Prévisualiser le build
npm run lint       # Lint avec ESLint
```

## 📝 Configuration Exemple

```javascript
// Configuration par défaut
{
  language: "python",           // python, java, c, cpp
  levelCount: 3,                // 3, 6, 9
  questionsPerLevel: 3,         // 1, 2, 3
  timePerLevelSec: 120          // 30-300 secondes
}
```

## 🐛 Dépannage

### Le serveur ne démarre pas
```bash
# Vérifier la version de Node.js
node --version  # Doit être 16+

# Réinstaller les dépendances
cd server
rm -rf node_modules package-lock.json
npm install
```

### Le client ne se connecte pas au serveur
- Vérifier que le serveur écoute sur le port 8080
- Vérifier qu'aucun autre processus utilise ce port
- Vérifier l'URL WebSocket dans `client/src/ws.js`

### Les questions ne chargent pas
- Vérifier que les fichiers JSON existent dans `server/src/questions/`
- Vérifier le format JSON (valider avec `jq` ou un outil en ligne)

## 📚 Références

- Architecture: Voir rapport de conception (rapport_partie_2_MECHEKOUR_ATERTOR.pdf)
- WebSocket: ws library (npm package)
- Frontend: React 19, Tailwind CSS
- Backend: Node.js, Express implicite via HTTP/WebSocket

## 👥 Auteurs

- Billal MECHEKOUR
- Anas ATERTOR

Année Universitaire: 2025/2026  
UNIVERSITÉ DE PICARDIE JULES VERNE

## 📄 Licence

Projet académique - Université de Picardie Jules Verne
