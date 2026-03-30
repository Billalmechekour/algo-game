#!/bin/bash

# Script pour démarrer le jeu complet

echo "🎮 Lancement du Jeu Algorithmique Multijoueur..."

# Démarrer le serveur
echo "📡 Démarrage du serveur Node.js..."
cd server
npm start &
SERVER_PID=$!

# Attendre que le serveur soit prêt
sleep 2

# Démarrer le client
echo "💻 Démarrage du client React..."
cd ../client
npm run dev &
CLIENT_PID=$!

echo ""
echo "✅ Serveur et client lancés!"
echo "   Serveur: http://localhost:8080"
echo "   Client: http://localhost:5173"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter les deux processus"

# Gérer l'arrêt propre
trap "kill $SERVER_PID $CLIENT_PID; exit" INT TERM

# Attendre l'arrêt
wait
