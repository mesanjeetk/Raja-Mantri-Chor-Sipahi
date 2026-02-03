import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const generateToken = (userId, username) => {

    const accessToken = jwt.sign(
        { id: userId, username },
        env.ACCESS_TOKEN_SECRET,
        { expiresIn: env.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { id: userId, username },
        env.REFRESH_TOKEN_SECRET,
        { expiresIn: env.REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
};