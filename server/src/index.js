import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "./middlewares/socketAuth.js";
import userRoutes from "./routes/user.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.handler.middleware.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());

// API Routes
app.use("/api/users", userRoutes);

// Apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// Socket.IO connection handler
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.id || socket.user.userId || 'unknown'}`);

    // Join user to their personal room
    socket.join(`user:${socket.user.id || socket.user.userId}`);

    // Handle disconnection
    socket.on("disconnect", (reason) => {
        console.log(`User disconnected: ${socket.user.id || socket.user.userId}, Reason: ${reason}`);
    });

    // Add your custom socket event handlers here
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
export default app;
