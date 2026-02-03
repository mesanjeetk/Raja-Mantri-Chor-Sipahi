import { ApiError } from "../lib/ApiError.js";
import { ApiResponse } from "../lib/ApiResponse.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { generateToken } from "../lib/tokens.js";
import { User } from "../models/user.model.js";


const signUp = asyncHandler(async (req, res) => {
    const { username, email, password, bio } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (existingUser) {
        throw new ApiError(409, "User with this email or username already exists");
    }

    const user = await User.create({
        username,
        email,
        password,
        bio: bio || ""
    });

    const { accessToken, refreshToken } = generateToken(user._id);

    const response = {
        user: {
            _id: user._id,
            username: user.username,
            email: user.email
        },
        accessToken,
        refreshToken
    }

    return res
        .cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })
        .cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 30 * 24 * 60 * 60 * 1000
        })
        .status(201)
        .json(new ApiResponse(201, response, "User registered successfully"));
})

const signIn = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Check if password is correct
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    // Generate JWT token
    const { accessToken, refreshToken } = generateToken(user._id);

    const response = {
        user: {
            _id: user._id,
            username: user.username,
            email: user.email
        },
        accessToken,
        refreshToken
    }

    return res
        .cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })
        .cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 30 * 24 * 60 * 60 * 1000
        })
        .status(200)
        .json(new ApiResponse(200, response, "User logged in successfully"));
})

const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).populate("friends", "username avatar").lean();

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const response = {
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            bio: user.bio,
            avatar: user.avatar,
            friends: user.friends,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }
    }
    return res.status(200).json(new ApiResponse(200, response, "User fetched successfully"));
})


export { signUp, signIn, getMe }