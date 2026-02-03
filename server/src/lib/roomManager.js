import EventEmitter from 'events';
import crypto from 'crypto';

/**
 * Player class representing a game player
 */
class Player {
    constructor(id, name, isCreator = false) {
        this.id = id;
        this.name = this.sanitizeName(name);
        this.isCreator = isCreator;
        this.joinedAt = Date.now();
        this.gamesPlayed = 0;
        this.totalScore = 0;
    }

    sanitizeName(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid player name');
        }
        const sanitized = name.trim().substring(0, 20);
        if (sanitized.length === 0) {
            throw new Error('Player name cannot be empty');
        }
        // Remove potentially harmful characters
        return sanitized.replace(/[<>]/g, '');
    }

    toPublicData() {
        return {
            id: this.id,
            name: this.name,
            isCreator: this.isCreator,
            joinedAt: this.joinedAt,
            gamesPlayed: this.gamesPlayed
        };
    }
}

/**
 * Room class representing a game room
 */
class Room {
    constructor(roomId, password, creatorId, creatorName, options = {}) {
        this.roomId = roomId;
        this.password = password ? this.hashPassword(password) : null;
        this.creatorId = creatorId;
        this.players = [];
        this.maxPlayers = options.maxPlayers || 4;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.state = 'waiting'; // waiting, ready, playing, finished

        // Game-specific properties
        this.game = null; // Will be set when GameManager is attached

        // Add creator as first player
        this.addPlayer(new Player(creatorId, creatorName, true));
    }

    /**
     * Simple password hashing (for demo purposes, use bcrypt in production)
     */
    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    /**
     * Verify room password
     */
    verifyPassword(password) {
        if (!this.password) return true;
        return this.password === this.hashPassword(password);
    }

    /**
     * Add player to room with validation
     */
    addPlayer(player) {
        // Validate room capacity
        if (this.players.length >= this.maxPlayers) {
            throw new Error('Room is full');
        }

        // Check for duplicate player ID
        if (this.hasPlayer(player.id)) {
            throw new Error('Player already in room');
        }

        // Check for duplicate player name
        if (this.players.some(p => p.name.toLowerCase() === player.name.toLowerCase())) {
            throw new Error('Player name already taken in this room');
        }

        this.players.push(player);
        this.updateActivity();
    }

    /**
     * Remove player from room
     */
    removePlayer(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) {
            throw new Error('Player not found in room');
        }

        const removedPlayer = this.players[playerIndex];
        this.players.splice(playerIndex, 1);
        this.updateActivity();

        return removedPlayer;
    }

    /**
     * Check if player exists in room
     */
    hasPlayer(playerId) {
        return this.players.some(p => p.id === playerId);
    }

    /**
     * Get player by ID
     */
    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    /**
     * Check if player is creator
     */
    isCreator(playerId) {
        return this.creatorId === playerId;
    }

    /**
     * Transfer ownership to another player
     */
    transferOwnership(newCreatorId) {
        const newCreator = this.getPlayer(newCreatorId);
        if (!newCreator) {
            throw new Error('New creator not found in room');
        }

        // Update old creator
        const oldCreator = this.players.find(p => p.isCreator);
        if (oldCreator) {
            oldCreator.isCreator = false;
        }

        // Set new creator
        newCreator.isCreator = true;
        this.creatorId = newCreatorId;
        this.updateActivity();

        return newCreator;
    }

    /**
     * Update last activity timestamp
     */
    updateActivity() {
        this.lastActivity = Date.now();
    }

    /**
     * Check if room is empty
     */
    isEmpty() {
        return this.players.length === 0;
    }

    /**
     * Check if room is full
     */
    isFull() {
        return this.players.length >= this.maxPlayers;
    }

    /**
     * Check if room has enough players to start game
     */
    canStartGame() {
        return this.players.length === this.maxPlayers && this.state === 'waiting';
    }

    /**
     * Get room's public data (safe to share)
     */
    toPublicData() {
        return {
            roomId: this.roomId,
            hasPassword: !!this.password,
            creatorId: this.creatorId,
            playerCount: this.players.length,
            maxPlayers: this.maxPlayers,
            players: this.players.map(p => p.toPublicData()),
            state: this.state,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity
        };
    }
}

