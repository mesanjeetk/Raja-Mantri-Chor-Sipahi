import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useSocket } from "../provider/SocketProvider"
import { useAuth } from "../context/AuthContext"
import { Button } from "../components/Button"
import { Card } from "../components/Card"
import GameCard from "../components/GameCard"
import Timer from "../components/Timer"

interface Player {
    id: string;
    name: string;
    isCreator: boolean;
}

interface GameState {
    state: string;
    currentRound: number;
    maxRounds: number;
    players: Player[];
    scores: Record<string, number>;
    mantriPlayer: string | null;
}

const GameRoom = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { user } = useAuth();

    const [room, setRoom] = useState<any>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [myCard, setMyCard] = useState<string | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [revealedCards, setRevealedCards] = useState<Record<string, string>>({});

    // Timer states
    const [gameStartCountdown, setGameStartCountdown] = useState<number | null>(null);
    const [roundTimeRemaining, setRoundTimeRemaining] = useState<number | null>(null);
    const [nextRoundCountdown, setNextRoundCountdown] = useState<number | null>(null);

    // Fetch initial room state
    useEffect(() => {
        if (socket) {
            socket.emit('getRoomState', (response: any) => {
                if (response.success) {
                    setRoom(response.room);
                    setGameState(response.gameState);
                } else {
                    // Not in a room, go back to lobby
                    navigate('/');
                }
            });
        }
    }, [socket, navigate]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        // Player joined
        socket.on('playerJoined', ({ room: updatedRoom }) => {
            setRoom(updatedRoom);
        });

        // Player left
        socket.on('playerLeft', ({ room: updatedRoom }) => {
            setRoom(updatedRoom);
            if (updatedRoom.players.length < 4 && gameState?.state === 'playing') {
                // Game force ended
                setGameState(prev => prev ? { ...prev, state: 'finished' } : null);
            }
        });

        // Game start countdown (5 seconds)
        socket.on('gameStartCountdown', ({ countdown }) => {
            setGameStartCountdown(countdown);
        });

        // Game actually started (after countdown)
        socket.on('gameActuallyStarted', ({ currentRound, mantriPlayer }) => {
            setGameState(prev => prev ? { ...prev, currentRound, mantriPlayer } : null);
            setGameStartCountdown(null);
            setShowResults(false);
            setRevealedCards({});
        });

        // Round timer update
        socket.on('roundTimerUpdate', ({ timeRemaining }) => {
            setRoundTimeRemaining(timeRemaining);
        });

        // Round timeout (Mantri failed to guess)
        socket.on('roundTimeout', ({ totalScores, cards }) => {
            setRevealedCards(cards);
            setGameState(prev => prev ? { ...prev, scores: totalScores } : null);
            setRoundTimeRemaining(null);
        });

        // Your card (private)
        socket.on('yourCard', ({ card }) => {
            setMyCard(card);
        });

        // Guess result
        socket.on('guessResult', ({ totalScores, cards }) => {
            setRevealedCards(cards);
            setGameState(prev => prev ? { ...prev, scores: totalScores } : null);
            setRoundTimeRemaining(null);
        });

        // Next round countdown (5 seconds)
        socket.on('nextRoundCountdown', ({ countdown }) => {
            setNextRoundCountdown(countdown);
        });

        // Next round actually started (after countdown)
        socket.on('nextRoundActuallyStarted', ({ currentRound, mantriPlayer }) => {
            setGameState(prev => prev ? { ...prev, currentRound, mantriPlayer } : null);
            setMyCard(null);
            setSelectedPlayer(null);
            setRevealedCards({});
            setNextRoundCountdown(null);
        });



        // Game finished
        socket.on('gameFinished', ({ results: gameResults }) => {
            setResults(gameResults.results);
            setShowResults(true);
            setGameState(prev => prev ? { ...prev, state: 'finished' } : null);
        });

        // Game force ended
        socket.on('gameForceEnded', ({ reason, results: gameResults }) => {
            setResults(gameResults);
            setShowResults(true);
            setGameState(prev => prev ? { ...prev, state: 'finished' } : null);
            alert(`Game ended: ${reason}`);
        });

        // Game reset
        socket.on('gameReset', ({ players }) => {
            setRoom((prev: any) => ({ ...prev, players }));
            setGameState(prev => prev ? { ...prev, state: 'waiting', currentRound: 0, scores: {} } : null);
            setShowResults(false);
            setResults(null);
            setMyCard(null);
            setRevealedCards({});
        });

        return () => {
            socket.off('playerJoined');
            socket.off('playerLeft');
            socket.off('gameStartCountdown');
            socket.off('gameActuallyStarted');
            socket.off('roundTimerUpdate');
            socket.off('roundTimeout');
            socket.off('yourCard');
            socket.off('guessResult');
            socket.off('nextRoundCountdown');
            socket.off('nextRoundActuallyStarted');
            socket.off('gameFinished');
            socket.off('gameForceEnded');
            socket.off('gameReset');
        };
    }, [socket, gameState?.state]);

    const handleStartGame = useCallback(() => {
        if (!socket) return;
        socket.emit('startGame', (response: any) => {
            if (!response.success) {
                alert(response.error);
            }
        });
    }, [socket]);

    const handleMakeGuess = useCallback(() => {
        if (!socket || !selectedPlayer) return;
        socket.emit('makeGuess', { guessedPlayerId: selectedPlayer }, (response: any) => {
            if (!response.success) {
                alert(response.error);
            }
        });
    }, [socket, selectedPlayer]);

    const handleNextRound = useCallback(() => {
        if (!socket) return;
        socket.emit('nextRound', (response: any) => {
            if (!response.success) {
                alert(response.error);
            }
        });
    }, [socket]);

    const handlePlayAgain = useCallback((accepted: boolean) => {
        if (!socket) return;
        socket.emit('playAgainResponse', { accepted }, (response: any) => {
            if (!response.success) {
                alert(response.error);
            }
        });
    }, [socket]);

    const handleLeaveRoom = useCallback(() => {
        if (!socket) return;
        socket.emit('leaveRoom', (response: any) => {
            if (response.success) {
                navigate('/');
            }
        });
    }, [socket, navigate]);

    const isCreator = room?.players.find((p: Player) => p.id === user?.id)?.isCreator;
    const canStartGame = isCreator && room?.players.length === 4 && gameState?.state !== 'playing';
    const isMantri = user?.id === gameState?.mantriPlayer;
    const hasGuessed = Object.keys(revealedCards).length > 0;

    if (!room || !gameState) {
        return (
            <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
                <div className="text-white">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#141b3d] to-[#0a0e27]">
            {/* Timer Overlays */}
            {gameStartCountdown !== null && (
                <Timer
                    timeRemaining={gameStartCountdown}
                    totalTime={5}
                    type="gameStart"
                />
            )}

            {nextRoundCountdown !== null && (
                <Timer
                    timeRemaining={nextRoundCountdown}
                    totalTime={5}
                    type="nextRound"
                />
            )}

            {/* Header */}
            <header className="border-b border-white/10 backdrop-blur-sm bg-white/5 p-4">
                <div className="container mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Room {room.roomId}</h1>
                        <p className="text-gray-400">
                            Round {gameState.currentRound}/{gameState.maxRounds}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Round Timer */}
                        {roundTimeRemaining !== null && gameState.state === 'playing' && (
                            <Timer
                                timeRemaining={roundTimeRemaining}
                                totalTime={30}
                                type="round"
                            />
                        )}

                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${gameState.state === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                            gameState.state === 'playing' ? 'bg-green-500/20 text-green-400' :
                                'bg-gray-500/20 text-gray-400'
                            }`}>
                            {gameState.state}
                        </div>

                        <Button variant="danger" size="sm" onClick={handleLeaveRoom}>
                            Leave Room
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Game Area */}
            <main className="container mx-auto p-8">
                {/* Players Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {room.players.map((player: Player) => (
                        <Card
                            key={player.id}
                            className={`${selectedPlayer === player.id ? 'ring-2 ring-indigo-500' : ''
                                } ${isMantri && gameState.state === 'playing' && !hasGuessed && player.id !== user?.id
                                    ? 'cursor-pointer hover:ring-2 hover:ring-purple-500'
                                    : ''
                                }`}
                            onClick={() => {
                                if (isMantri && gameState.state === 'playing' && !hasGuessed && player.id !== user?.id) {
                                    setSelectedPlayer(player.id);
                                }
                            }}
                        >
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-white">{player.name}</h3>
                                    {player.isCreator && (
                                        <span className="text-yellow-400 text-xs">👑 Creator</span>
                                    )}
                                </div>

                                <div className="text-3xl font-bold text-indigo-400">
                                    {gameState.scores[player.id] || 0}
                                </div>

                                {player.id === gameState.mantriPlayer && gameState.state === 'playing' && (
                                    <div className="text-sm text-blue-400">🎓 Mantri</div>
                                )}

                                {/* Show own card to self */}
                                {player.id === user?.id && myCard && (
                                    <div className="mt-2">
                                        <GameCard card={myCard as any} isRevealed={true} />
                                    </div>
                                )}

                                {/* Show Mantri card to EVERYONE (as per game rules) */}
                                {player.id === gameState.mantriPlayer && gameState.state === 'playing' && player.id !== user?.id && myCard && (
                                    <div className="mt-2">
                                        <GameCard card={'Mantri' as any} isRevealed={true} />
                                    </div>
                                )}

                                {/* Show revealed cards after guess/timeout */}
                                {revealedCards[player.id] && player.id !== user?.id && player.id !== gameState.mantriPlayer && (
                                    <div className="mt-2">
                                        <GameCard card={revealedCards[player.id] as any} isRevealed={true} />
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Game Controls */}
                <div className="space-y-4">
                    {gameState.state === 'waiting' && (
                        <Card className="text-center p-8">
                            <h2 className="text-2xl font-bold text-white mb-4">Ready to Start?</h2>
                            <p className="text-gray-400 mb-6">All players are in the room!</p>
                            <Button variant="primary" size="lg" onClick={handleStartGame}>
                                Start Game
                            </Button>
                        </Card>
                    )}

                    {gameState.state === 'waiting' && !canStartGame && (
                        <Card className="text-center p-8">
                            <p className="text-gray-400">
                                Waiting for {4 - room.players.length} more player(s)...
                            </p>
                        </Card>
                    )}

                    {gameState.state === 'playing' && isMantri && !hasGuessed && (
                        <Card className="text-center p-8">
                            <h2 className="text-2xl font-bold text-white mb-4">You are the Mantri!</h2>
                            <p className="text-gray-400 mb-6">Select a player you think is the Chor</p>
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleMakeGuess}
                                disabled={!selectedPlayer}
                            >
                                Make Guess
                            </Button>
                        </Card>
                    )}

                    {gameState.state === 'playing' && !isMantri && !hasGuessed && (
                        <Card className="text-center p-8">
                            <p className="text-gray-400">Waiting for Mantri to make a guess...</p>
                        </Card>
                    )}

                    {hasGuessed && gameState.state === 'playing' && isCreator && (
                        <Card className="text-center p-8">
                            <h2 className="text-2xl font-bold text-white mb-6">Round Complete!</h2>
                            <Button variant="primary" size="lg" onClick={handleNextRound}>
                                Next Round
                            </Button>
                        </Card>
                    )}

                    {hasGuessed && gameState.state === 'playing' && !isCreator && (
                        <Card className="text-center p-8">
                            <p className="text-gray-400">Waiting for creator to start next round...</p>
                        </Card>
                    )}

                    {showResults && results && (
                        <Card className="p-8">
                            <h2 className="text-3xl font-bold text-white text-center mb-8">
                                🎉 Game Results 🎉
                            </h2>

                            <div className="space-y-4 mb-8">
                                {results.rankings.map((player: any, index: number) => (
                                    <div
                                        key={player.id}
                                        className={`flex items-center justify-between p-4 rounded-lg ${index === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50' :
                                            'bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl font-bold text-white">#{index + 1}</span>
                                            <span className="text-xl text-white">{player.name}</span>
                                            {index === 0 && <span className="text-2xl">👑</span>}
                                        </div>
                                        <span className="text-2xl font-bold text-indigo-400">
                                            {player.score}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="text-center">
                                <p className="text-gray-400 mb-6">Play again?</p>
                                <div className="flex gap-4 justify-center">
                                    <Button variant="primary" onClick={() => handlePlayAgain(true)}>
                                        Yes
                                    </Button>
                                    <Button variant="secondary" onClick={() => handlePlayAgain(false)}>
                                        No
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    )
}

export default GameRoom