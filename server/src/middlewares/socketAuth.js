import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from socket handshake
 */
export const socketAuthMiddleware = (socket, next) => {
    try {
        // Get token from handshake auth or query
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, env.JWT_SECRET);

        // Attach user data to socket
        socket.user = decoded;

        next();
    } catch (error) {
        console.error("Socket authentication error:", error.message);
        return next(new Error("Authentication error: Invalid token"));
    }
};
