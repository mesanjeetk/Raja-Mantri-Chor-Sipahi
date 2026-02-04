/**
 * GameManager - Manages game state and logic for Raja Mantri Chor Sipahi
 */
class GameManager {
    constructor(room, io = null) {
        this.room = room;
        this.io = io; // Socket.IO instance for timer events
        this.state = 'waiting'; // waiting, playing, finished
        this.currentRound = 0;
        this.maxRounds = 5;

        // Timer Configuration (in milliseconds)
        this.GAME_START_TIMER = 5000; // 5 seconds
        this.ROUND_TIMER = 30000; // 30 seconds
        this.NEXT_ROUND_TIMER = 5000; // 5 seconds

        // Timer IDs for cleanup
        this.gameStartTimerId = null;
        this.roundTimerId = null;
        this.roundIntervalId = null; // For countdown updates
        this.nextRoundTimerId = null;
        this.nextRoundIntervalId = null;

        // Timer state
        this.roundTimeRemaining = 0;
        this.nextRoundCountdown = 0;

        // Card distribution
        this.cards = ['Raja', 'Mantri', 'Chor', 'Sipahi'];
        this.currentCards = new Map(); // playerId -> card

        // Scoring
        this.scores = new Map(); // playerId -> total score
        this.roundHistory = []; // Array of round results

        // Special role tracking
        this.rajaPlayer = null;
        this.mantriPlayer = null;
        this.chorPlayer = null;
        this.sipahiPlayer = null;

        // Play again responses
        this.playAgainResponses = new Map(); // playerId -> boolean

        // Timestamps
        this.gameStartTime = null;
        this.gameEndTime = null;
        this.roundStartTime = null;

        // Initialize scores for all players
        this.initializeScores();
    }

    /**
     * Initialize scores for all players in the room
     */
    initializeScores() {
        this.room.players.forEach(player => {
            this.scores.set(player.id, 0);
        });
    }

    /**
     * Start the game
     */
    /**
     * Start the game with 5-second countdown
     */
    startGame() {
        // Validate preconditions
        if (this.state === 'playing') {
            throw new Error('Game is already in progress');
        }

        if (this.room.players.length !== 4) {
            throw new Error('Exactly 4 players are required to start the game');
        }

        console.log(`[GAME] Starting game countdown in room ${this.room.roomId}`);

        // Start 5-second countdown
        this.startGameStartCountdown();

        return {
            message: 'Game starting in 5 seconds...',
            countdown: 5
        };
    }

