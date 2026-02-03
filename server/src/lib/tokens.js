import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const generateToken = (userId) => {

    const accessToken = jwt.sign(
        { id: userId },
        env.ACCESS_TOKEN_SECRET,
        { expiresIn: env.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { id: userId },
        env.REFRESH_TOKEN_SECRET,
        { expiresIn: env.REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
};