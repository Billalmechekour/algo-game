import { Player } from "./Player.js";
import { GameConfig } from "./GameConfig.js";

export class Room {
  constructor(code, hostSocketId, config) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.config = config;
    this.players = [];
    this.state = "WAITING"; // WAITING, IN_PROGRESS, PAUSED, FINISHED
    this.gameId = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  getPlayer(playerId) {
    return this.players.find((p) => p.socketId === playerId) || null;
  }

  getPlayerByToken(playerToken) {
    if (!playerToken) return null;
    return this.players.find((p) => p.playerToken === playerToken) || null;
  }

  isHost(playerId) {
    return this.hostSocketId === playerId;
  }

  isFull() {
    return this.players.length >= 4;
  }

  addPlayer(player) {
    if (this.state !== "WAITING" || this.isFull()) {
      return false;
    }
    this.players.push(player);
    this.lastActivity = Date.now();
    return true;
  }

  removePlayer(playerId) {
    this.players = this.players.filter((p) => p.socketId !== playerId);
    this.lastActivity = Date.now();

    // Transférer le rôle d'hôte si nécessaire.
    if (this.hostSocketId === playerId && this.players.length > 0) {
      this.hostSocketId = this.players[0].socketId;
    }
  }

  kickPlayer(targetId, byId) {
    if (!this.isHost(byId)) {
      return false;
    }
    if (targetId === this.hostSocketId) {
      return false;
    }
    if (!this.getPlayer(targetId)) {
      return false;
    }
    this.removePlayer(targetId);
    return true;
  }

  setReady(playerId, isReady) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.setReady(isReady);
      this.lastActivity = Date.now();
    }
  }

  allPlayersReady() {
    const connectedPlayers = this.players.filter((player) => player.isConnected !== false);
    const hostIsAlone =
      connectedPlayers.length === 1 &&
      connectedPlayers[0]?.socketId === this.hostSocketId;
    if (hostIsAlone) {
      return true;
    }
    return connectedPlayers.length >= 2 && connectedPlayers.every((player) => player.isReady);
  }

  canStartGame(byId) {
    return this.isHost(byId) && this.allPlayersReady();
  }

  startGame(byId, gameId) {
    if (!this.canStartGame(byId)) {
      return false;
    }
    this.state = "IN_PROGRESS";
    this.gameId = gameId;
    this.lastActivity = Date.now();
    return true;
  }

  endGame() {
    this.state = "FINISHED";
    this.lastActivity = Date.now();
  }

  toJSON() {
    return {
      code: this.code,
      hostSocketId: this.hostSocketId,
      config: this.config.toJSON(),
      players: this.players.map((p) => p.toJSON()),
      state: this.state,
      gameId: this.gameId,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
    };
  }

  static fromJSON(data) {
    const room = new Room(
      data.code,
      data.hostSocketId,
      GameConfig.fromJSON(data.config)
    );
    room.players = data.players.map((p) => Player.fromJSON(p));
    room.state = data.state;
    room.gameId = data.gameId;
    room.createdAt = data.createdAt;
    room.lastActivity = data.lastActivity;
    return room;
  }
}
