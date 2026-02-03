import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "./middlewares/socketAuth.js";
import userRoutes from "./routes/user.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.handler.middleware.js";
import { RoomManager } from "./lib/roomManager.js";
import GameManager from "./lib/gameManager.js";

const app = express();
const httpServer = createServer(app);

// Initialize RoomManager singleton
const roomManager = RoomManager.getInstance();

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        credentials: true
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: "*",
    credentials: true
}));
app.use(helmet());

// API Routes
app.use("/api/users", userRoutes);

// Apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// Socket.IO connection handler
io.on("connection", (socket) => {
    const userId = socket.user.id;
    const userName = socket.user?.name || socket.user?.username || 'Unknown';

    console.log(`[SOCKET] User connected: ${userName} (${userId})`);

    // ==================== ROOM MANAGEMENT ====================

    /**
     * Create a new room
     */
    socket.on("createRoom", ({ password, maxPlayers = 4 }, callback) => {
        try {
            const room = roomManager.createRoom({
                creatorId: userId,
                creatorName: userName,
                password,
                maxPlayers
            });

            // Attach GameManager to room with io instance for timer events
            room.game = new GameManager(room, io);

            // Join socket room
            socket.join(room.roomId);

            console.log(`[SOCKET] ${userName} created room ${room.roomId}`);

            callback({
                success: true,
                room: room.toPublicData(),
                message: 'Room created successfully'
            });

            // Broadcast room list update
            io.emit("roomListUpdated", {
                rooms: roomManager.getAllRooms({ notFull: true })
            });

        } catch (error) {
            console.error(`[SOCKET] Error creating room:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Join an existing room
     */
    socket.on("joinRoom", ({ roomId, password }, callback) => {
        try {
            const room = roomManager.joinRoom(roomId, userId, userName, password);

            // Join socket room
            socket.join(roomId);

            console.log(`[SOCKET] ${userName} joined room ${roomId}`);

            // Notify existing players
            socket.to(roomId).emit("playerJoined", {
                player: room.getPlayer(userId).toPublicData(),
                room: room.toPublicData()
            });

            callback({
                success: true,
                room: room.toPublicData(),
                message: 'Joined room successfully'
            });

            // Broadcast room list update
            io.emit("roomListUpdated", {
                rooms: roomManager.getAllRooms({ notFull: true })
            });

        } catch (error) {
            console.error(`[SOCKET] Error joining room:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Leave current room
     */
    socket.on("leaveRoom", (callback) => {
        try {
            const result = roomManager.leaveRoom(userId);
            const { room, roomDeleted, wasCreator } = result;

            if (roomDeleted) {
                // Notify all clients that room was deleted
                io.emit("roomDeleted", { roomId: room?.roomId });
                socket.leave(room?.roomId);
            } else {
                const roomId = room.roomId;

                // Notify remaining players
                socket.to(roomId).emit("playerLeft", {
                    playerId: userId,
                    room: room.toPublicData(),
                    wasCreator
                });

                socket.leave(roomId);

                // If game was in progress and not enough players, end it
                if (room.game && room.players.length < 4 && room.game.state === 'playing') {
                    const results = room.game.forceEndGame();
                    io.to(roomId).emit("gameForceEnded", {
                        reason: 'Not enough players',
                        results
                    });
                }
            }

            callback({
                success: true,
                message: 'Left room successfully'
            });

            // Broadcast room list update
            io.emit("roomListUpdated", {
                rooms: roomManager.getAllRooms({ notFull: true })
            });

        } catch (error) {
            console.error(`[SOCKET] Error leaving room:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Get available rooms
     */
    socket.on("getRooms", ({ filters = {} }, callback) => {
        try {
            const rooms = roomManager.getAllRooms(filters);
            callback({
                success: true,
                rooms
            });
        } catch (error) {
            console.error(`[SOCKET] Error getting rooms:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Get current room state
     */
    socket.on("getRoomState", (callback) => {
        try {
            const room = roomManager.getRoomByPlayerId(userId);
            if (!room) {
                throw new Error('You are not in any room');
            }

            callback({
                success: true,
                room: room.toPublicData(),
                gameState: room.game ? room.game.getPublicState() : null
            });
        } catch (error) {
            console.error(`[SOCKET] Error getting room state:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    // ==================== GAME LOGIC ====================

    /**
     * Start game
     */
    socket.on("startGame", (callback) => {
        try {
            const room = roomManager.getRoomByPlayerId(userId);
            if (!room) {
                throw new Error('You are not in any room');
            }

            if (!room.isCreator(userId)) {
                throw new Error('Only the room creator can start the game');
            }

            const result = room.game.startGame();

            // Callback to confirm command received
            callback({
                success: true,
                ...result
            });

            // Note: GameManager now handles:
            // 1. gameStartCountdown events (5, 4, 3, 2, 1)
            // 2. gameActuallyStarted event (after countdown)
            // 3. yourCard events (sent privately to each player)
            // 4. roundTimerUpdate events (30-second countdown)

        } catch (error) {
            console.error(`[SOCKET] Error starting game:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Make a guess (Mantri only)
     */
    socket.on("makeGuess", ({ guessedPlayerId }, callback) => {
        try {
            const room = roomManager.getRoomByPlayerId(userId);
            if (!room) {
                throw new Error('You are not in any room');
            }

            const result = room.game.makeGuess(userId, guessedPlayerId);

            // Notify all players of the result
            io.to(room.roomId).emit("guessResult", result);

            callback({
                success: true,
                ...result
            });

        } catch (error) {
            console.error(`[SOCKET] Error making guess:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Proceed to next round
     */
    socket.on("nextRound", (callback) => {
        try {
            const room = roomManager.getRoomByPlayerId(userId);
            if (!room) {
                throw new Error('You are not in any room');
            }

            if (!room.isCreator(userId)) {
                throw new Error('Only the room creator can start the next round');
            }

            const result = room.game.nextRound();

            if (result.isGameFinished) {
                // Game finished
                io.to(room.roomId).emit("gameFinished", result);
            } else {
                // Next round started
                io.to(room.roomId).emit("nextRoundStarted", {
                    ...result,
                    gameState: room.game.getPublicState()
                });

                // Send each player their new card privately
                room.players.forEach(player => {
                    const playerSocket = io.sockets.sockets.get(
                        Array.from(io.sockets.adapter.rooms.get(room.roomId) || [])
                            .find(sid => {
                                const s = io.sockets.sockets.get(sid);
                                return s?.userId === player.id;
                            })
                    );

                    if (playerSocket) {
                        playerSocket.emit("yourCard", {
                            card: room.game.getPlayerCard(player.id),
                            round: room.game.currentRound
                        });
                    }
                });
            }

            callback({
                success: true,
                ...result
            });

        } catch (error) {
            console.error(`[SOCKET] Error proceeding to next round:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Handle play again response
     */
    socket.on("playAgainResponse", ({ accepted }, callback) => {
        try {
            const room = roomManager.getRoomByPlayerId(userId);
            if (!room) {
                throw new Error('You are not in any room');
            }

            const result = room.game.handlePlayAgainResponse(userId, accepted);

            // Notify all players
            io.to(room.roomId).emit("playAgainUpdate", result);

            // If all players accepted, reset the game
            if (result.allAccepted) {
                const resetResult = room.game.resetGame();
                io.to(room.roomId).emit("gameReset", resetResult);
            }

            callback({
                success: true,
                ...result
            });

        } catch (error) {
            console.error(`[SOCKET] Error handling play again:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Get game results
     */
    socket.on("getResults", (callback) => {
        try {
            const room = roomManager.getRoomByPlayerId(userId);
            if (!room) {
                throw new Error('You are not in any room');
            }

            const results = room.game.getResults();

            callback({
                success: true,
                results
            });

        } catch (error) {
            console.error(`[SOCKET] Error getting results:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    // ==================== ADMIN/DEBUG ====================

    /**
     * Get server statistics
     */
    socket.on("getServerStats", (callback) => {
        try {
            const stats = roomManager.getStats();
            callback({
                success: true,
                stats
            });
        } catch (error) {
            console.error(`[SOCKET] Error getting stats:`, error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    // ==================== DISCONNECT ====================

    socket.on("disconnect", (reason) => {
        try {
            console.log(`[SOCKET] User disconnected: ${userName} (${userId}), Reason: ${reason}`);

            // Auto-leave room on disconnect
            const room = roomManager.getRoomByPlayerId(userId);
            if (room) {
                const roomId = room.roomId;
                const result = roomManager.leaveRoom(userId);

                if (result.roomDeleted) {
                    io.emit("roomDeleted", { roomId });
                } else {
                    io.to(roomId).emit("playerLeft", {
                        playerId: userId,
                        room: room.toPublicData(),
                        wasCreator: result.wasCreator
                    });

                    // If game was in progress, end it
                    if (room.game && room.players.length < 4 && room.game.state === 'playing') {
                        const results = room.game.forceEndGame();
                        io.to(roomId).emit("gameForceEnded", {
                            reason: 'Player disconnected',
                            results
                        });
                    }
                }

                // Broadcast room list update
                io.emit("roomListUpdated", {
                    rooms: roomManager.getAllRooms({ notFull: true })
                });
            }
        } catch (error) {
            console.error(`[SOCKET] Error on disconnect:`, error.message);
        }
    });
});

app.get("/", (req, res) => {
    res.send("Hello World!");
});

// Make io instance available to routes via app.locals
app.locals.io = io;

// 404 Handler - Must be after all routes
app.use(notFoundHandler);

// Global Error Handler - Must be last
app.use(errorHandler);

export { httpServer, io };