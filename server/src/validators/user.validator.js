import Joi from "joi";

/**
 * Validation schema for user signup
 */
export const signUpSchema = Joi.object({
    username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required()
        .messages({
            'string.alphanum': 'Username must contain only alphanumeric characters',
            'string.min': 'Username must be at least 3 characters long',
            'string.max': 'Username must not exceed 30 characters',
            'any.required': 'Username is required'
        }),

    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .min(6)
        .required()
        .messages({
            'string.min': 'Password must be at least 6 characters long',
            'any.required': 'Password is required'
        }),
    bio: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Bio must not exceed 100 characters'
        })
});

/**
 * Validation schema for user login
 */
export const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        })
});

export const updateProfileSchema = Joi.object({
    bio: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Bio must not exceed 100 characters'
        })
});