/**
 * RoomManager - Singleton class for managing all game rooms
 */
class RoomManager extends EventEmitter {
    static instance = null;

    constructor() {
        super();
        if (RoomManager.instance) {
            return RoomManager.instance;
        }
        this.rooms = new Map();
        this.playerToRoom = new Map(); // Quick lookup: playerId -> roomId
        this.maxRooms = 100;
        this.roomCreationLimit = new Map(); // Rate limiting: IP -> timestamp[]
        this.cleanupInterval = null;

        this.startCleanupScheduler();
        RoomManager.instance = this;
    }

    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!RoomManager.instance) {
            RoomManager.instance = new RoomManager();
        }
        return RoomManager.instance;
    }

    /**
     * Create a new room
     */
    createRoom(options) {
        const {
            roomId = this.generateRoomId(),
            password = null,
            creatorId,
            creatorName,
            maxPlayers = 4
        } = options;

        // Validate inputs
        if (!creatorId || !creatorName) {
            throw new Error('Creator ID and name are required');
        }

        // Check if creator is already in a room
        if (this.playerToRoom.has(creatorId)) {
            throw new Error('You are already in a room. Leave your current room first.');
        }

        // Check room capacity
        if (this.rooms.size >= this.maxRooms) {
            throw new Error('Server is at capacity. Please try again later.');
        }

        // Check if room ID already exists
        if (this.rooms.has(roomId)) {
            throw new Error('Room ID already exists');
        }

        // Create room
        const room = new Room(roomId, password, creatorId, creatorName, { maxPlayers });
        this.rooms.set(roomId, room);
        this.playerToRoom.set(creatorId, roomId);

        // const player = new Player(creatorId, creatorName, true);
        // room.addPlayer(player);
        console.log(`[ROOM] Created room ${roomId} by ${creatorName} (${this.rooms.size}/${this.maxRooms})`);

        this.emit('roomCreated', { room: room.toPublicData() });

        return room;
    }

    /**
     * Join an existing room
     */
    joinRoom(roomId, playerId, playerName, password = null) {
        // Validate inputs
        if (!roomId || !playerId || !playerName) {
            throw new Error('Room ID, player ID, and player name are required');
        }

        // Check if player is already in a room
        if (this.playerToRoom.has(playerId)) {
            const currentRoomId = this.playerToRoom.get(playerId);
            if (currentRoomId === roomId) {
                throw new Error('You are already in this room');
            }
            throw new Error('You are already in another room. Leave it first.');
        }

        // Get room
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        // Verify password
        if (!room.verifyPassword(password)) {
            throw new Error('Incorrect room password');
        }

        // Add player to room
        const player = new Player(playerId, playerName);
        room.addPlayer(player);
        this.playerToRoom.set(playerId, roomId);

        console.log(`[ROOM] Player ${playerName} joined room ${roomId}`);

        this.emit('playerJoined', {
            roomId,
            player: player.toPublicData(),
            room: room.toPublicData()
        });

        return room;
    }

    /**
     * Leave a room
     */
    leaveRoom(playerId) {
        const roomId = this.playerToRoom.get(playerId);
        if (!roomId) {
            throw new Error('You are not in any room');
        }

        const room = this.rooms.get(roomId);
        if (!room) {
            this.playerToRoom.delete(playerId);
            throw new Error('Room not found');
        }

        const wasCreator = room.isCreator(playerId);
        const removedPlayer = room.removePlayer(playerId);
        this.playerToRoom.delete(playerId);

        console.log(`[ROOM] Player ${removedPlayer.name} left room ${roomId}`);

        // Handle creator leaving
        if (wasCreator && !room.isEmpty()) {
            const newCreator = room.transferOwnership(room.players[0].id);
            this.emit('creatorChanged', {
                roomId,
                oldCreator: removedPlayer.toPublicData(),
                newCreator: newCreator.toPublicData(),
                room: room.toPublicData()
            });
        }

        // Delete room if empty
        if (room.isEmpty()) {
            this.rooms.delete(roomId);
            console.log(`[ROOM] Deleted empty room ${roomId} (${this.rooms.size}/${this.maxRooms})`);
            this.emit('roomDeleted', { roomId });
            return { room: null, roomDeleted: true, wasCreator };
        }

        this.emit('playerLeft', {
            roomId,
            player: removedPlayer.toPublicData(),
            room: room.toPublicData(),
            wasCreator
        });

        return { room, roomDeleted: false, wasCreator };
    }

    /**
     * Get room by ID
     */
    getRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('Room not found');
        }
        return room;
    }

    /**
     * Get room by player ID
     */
    getRoomByPlayerId(playerId) {
        const roomId = this.playerToRoom.get(playerId);
        if (!roomId) {
            return null;
        }
        return this.rooms.get(roomId);
    }

    /**
     * Get all rooms (with optional filters)
     */
    getAllRooms(filters = {}) {
        let rooms = Array.from(this.rooms.values());

        // Apply filters
        if (filters.state) {
            rooms = rooms.filter(r => r.state === filters.state);
        }
        if (filters.hasPassword !== undefined) {
            rooms = rooms.filter(r => (r.password !== null) === filters.hasPassword);
        }
        if (filters.notFull) {
            rooms = rooms.filter(r => !r.isFull());
        }

        return rooms.map(r => r.toPublicData());
    }

    /**
     * Generate unique room ID
     */
    generateRoomId() {
        let roomId;
        do {
            roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (this.rooms.has(roomId));
        return roomId;
    }

    /**
     * Get comprehensive statistics
     */
    getStats() {
        const rooms = Array.from(this.rooms.values());
        const totalPlayers = rooms.reduce((sum, room) => sum + room.players.length, 0);

        const stateDistribution = rooms.reduce((acc, room) => {
            acc[room.state] = (acc[room.state] || 0) + 1;
            return acc;
        }, {});

        return {
            totalRooms: this.rooms.size,
            maxRooms: this.maxRooms,
            totalPlayers,
            roomUtilization: Math.round((this.rooms.size / this.maxRooms) * 100),
            stateDistribution,
            averagePlayersPerRoom: totalPlayers / Math.max(this.rooms.size, 1)
        };
    }

    /**
     * Start automatic cleanup scheduler
     */
    startCleanupScheduler() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Run cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleRooms();
        }, 5 * 60 * 1000);

        console.log('[ROOM] Cleanup scheduler started');
    }

    /**
     * Cleanup stale/inactive rooms
     */
    cleanupStaleRooms() {
        const now = Date.now();
        const staleThreshold = 30 * 60 * 1000; // 30 minutes
        const emptyThreshold = 10 * 60 * 1000; // 10 minutes
        const staleRooms = [];

        for (const [roomId, room] of this.rooms) {
            const inactiveTime = now - room.lastActivity;

            // Remove empty rooms after 10 minutes
            if (room.isEmpty() && inactiveTime > emptyThreshold) {
                staleRooms.push(roomId);
                continue;
            }

            // Remove inactive rooms after 30 minutes
            if (inactiveTime > staleThreshold) {
                staleRooms.push(roomId);
            }
        }

        staleRooms.forEach(roomId => {
            const room = this.rooms.get(roomId);
            // Clean up player-to-room mapping
            room.players.forEach(player => {
                this.playerToRoom.delete(player.id);
            });
            this.rooms.delete(roomId);
            console.log(`[CLEANUP] Removed stale room ${roomId}`);
            this.emit('roomDeleted', { roomId, reason: 'stale' });
        });

        if (staleRooms.length > 0) {
            console.log(`[CLEANUP] Removed ${staleRooms.length} stale rooms (${this.rooms.size}/${this.maxRooms})`);
        }
    }

    /**
     * Force cleanup all rooms and stop scheduler
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        this.rooms.clear();
        this.playerToRoom.clear();
        this.roomCreationLimit.clear();

        console.log('[ROOM] RoomManager destroyed');
    }
}

export { RoomManager, Room, Player };