import { ApiError } from "../lib/ApiError.js";

/**
 * Middleware to validate request body against a Joi schema
 * @param {Joi.ObjectSchema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
export const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Return all errors, not just the first one
            stripUnknown: true // Remove unknown keys from the validated data
        });

        if (error) {
            const errorMessage = error.details
                .map(detail => detail.message)
                .join(', ');

            return next(new ApiError(400, errorMessage));
        }

        // Replace req.body with validated and sanitized data
        req.body = value;
        next();
    };
};