    /**
     * Execute game start countdown (called internally after validation)
     */
    startGameStartCountdown() {
        let countdown = 5;

        // Emit initial countdown
        this.emitToRoom('gameStartCountdown', { countdown });

        // Countdown interval
        const intervalId = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                this.emitToRoom('gameStartCountdown', { countdown });
            }
        }, 1000);

        // After 5 seconds, actually start the game
        this.gameStartTimerId = setTimeout(() => {
            clearInterval(intervalId);
            this.actuallyStartGame();
        }, this.GAME_START_TIMER);
    }

    /**
     * Actually start the game (after countdown completes)
     */
    actuallyStartGame() {
        // Initialize game state
        this.state = 'playing';
        this.currentRound = 1;
        this.gameStartTime = Date.now();
        this.gameEndTime = null;
        this.roundHistory = [];

        // Update room state
        this.room.state = 'playing';
        this.room.updateActivity();

        // Distribute cards for first round
        this.distributeCards();

        console.log(`[GAME] Game actually started in room ${this.room.roomId}`);

        // Emit game started event
        this.emitToRoom('gameActuallyStarted', {
            currentRound: this.currentRound,
            maxRounds: this.maxRounds,
            players: this.room.players.map(p => p.toPublicData()),
            mantriPlayer: this.mantriPlayer
        });

        // Send cards privately to each player
        this.sendCardsToPlayers();

        // Start round timer
        this.startRoundTimer();
    }

    /**
     * Distribute cards to all players using Fisher-Yates shuffle
     */
    distributeCards() {
        // Clear previous round data
        this.currentCards.clear();
        this.rajaPlayer = null;
        this.mantriPlayer = null;
        this.chorPlayer = null;
        this.sipahiPlayer = null;
        this.roundStartTime = Date.now();

        // Create a copy of cards array
        const availableCards = [...this.cards];
        const playerIds = this.room.players.map(p => p.id);

        // Fisher-Yates shuffle for fair distribution
        for (let i = availableCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
        }

        // Assign cards to players
        playerIds.forEach((playerId, index) => {
            const card = availableCards[index];
            this.currentCards.set(playerId, card);

            // Track special roles
            switch (card) {
                case 'Raja':
                    this.rajaPlayer = playerId;
                    break;
                case 'Mantri':
                    this.mantriPlayer = playerId;
                    break;
                case 'Chor':
                    this.chorPlayer = playerId;
                    break;
                case 'Sipahi':
                    this.sipahiPlayer = playerId;
                    break;
            }
        });

        this.room.updateActivity();

        console.log(`[GAME] Cards distributed for round ${this.currentRound} in room ${this.room.roomId}`);
    }

    /**
     * Start 30-second round timer
     */
    startRoundTimer() {
        this.roundTimeRemaining = this.ROUND_TIMER / 1000; // Convert to seconds

        // Emit initial timer state
        this.emitToRoom('roundTimerUpdate', {
            timeRemaining: this.roundTimeRemaining,
            round: this.currentRound
        });

        // Update every second
        this.roundIntervalId = setInterval(() => {
            this.roundTimeRemaining--;
            this.emitToRoom('roundTimerUpdate', {
                timeRemaining: this.roundTimeRemaining,
                round: this.currentRound
            });

            if (this.roundTimeRemaining <= 0) {
                clearInterval(this.roundIntervalId);
            }
        }, 1000);

        // Auto-penalty after 30 seconds
        this.roundTimerId = setTimeout(() => {
            this.handleRoundTimeout();
        }, this.ROUND_TIMER);
    }

    /**
     * Handle round timeout (Mantri didn't guess in time)
     */
    handleRoundTimeout() {
        console.log(`[GAME] Round ${this.currentRound} timed out in room ${this.room.roomId}`);

        // Clear timer
        this.clearRoundTimers();

        // Calculate scores with Mantri penalty (isCorrect = false)
        const roundScores = this.calculateRoundScores(false);

        // Update total scores
        roundScores.forEach((score, playerId) => {
            const currentScore = this.scores.get(playerId) || 0;
            this.scores.set(playerId, currentScore + score);
        });

        // Record round history
        const roundResult = {
            round: this.currentRound,
            mantriId: this.mantriPlayer,
            guessedPlayerId: null,
            actualChorId: this.chorPlayer,
            isCorrect: false,
            timedOut: true,
            scores: Object.fromEntries(roundScores),
            cards: Object.fromEntries(this.currentCards),
            timestamp: Date.now(),
            roundDuration: Date.now() - this.roundStartTime
        };
        this.roundHistory.push(roundResult);

        // Emit timeout event
        this.emitToRoom('roundTimeout', {
            message: 'Time expired! Mantri failed to guess.',
            roundScores: Object.fromEntries(roundScores),
            totalScores: Object.fromEntries(this.scores),
            cards: Object.fromEntries(this.currentCards),
            chorPlayer: this.room.getPlayer(this.chorPlayer).toPublicData()
        });

        // Schedule next round
        this.scheduleNextRound();
    }

    /**
     * Clear round timers
     */
    clearRoundTimers() {
        if (this.roundTimerId) {
            clearTimeout(this.roundTimerId);
            this.roundTimerId = null;
        }
        if (this.roundIntervalId) {
            clearInterval(this.roundIntervalId);
            this.roundIntervalId = null;
        }
    }

    /**
     * Make a guess (Mantri guesses who the Chor is)
     */
    makeGuess(mantriId, guessedPlayerId) {
        // Validate game state
        if (this.state !== 'playing') {
            throw new Error('Game is not in progress');
        }

        // Validate mantri
        if (mantriId !== this.mantriPlayer) {
            throw new Error('Only the Mantri can make guesses');
        }

        // Validate guessed player
        if (!this.room.hasPlayer(guessedPlayerId)) {
            throw new Error('Guessed player not found in room');
        }

        // Cannot guess yourself
        if (mantriId === guessedPlayerId) {
            throw new Error('Mantri cannot guess themselves');
        }

        // Clear round timer (guess was made in time)
        this.clearRoundTimers();

        // Check if guess is correct
        const isCorrect = guessedPlayerId === this.chorPlayer;
        const roundScores = this.calculateRoundScores(isCorrect);

        // Update total scores
        roundScores.forEach((score, playerId) => {
            const currentScore = this.scores.get(playerId) || 0;
            this.scores.set(playerId, currentScore + score);
        });

        // Record round history
        const roundResult = {
            round: this.currentRound,
            mantriId,
            guessedPlayerId,
            actualChorId: this.chorPlayer,
            isCorrect,
            timedOut: false,
            scores: Object.fromEntries(roundScores),
            cards: Object.fromEntries(this.currentCards),
            timestamp: Date.now(),
            roundDuration: Date.now() - this.roundStartTime
        };
        this.roundHistory.push(roundResult);

        this.room.updateActivity();

        console.log(`[GAME] Mantri made ${isCorrect ? 'correct' : 'incorrect'} guess in room ${this.room.roomId}`);

        // Schedule next round automatically
        this.scheduleNextRound();

        return {
            isCorrect,
            guessedPlayer: this.room.getPlayer(guessedPlayerId).toPublicData(),
            chorPlayer: this.room.getPlayer(this.chorPlayer).toPublicData(),
            roundScores: Object.fromEntries(roundScores),
            totalScores: Object.fromEntries(this.scores),
            cards: Object.fromEntries(this.currentCards)
        };
    }

    /**
     * Calculate scores for the current round
     */
    calculateRoundScores(isCorrect) {
        const roundScores = new Map();

        this.currentCards.forEach((card, playerId) => {
            let score = 0;

            switch (card) {
                case 'Raja':
                    score = 1000; // Raja always gets 1000 points
                    break;
                case 'Mantri':
                    score = isCorrect ? 800 : 0; // 800 if correct guess, 0 otherwise
                    break;
                case 'Chor':
                    score = isCorrect ? 0 : 800; // 0 if caught, 800 if not caught
                    break;
                case 'Sipahi':
                    score = 500; // Sipahi always gets 500 points
                    break;
            }

            roundScores.set(playerId, score);
        });

        return roundScores;
    }

    /**
     * Schedule next round with 5-second countdown (auto-start)
     */
    scheduleNextRound() {
        // Check if game should end
        if (this.currentRound >= this.maxRounds) {
            this.endGame();
            return;
        }

        console.log(`[GAME] Scheduling next round in room ${this.room.roomId}`);

        let countdown = 5;
        this.nextRoundCountdown = countdown;

        // Emit initial countdown
        this.emitToRoom('nextRoundCountdown', { countdown });

        // Countdown interval
        this.nextRoundIntervalId = setInterval(() => {
            countdown--;
            this.nextRoundCountdown = countdown;
            if (countdown > 0) {
                this.emitToRoom('nextRoundCountdown', { countdown });
            }
        }, 1000);

        // After 5 seconds, start next round
        this.nextRoundTimerId = setTimeout(() => {
            clearInterval(this.nextRoundIntervalId);
            this.actuallyStartNextRound();
        }, this.NEXT_ROUND_TIMER);
    }

    /**
     * Actually start next round (after countdown)
     */
    actuallyStartNextRound() {
        // Increment round
        this.currentRound++;

        // Distribute new cards
        this.distributeCards();

        this.room.updateActivity();

        console.log(`[GAME] Actually starting round ${this.currentRound} in room ${this.room.roomId}`);

        // Emit round started
        this.emitToRoom('nextRoundActuallyStarted', {
            currentRound: this.currentRound,
            maxRounds: this.maxRounds,
            mantriPlayer: this.mantriPlayer
        });

        // Send cards privately to each player
        this.sendCardsToPlayers();

        // Start round timer
        this.startRoundTimer();
    }

    /**
     * Manual next round (for backwards compatibility, but not used with auto-progression)
     */
    nextRound() {
        // Check if game should end
        if (this.currentRound >= this.maxRounds) {
            return this.endGame();
        }

        // Clear any pending timers
        if (this.nextRoundTimerId) {
            clearTimeout(this.nextRoundTimerId);
        }
        if (this.nextRoundIntervalId) {
            clearInterval(this.nextRoundIntervalId);
        }

        // Start next round immediately
        this.actuallyStartNextRound();

        return {
            message: 'Next round started',
            currentRound: this.currentRound,
            maxRounds: this.maxRounds,
            isGameFinished: false
        };
    }

    /**
     * End the game
     */
    endGame() {
        // Clear all timers
        this.clearAllTimers();

        this.state = 'finished';
        this.gameEndTime = Date.now();
        this.room.state = 'finished';
        this.room.updateActivity();

        console.log(`[GAME] Game ended in room ${this.room.roomId}`);

        const results = this.getResults();

        // Emit game finished
        this.emitToRoom('gameFinished', {
            message: 'Game finished',
            results
        });

        return {
            message: 'Game finished',
            results,
            isGameFinished: true
        };
    }

    /**
     * Force end the game (e.g., when a player leaves)
     */
    forceEndGame() {
        console.log(`[GAME] Game force-ended in room ${this.room.roomId}`);
        this.clearAllTimers();
        return this.endGame();
    }

    /**
     * Send cards privately to each player via Socket.IO
     */
    sendCardsToPlayers() {
        if (!this.io) {
            console.warn('[GAME] Cannot send cards: io instance not available');
            return;
        }

        this.room.players.forEach(player => {
            // Find player's socket
            const sockets = this.io.sockets.sockets;
            const roomSockets = this.io.sockets.adapter.rooms.get(this.room.roomId);

            if (!roomSockets) return;

            for (const socketId of roomSockets) {
                const socket = sockets.get(socketId);
                if (socket && socket.user && socket.user.id === player.id) {
                    socket.emit('yourCard', {
                        card: this.getPlayerCard(player.id),
                        round: this.currentRound
                    });
                    break;
                }
            }
        });
    }

    /**
     * Clear all active timers
     */
    clearAllTimers() {
        if (this.gameStartTimerId) {
            clearTimeout(this.gameStartTimerId);
            this.gameStartTimerId = null;
        }
        this.clearRoundTimers();
        if (this.nextRoundTimerId) {
            clearTimeout(this.nextRoundTimerId);
            this.nextRoundTimerId = null;
        }
        if (this.nextRoundIntervalId) {
            clearInterval(this.nextRoundIntervalId);
            this.nextRoundIntervalId = null;
        }
    }

    /**
     * Emit event to all players in the room
     */
    emitToRoom(event, data) {
        if (this.io) {
            this.io.to(this.room.roomId).emit(event, data);
        }
    }

    /**
     * Get game results and rankings
     */
    getResults() {
        // Sort players by score (descending)
        const rankings = this.room.players
            .map(player => ({
                ...player.toPublicData(),
                score: this.scores.get(player.id) || 0
            }))
            .sort((a, b) => b.score - a.score);

        // Calculate game statistics
        const gameDuration = this.gameEndTime
            ? this.gameEndTime - this.gameStartTime
            : Date.now() - this.gameStartTime;

        const totalScore = rankings.reduce((sum, p) => sum + p.score, 0);
        const averageScorePerRound = Math.round(
            totalScore / (rankings.length * this.currentRound)
        );

        return {
            rankings,
            winner: rankings[0],
            gameStats: {
                totalRounds: this.currentRound,
                maxRounds: this.maxRounds,
                gameDuration,
                gameDurationFormatted: this.formatDuration(gameDuration),
                averageScorePerRound,
                totalScore
            },
            roundHistory: this.roundHistory
        };
    }

    /**
     * Handle play again response from player
     */
    handlePlayAgainResponse(playerId, accepted) {
        if (!this.room.hasPlayer(playerId)) {
            throw new Error('Player not found in room');
        }

        this.playAgainResponses.set(playerId, accepted);
        this.room.updateActivity();

        return {
            playerId,
            accepted,
            totalResponses: this.playAgainResponses.size,
            totalPlayers: this.room.players.length,
            allAccepted: this.allPlayersAccepted()
        };
    }

    /**
     * Check if all players accepted play again
     */
    allPlayersAccepted() {
        if (this.playAgainResponses.size !== this.room.players.length) {
            return false;
        }

        return this.room.players.every(player =>
            this.playAgainResponses.get(player.id) === true
        );
    }

    /**
     * Reset game for a rematch
     */
    resetGame() {
        this.state = 'waiting';
        this.currentRound = 0;
        this.gameStartTime = null;
        this.gameEndTime = null;
        this.roundStartTime = null;

        this.currentCards.clear();
        this.rajaPlayer = null;
        this.mantriPlayer = null;
        this.chorPlayer = null;
        this.sipahiPlayer = null;

        this.roundHistory = [];
        this.playAgainResponses.clear();

        // Reset scores
        this.scores.clear();
        this.initializeScores();

        // Update room state
        this.room.state = 'waiting';
        this.room.updateActivity();

        // Update player stats
        this.room.players.forEach(player => {
            player.gamesPlayed++;
        });

        console.log(`[GAME] Game reset in room ${this.room.roomId}`);

        return {
            message: 'Game reset successfully',
            players: this.room.players.map(p => p.toPublicData())
        };
    }

    /**
     * Get player's card (only for that specific player)
     */
    getPlayerCard(playerId) {
        if (!this.room.hasPlayer(playerId)) {
            throw new Error('Player not found in room');
        }

        return this.currentCards.get(playerId) || null;
    }

    /**
     * Get public game state (safe to broadcast)
     */
    getPublicState() {
        return {
            roomId: this.room.roomId,
            state: this.state,
            currentRound: this.currentRound,
            maxRounds: this.maxRounds,
            players: this.room.players.map(p => p.toPublicData()),
            scores: Object.fromEntries(this.scores),
            mantriPlayer: this.mantriPlayer,
            hasPassword: this.room.password !== null,
            playerCount: this.room.players.length,
            gameStartTime: this.gameStartTime
        };
    }

    /**
     * Get complete game state (for admin/debug purposes)
     */
    getCompleteState() {
        return {
            ...this.getPublicState(),
            currentCards: Object.fromEntries(this.currentCards),
            rajaPlayer: this.rajaPlayer,
            chorPlayer: this.chorPlayer,
            sipahiPlayer: this.sipahiPlayer,
            roundHistory: this.roundHistory,
            playAgainResponses: Object.fromEntries(this.playAgainResponses)
        };
    }

    /**
     * Format duration in human-readable format
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${remainingSeconds}s`;
    }

    /**
     * Validate game state integrity
     */
    validateState() {
        const errors = [];

        // Check if all players have cards when game is playing
        if (this.state === 'playing') {
            if (this.currentCards.size !== this.room.players.length) {
                errors.push('Card count mismatch');
            }

            if (!this.rajaPlayer || !this.mantriPlayer || !this.chorPlayer || !this.sipahiPlayer) {
                errors.push('Missing special role assignment');
            }
        }

        // Check if all players have scores
        if (this.scores.size !== this.room.players.length) {
            errors.push('Score count mismatch');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

export default GameManager;
