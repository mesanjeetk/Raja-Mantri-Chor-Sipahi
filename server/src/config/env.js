import "dotenv/config";

/**
 * Validates required environment variables at startup
 * Throws an error with clear messaging if any required variables are missing or invalid
 */
function validateEnv() {
    const required = [
        "ACCESS_TOKEN_SECRET",
        "ACCESS_TOKEN_EXPIRY",
        "REFRESH_TOKEN_SECRET",
        "REFRESH_TOKEN_EXPIRY"
    ];

    const missing = [];
    const invalid = [];

    for (const key of required) {
        const value = process.env[key];

        // Check if variable exists and is not empty
        if (!value || value.trim() === "") {
            missing.push(key);
        }
        // Validate expiry values are non-empty strings (could represent time durations)
        else if (key.includes("EXPIRY")) {
            // Check if it's a valid string that could represent a duration
            // Accept formats like: "7d", "24h", "1800000", etc.
            if (typeof value !== "string" || value.trim().length === 0) {
                invalid.push(`${key} (must be a non-empty string representing a time duration)`);
            }
        }
    }

    // Throw descriptive error if any validation failed
    if (missing.length > 0 || invalid.length > 0) {
        const errors = [];

        if (missing.length > 0) {
            errors.push(`Missing required environment variables: ${missing.join(", ")}`);
        }

        if (invalid.length > 0) {
            errors.push(`Invalid environment variables: ${invalid.join(", ")}`);
        }

        throw new Error(
            `Environment validation failed:\n${errors.join("\n")}\n\n` +
            `Please ensure your .env file contains all required values.`
        );
    }
}

// Run validation before exporting config
validateEnv();

export const env = {
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI,
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY,
    NODE_ENV: process.env.NODE_ENV || "development",
}