import jwt from "jsonwebtoken";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ApiError } from "../lib/ApiError.js";
import { User } from "../models/user.model.js";
import { env } from "../config/env.js";

const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization").replace("Bearer ", "");
        if (!token) {
            throw new ApiError(401, "Unauthorized");
        }
        const decodedToken = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken.id).select("-password");
        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, "Unauthorized");
    }
})

export { verifyJWT }