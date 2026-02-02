# Socket.IO Setup with Authentication

## Overview
Socket.IO is now configured with JWT-based authentication middleware. All socket connections must provide a valid JWT token to establish a connection.

## Client Connection Example

### JavaScript/TypeScript Client
```javascript
import { io } from "socket.io-client";

// Connect with token in auth object (recommended)
const socket = io("http://localhost:8080", {
    auth: {
        token: "your-jwt-token-here"
    }
});

// Or connect with token in query params
const socket = io("http://localhost:8080", {
    query: {
        token: "your-jwt-token-here"
    }
});

// Handle connection events
socket.on("connect", () => {
    console.log("Connected to server!");
});

socket.on("connect_error", (error) => {
    console.error("Connection error:", error.message);
});
```

### React Client Example
```javascript
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

function App() {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const newSocket = io("http://localhost:8080", {
            auth: {
                token: localStorage.getItem("token") // or get from your auth context
            }
        });

        setSocket(newSocket);

        return () => newSocket.close();
    }, []);

    // Use socket in your component
}
```

## Authentication Flow

1. **Client sends JWT token** during connection handshake
2. **Server validates token** using `socketAuthMiddleware`
3. **User data attached to socket** via `socket.user`
4. **Connection established** or rejected based on token validity

## JWT Token Structure

Your JWT token should contain user information:
```json
{
    "id": "user-id",
    "userId": "user-id",
    "username": "john_doe",
    "email": "john@example.com"
    // ... other user data
}
```

## Adding Custom Socket Events

In `index.js`, add your custom event handlers inside the connection handler:

```javascript
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.id}`);
    
    // Example: Join a game room
    socket.on("join-room", (roomId) => {
        socket.join(`room:${roomId}`);
        io.to(`room:${roomId}`).emit("user-joined", {
            userId: socket.user.id,
            username: socket.user.username
        });
    });

    // Example: Send message to room
    socket.on("send-message", (data) => {
        const { roomId, message } = data;
        io.to(`room:${roomId}`).emit("new-message", {
            userId: socket.user.id,
            username: socket.user.username,
            message,
            timestamp: Date.now()
        });
    });

    socket.on("disconnect", (reason) => {
        console.log(`User disconnected: ${socket.user.id}`);
    });
});
```

## Emitting Events from Routes

You can emit Socket.IO events from your Express routes:

```javascript
// In your route handler
app.post("/api/game/start", (req, res) => {
    const { roomId } = req.body;
    
    // Emit to all sockets in the room
    req.app.locals.io.to(`room:${roomId}`).emit("game-started", {
        roomId,
        startTime: Date.now()
    });
    
    res.json({ success: true });
});
```

## Security Considerations

1. **Update CORS origin** in production:
   ```javascript
   cors: {
       origin: "https://your-client-domain.com",
       methods: ["GET", "POST"],
       credentials: true
   }
   ```

2. **Use secure JWT secret** - Update `JWT_SECRET` in `.env` to a strong, random value

3. **Validate all incoming data** from socket events

4. **Rate limit socket events** if needed

## Testing Socket Connection

You can test the socket connection using any Socket.IO client or browser console:

```javascript
// In browser console
const socket = io("http://localhost:8080", {
    auth: { token: "your-jwt-token" }
});

socket.on("connect", () => console.log("Connected!"));
socket.on("connect_error", (err) => console.error(err.message));
```
