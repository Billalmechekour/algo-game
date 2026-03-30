export class Player {
  constructor(socketId, name, avatarId = null, playerToken = null) {
    this.socketId = socketId;
    this.name = name;
    this.avatarId = avatarId;
    this.playerToken = playerToken;
    this.isReady = false;
    this.isConnected = true;
  }

  setReady(isReady) {
    this.isReady = isReady;
  }

  setConnected(isConnected) {
    this.isConnected = isConnected;
  }

  toJSON() {
    return {
      socketId: this.socketId,
      name: this.name,
      avatarId: this.avatarId,
      ready: this.isReady,
      isConnected: this.isConnected,
    };
  }

  static fromJSON(data) {
    const player = new Player(
      data.socketId,
      data.name,
      data.avatarId || null,
      data.playerToken || null
    );
    player.isReady = data.isReady;
    player.isConnected = data.isConnected;
    return player;
  }
}
