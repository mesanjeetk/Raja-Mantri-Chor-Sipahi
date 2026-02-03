import { env } from "../config/env.js";
import { ApiError } from "../lib/ApiError.js";

/**
 * Comprehensive error handler middleware
 * Handles Mongoose errors, JWT errors, validation errors, and custom API errors
 */
export const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;

    // Log error for debugging
    console.error(`Error: ${err.message}`);
    if (env.NODE_ENV === "development") {
        console.error(err.stack);
    }

    // ============================================================================
    // MONGOOSE ERRORS
    // ============================================================================

    // Mongoose Duplicate Key Error (code: 11000)
    if (err.code === 11000) {
        // Safely check if keyValue exists and is non-empty
        if (err.keyValue && Object.keys(err.keyValue).length > 0) {
            const field = Object.keys(err.keyValue)[0];
            // Don't echo user-provided value - only use field name
            const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
            error = new ApiError(409, message);
        } else {
            // Fallback if keyValue is not available
            error = new ApiError(409, "Duplicate key error");
        }
    }

    // Mongoose CastError (Invalid ObjectId or type casting)
    if (err.name === "CastError") {
        const message = `Invalid ${err.path}: ${err.value}`;
        error = new ApiError(400, message);
    }

    // Mongoose Validation Error
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map(val => val.message);
        const message = messages.join(", ");
        error = new ApiError(400, message);
    }

    // ============================================================================
    // JWT ERRORS
    // ============================================================================

    // JWT Token Error (Invalid signature)
    if (err.name === "JsonWebTokenError") {
        const message = "Invalid token. Please log in again.";
        error = new ApiError(401, message);
    }

    // JWT Token Expired Error
    if (err.name === "TokenExpiredError") {
        const message = "Your token has expired. Please log in again.";
        error = new ApiError(401, message);
    }

    // JWT Not Before Error
    if (err.name === "NotBeforeError") {
        const message = "Token not active yet.";
        error = new ApiError(401, message);
    }

    // ============================================================================
    // MULTER ERRORS (File Upload)
    // ============================================================================

    // Multer file size error
    if (err.code === "LIMIT_FILE_SIZE") {
        const message = "File size is too large. Maximum file size is 5MB.";
        error = new ApiError(400, message);
    }

    // Multer unexpected field error
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
        const message = "Too many files uploaded or unexpected field.";
        error = new ApiError(400, message);
    }

    // Multer file count exceeded
    if (err.code === "LIMIT_FILE_COUNT") {
        const message = "Too many files uploaded.";
        error = new ApiError(400, message);
    }

    // Multer invalid file type
    if (err.code === "LIMIT_PART_COUNT") {
        const message = "Too many parts in multipart form data.";
        error = new ApiError(400, message);
    }

    // ============================================================================
    // SYNTAX ERRORS
    // ============================================================================

    // SyntaxError (Invalid JSON)
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        const message = "Invalid JSON payload";
        error = new ApiError(400, message);
    }

    // ============================================================================
    // CUSTOM API ERRORS
    // ============================================================================

    // Handle custom ApiError instances - check this first to avoid redundant processing
    else if (err instanceof ApiError) {
        error.statusCode = err.statusCode;
        error.message = err.message;
    }

    // ============================================================================
    // RESPONSE
    // ============================================================================

    // Send error response
    res.status(error.statusCode || 500).json({
        success: false,
        statusCode: error.statusCode || 500,
        message: error.message || "Internal Server Error",
        ...(env.NODE_ENV === "development" && {
            stack: err.stack,
            error: err
        })
    });
};

/**
 * 404 Not Found Handler
 * Should be placed after all routes
 */
export const notFoundHandler = (req, res, next) => {
    const error = new ApiError(404, `Route ${req.originalUrl} not found`);
    next(error);
};