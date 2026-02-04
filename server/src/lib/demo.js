// Functional game manager using efficient data structures
const gameManager = (() => {
    const rooms = new Map();
    const maxRooms = 100; // Increased capacity

    // Cleanup empty rooms every 5 minutes
    const roomCleanupInterval = setInterval(() => {
        cleanupEmptyRooms();
    }, 300000);

    const createRoom = (roomId, password, creatorId, creatorName) => {
        // Check room limit
        if (rooms.size >= maxRooms) {
            throw new Error('Server is at capacity. Please try again later.');
        }

        if (rooms.has(roomId)) {
            throw new Error('Room already exists');
        }

        const room = createGameRoom(roomId, password, creatorId, creatorName);
        rooms.set(roomId, room);

        console.log(`[ROOM] Created room ${roomId} (${rooms.size}/${maxRooms})`);
        return room;
    };

    const joinRoom = (roomId, playerId, playerName, password) => {
        const room = rooms.get(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        addPlayerToRoom(room, playerId, playerName, password);
        return room;
    };

    const getRoom = (roomId) => {
        const room = rooms.get(roomId);
        if (!room) {
            throw new Error('Room not found');
        }
        return room;
    };

    const removePlayer = (playerId) => {
        for (const [roomId, room] of rooms) {
            if (hasPlayer(room, playerId)) {
                const removedPlayer = room.players.find(p => p.id === playerId);
                const wasCreator = removedPlayer?.isCreator || false;
                const wasInGame = room.gameState === 'playing';

                removePlayerFromRoom(room, playerId);

                // Handle creator leaving
                if (wasCreator && room.players.length > 0) {
                    // Transfer ownership to the next player
                    const newCreator = room.players[0];
                    newCreator.isCreator = true;
                    room.creator = newCreator.id;
                    updateActivity(room);

                    // If game was in progress and creator left, force end the game
                    if (wasInGame && room.players.length < 4) {
                        room.gameState = 'finished';
                        room.gameEndTime = Date.now();
                        return {
                            room,
                            roomId,
                            creatorChanged: true,
                            newCreator: newCreator.name,
                            shouldDisband: false,
                            forceEndGame: true
                        };
                    }

                    return {
                        room,
                        roomId,
                        creatorChanged: true,
                        newCreator: newCreator.name,
                        shouldDisband: false,
                        forceEndGame: false
                    };
                }

                // Remove room if empty or creator left with <2 players
                if (room.players.length === 0 || (wasCreator && room.players.length < 2)) {
                    rooms.delete(roomId);
                    console.log(`[ROOM] Deleted room ${roomId} - ${room.players.length === 0 ? 'empty' : 'creator left with insufficient players'} (${rooms.size}/${maxRooms})`);
                    return {
                        room: null,
                        roomId,
                        creatorChanged: false,
                        shouldDisband: true,
                        forceEndGame: false
                    };
                }

                // If game was in progress and not enough players remain
                if (wasInGame && room.players.length < 4) {
                    room.gameState = 'finished';
                    room.gameEndTime = Date.now();
                    return {
                        room,
                        roomId,
                        creatorChanged: false,
                        shouldDisband: false,
                        forceEndGame: true
                    };
                }

                return {
                    room,
                    roomId,
                    creatorChanged: false,
                    shouldDisband: false,
                    forceEndGame: false
                };
            }
        }
        return null;
    };

    const cleanupEmptyRooms = () => {
        const now = Date.now();
        const emptyRooms = [];

        for (const [roomId, room] of rooms) {
            if (room.players.length === 0 && (now - room.lastActivity) > 600000) { // 10 minutes
                emptyRooms.push(roomId);
            }
        }

        emptyRooms.forEach(roomId => {
            rooms.delete(roomId);
            console.log(`[CLEANUP] Removed stale room ${roomId}`);
        });

        if (emptyRooms.length > 0) {
            console.log(`[CLEANUP] Removed ${emptyRooms.length} stale rooms (${rooms.size}/${maxRooms})`);
        }
    };

    const getStats = () => {
        const totalPlayers = Array.from(rooms.values())
            .reduce((sum, room) => sum + room.players.length, 0);

        const gameStates = Array.from(rooms.values())
            .reduce((acc, room) => {
                acc[room.gameState] = (acc[room.gameState] || 0) + 1;
                return acc;
            }, {});

        return {
            totalRooms: rooms.size,
            maxRooms,
            totalPlayers,
            gameStates,
            roomUtilization: Math.round((rooms.size / maxRooms) * 100)
        };
    };

    const destroy = () => {
        if (roomCleanupInterval) {
            clearInterval(roomCleanupInterval);
        }
        rooms.clear();
    };

    return {
        createRoom,
        joinRoom,
        getRoom,
        removePlayer,
        getStats,
        destroy,
        rooms // Expose for iteration
    };
})();

// Pure functions for room operations
const createGameRoom = (roomId, password, creatorId, creatorName) => {
    const room = {
        roomId,
        password,
        creator: creatorId,
        players: [],
        gameState: 'waiting',
        currentRound: 0,
        maxRounds: 5,
        cards: ['Raja', 'Mantri', 'Chor', 'Sipahi'],
        currentCards: {},
        scores: {},
        mantriPlayer: null,
        playAgainResponses: {},
        lastActivity: Date.now(),
        createdAt: Date.now(),
        gameStartTime: null,
        gameEndTime: null
    };

    addPlayerToRoom(room, creatorId, creatorName, password);
    return room;
};

const addPlayerToRoom = (room, playerId, playerName, password) => {
    if (room.password && room.password !== password) {
        throw new Error('Incorrect room password');
    }

    if (room.players.length >= 4) {
        throw new Error('Room is full');
    }

    if (hasPlayer(room, playerId)) {
        throw new Error('Player already in room');
    }

    // Validate player name
    if (!playerName || playerName.trim().length === 0) {
        throw new Error('Player name cannot be empty');
    }

    if (playerName.trim().length > 20) {
        throw new Error('Player name too long (max 20 characters)');
    }

    // Check for duplicate names
    if (room.players.some(p => p.name.toLowerCase() === playerName.trim().toLowerCase())) {
        throw new Error('Player name already taken in this room');
    }

    const player = {
        id: playerId,
        name: playerName.trim(),
        isCreator: playerId === room.creator,
        joinedAt: Date.now()
    };

    room.players.push(player);
    room.scores[playerId] = 0;
    updateActivity(room);
};

const removePlayerFromRoom = (room, playerId) => {
    room.players = room.players.filter(p => p.id !== playerId);
    delete room.scores[playerId];
    delete room.currentCards[playerId];
    delete room.playAgainResponses[playerId];
    updateActivity(room);
};

const hasPlayer = (room, playerId) => {
    return room.players.some(p => p.id === playerId);
};

const updateActivity = (room) => {
    room.lastActivity = Date.now();
};

const startGame = (room) => {
    if (room.players.length !== 4) {
        throw new Error('Need exactly 4 players to start');
    }

    room.gameState = 'playing';
    room.currentRound = 1;
    room.gameStartTime = Date.now();
    room.gameEndTime = null;
    distributeCards(room);
    updateActivity(room);
};

const distributeCards = (room) => {
    // Initialize roles
    const remainingCards = ['Raja', 'Mantri', 'Chor', 'Sipahi'];
    const unassignedPlayers = [...room.players];

    // Clear old state
    room.currentCards = {};
    room.mantriPlayer = null;
    room.rajaPlayer = null;
    room.chorPlayer = null;
    room.sipahiPlayer = null;

    // Randomly assign roles
    while (remainingCards.length && unassignedPlayers.length) {
        const randomCardIndex = Math.floor(Math.random() * remainingCards.length);
        const randomPlayerIndex = Math.floor(Math.random() * unassignedPlayers.length);

        const card = remainingCards.splice(randomCardIndex, 1)[0];
        const player = unassignedPlayers.splice(randomPlayerIndex, 1)[0];

        room.currentCards[player.id] = card;

        // Save special roles (if needed later)
        switch (card) {
            case 'Raja':
                room.rajaPlayer = player.id;
                break;
            case 'Mantri':
                room.mantriPlayer = player.id;
                break;
            case 'Chor':
                room.chorPlayer = player.id;
                break;
            case 'Sipahi':
                room.sipahiPlayer = player.id;
                break;
        }
    }

    updateActivity(room); // Notify players or refresh game state
};


const makeGuess = (room, mantriId, guessedPlayerId) => {
    if (mantriId !== room.mantriPlayer) {
        throw new Error('Only Mantri can make guesses');
    }

    const chorPlayer = room.players.find(p => room.currentCards[p.id] === 'Chor');
    const isCorrect = guessedPlayerId === chorPlayer.id;

    // Calculate scores efficiently
    const roundScores = {};
    room.players.forEach(player => {
        const card = room.currentCards[player.id];
        let score = 0;

        switch (card) {
            case 'Raja':
                score = 1000;
                break;
            case 'Mantri':
                score = isCorrect ? 800 : 0;
                break;
            case 'Chor':
                score = isCorrect ? 0 : 800;
                break;
            case 'Sipahi':
                score = 500;
                break;
        }

        roundScores[player.id] = score;
        room.scores[player.id] += score;
    });

    updateActivity(room);

    return {
        isCorrect,
        guessedPlayer: room.players.find(p => p.id === guessedPlayerId),
        chorPlayer,
        roundScores,
        totalScores: { ...room.scores },
        cards: { ...room.currentCards }
    };
};

const nextRound = (room) => {
    if (room.currentRound >= room.maxRounds) {
        // Game is already finished, don't continue
        room.gameState = 'finished';
        room.gameEndTime = Date.now();
        updateActivity(room);
        return true; // Game is finished
    }

    room.currentRound++;
    if (room.currentRound <= room.maxRounds) {
        distributeCards(room);
        updateActivity(room);
        return false; // Game continues
    } else {
        // This is the last round, finish the game
        room.gameState = 'finished';
        room.gameEndTime = Date.now();
        updateActivity(room);
        return true; // Game is finished
    }
};


const getResults = (room) => {
    const sortedPlayers = room.players
        .map(player => ({
            ...player,
            score: room.scores[player.id]
        }))
        .sort((a, b) => b.score - a.score);

    return {
        rankings: sortedPlayers,
        winner: sortedPlayers[0],
        gameStats: {
            totalRounds: room.currentRound,
            gameDuration: room.gameEndTime ? room.gameEndTime - room.gameStartTime : null,
            averageScorePerRound: Math.round(sortedPlayers.reduce((sum, p) => sum + p.score, 0) / (sortedPlayers.length * room.currentRound))
        }
    };
};

const forceEndGame = (room) => {
    room.gameState = 'finished';
    room.gameEndTime = Date.now();
    updateActivity(room);
    return getResults(room);
};

const handlePlayAgainResponse = (room, playerId, accepted) => {
    room.playAgainResponses[playerId] = accepted;
    updateActivity(room);
};

const allPlayersAccepted = (room) => {
    return room.players.every(player => room.playAgainResponses[player.id] === true);
};

const resetGame = (room) => {
    room.gameState = 'waiting';
    room.currentRound = 0;
    room.currentCards = {};
    room.mantriPlayer = null;
    room.playAgainResponses = {};
    room.gameStartTime = null;
    room.gameEndTime = null;
    room.rajaPlayer = null;
    room.chorPlayer = null;
    room.sipahiPlayer = null;

    // Reset scores
    room.players.forEach(player => {
        room.scores[player.id] = 0;
    });

    updateActivity(room);
};

const getPublicData = (room) => {
    return {
        roomId: room.roomId,
        players: room.players,
        gameState: room.gameState,
        currentRound: room.currentRound,
        maxRounds: room.maxRounds,
        hasPassword: !!room.password,
        playerCount: room.players.length
    };
};

const getGameData = (room) => {
    return {
        ...getPublicData(room),
        mantriPlayer: room.mantriPlayer,
        currentCards: room.currentCards,
        scores: room.scores
    };
};

export {
    gameManager,
    startGame,
    makeGuess,
    nextRound,
    getResults,
    forceEndGame,
    handlePlayAgainResponse,
    allPlayersAccepted,
    resetGame,
    getPublicData,
    getGameData
};