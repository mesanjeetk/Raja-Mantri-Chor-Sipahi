# Socket.IO Events Quick Reference

## Client → Server Events

### Room Management

#### `createRoom`
```javascript
socket.emit('createRoom', { password, maxPlayers }, (response) => {
  // response.success, response.room, response.message
});
```

#### `joinRoom`
```javascript
socket.emit('joinRoom', { roomId, password }, (response) => {
  // response.success, response.room, response.message
});
```

#### `leaveRoom`
```javascript
socket.emit('leaveRoom', (response) => {
  // response.success, response.message
});
```

#### `getRooms`
```javascript
socket.emit('getRooms', { filters: { state: 'waiting', notFull: true } }, (response) => {
  // response.success, response.rooms[]
});
```

#### `getRoomState`
```javascript
socket.emit('getRoomState', (response) => {
  // response.success, response.room, response.gameState
});
```

### Game Flow

#### `startGame`
```javascript
socket.emit('startGame', (response) => {
  // response.success, response.message, response.gameState
});
```

#### `makeGuess`
```javascript
socket.emit('makeGuess', { guessedPlayerId }, (response) => {
  // response.success, response.isCorrect, response.scores
});
```

#### `nextRound`
```javascript
socket.emit('nextRound', (response) => {
  // response.success, response.currentRound, response.isGameFinished
});
```

#### `playAgainResponse`
```javascript
socket.emit('playAgainResponse', { accepted: true }, (response) => {
  // response.success, response.allAccepted
});
```

#### `getResults`
```javascript
socket.emit('getResults', (response) => {
  // response.success, response.results
});
```

### Admin

#### `getServerStats`
```javascript
socket.emit('getServerStats', (response) => {
  // response.success, response.stats
});
```

---

## Server → Client Events (Broadcasts)

### Room Updates

#### `roomListUpdated`
```javascript
socket.on('roomListUpdated', ({ rooms }) => {
  // Update UI with available rooms
});
```

#### `playerJoined`
```javascript
socket.on('playerJoined', ({ player, room }) => {
  // New player joined your room
});
```

#### `playerLeft`
```javascript
socket.on('playerLeft', ({ playerId, room, wasCreator }) => {
  // Player left your room
});
```

#### `roomDeleted`
```javascript
socket.on('roomDeleted', ({ roomId }) => {
  // Room was deleted
});
```

### Game Updates

#### `gameStarted`
```javascript
socket.on('gameStarted', ({ message, gameState }) => {
  // Game has started
});
```

#### `yourCard` (Private)
```javascript
socket.on('yourCard', ({ card, round }) => {
  // Your assigned card for this round
  // Values: 'Raja', 'Mantri', 'Chor', 'Sipahi'
});
```

#### `guessResult`
```javascript
socket.on('guessResult', ({ isCorrect, guessedPlayer, chorPlayer, roundScores, totalScores, cards }) => {
  // Mantri made a guess
});
```

#### `nextRoundStarted`
```javascript
socket.on('nextRoundStarted', ({ currentRound, gameState }) => {
  // New round started
});
```

#### `gameFinished`
```javascript
socket.on('gameFinished', ({ message, results }) => {
  // Game completed
});
```

#### `gameForceEnded`
```javascript
socket.on('gameForceEnded', ({ reason, results }) => {
  // Game ended prematurely (e.g., player left)
});
```

#### `playAgainUpdate`
```javascript
socket.on('playAgainUpdate', ({ playerId, accepted, allAccepted }) => {
  // Player responded to play again
});
```

#### `gameReset`
```javascript
socket.on('gameReset', ({ message, players }) => {
  // Game reset for rematch
});
```

---

## Example Client Implementation

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Create and join a room
socket.emit('createRoom', { password: 'mypass', maxPlayers: 4 }, (response) => {
  if (response.success) {
    console.log('Room created:', response.room.roomId);
  } else {
    console.error('Error:', response.error);
  }
});

// Listen for game start
socket.on('gameStarted', ({ gameState }) => {
  console.log('Game started!', gameState);
});

// Listen for your card
socket.on('yourCard', ({ card, round }) => {
  console.log(`You are ${card} in round ${round}`);
});

// Make a guess (if you're Mantri)
socket.emit('makeGuess', { guessedPlayerId: 'player-id' }, (response) => {
  if (response.success) {
    console.log('Guess was', response.isCorrect ? 'correct!' : 'wrong');
  }
});

// Listen for guess results
socket.on('guessResult', ({ isCorrect, roundScores, totalScores, cards }) => {
  console.log('Round over!', { isCorrect, roundScores, totalScores });
  console.log('Cards were:', cards);
});
```

---

## Data Structures

### Room Object
```typescript
{
  roomId: string;
  hasPassword: boolean;
  creatorId: string;
  playerCount: number;
  maxPlayers: number;
  players: Player[];
  state: 'waiting' | 'ready' | 'playing' | 'finished';
  createdAt: number;
  lastActivity: number;
}
```

### Player Object
```typescript
{
  id: string;
  name: string;
  isCreator: boolean;
  joinedAt: number;
  gamesPlayed: number;
}
```

### Game State Object
```typescript
{
  roomId: string;
  state: 'waiting' | 'playing' | 'finished';
  currentRound: number;
  maxRounds: number;
  players: Player[];
  scores: { [playerId: string]: number };
  mantriPlayer: string;
  gameStartTime: number;
}
```

### Results Object
```typescript
{
  rankings: Array<Player & { score: number }>;
  winner: Player & { score: number };
  gameStats: {
    totalRounds: number;
    maxRounds: number;
    gameDuration: number;
    gameDurationFormatted: string;
    averageScorePerRound: number;
    totalScore: number;
  };
  roundHistory: RoundResult[];
}
```
