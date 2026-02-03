import { ApiError } from "../lib/ApiError.js";
import { ApiResponse } from "../lib/ApiResponse.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { generateToken } from "../lib/tokens.js";
import { User } from "../models/user.model.js";
import { env } from "../config/env.js";
import { Request } from "../models/request.model.js";
import mongoose from "mongoose";


const isValidObjectId = (id) =>
    mongoose.Types.ObjectId.isValid(id);

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

    // Build response object - only include tokens for non-browser clients
    const response = {
        user: {
            _id: user._id,
            username: user.username,
            email: user.email
        }
    };

    // Include tokens in JSON only if client explicitly requests it (e.g., mobile apps)
    const isNonBrowserClient = req.header("X-Client-Type") === "non-browser";
    if (isNonBrowserClient) {
        response.accessToken = accessToken;
        response.refreshToken = refreshToken;
    }

    return res
        .cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })
        .cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 30 * 24 * 60 * 60 * 1000
        })
        .status(201)
        .json(new ApiResponse(201, response, "User registered successfully"));
});

const signIn = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Attempt to find user
    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!await user.comparePassword(password)) {
        throw new ApiError(401, "Invalid password");
    }

    // Generate JWT token
    const { accessToken, refreshToken } = generateToken(user._id);

    // Build response object - only include tokens for non-browser clients
    const response = {
        user: {
            _id: user._id,
            username: user.username,
            email: user.email
        }
    };

    // Include tokens in JSON only if client explicitly requests it (e.g., mobile apps)
    const isNonBrowserClient = req.header("X-Client-Type") === "non-browser";
    if (isNonBrowserClient) {
        response.accessToken = accessToken;
        response.refreshToken = refreshToken;
    }

    return res
        .cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })
        .cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 30 * 24 * 60 * 60 * 1000
        })
        .status(200)
        .json(new ApiResponse(200, response, "User logged in successfully"));
});

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
});

const signOut = asyncHandler(async (req, res) => {
    return res
        .clearCookie("accessToken", {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })
        .clearCookie("refreshToken", {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 30 * 24 * 60 * 60 * 1000
        })
        .status(200)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const updateProfile = asyncHandler(async (req, res) => {
    const { bio } = req.body;

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { bio } },
        {
            new: true,
            runValidators: true,
        }
    );

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User updated successfully"));
});

const sendFriendRequest = asyncHandler(async (req, res) => {
    const senderId = req.user._id;
    const { receiverId } = req.body;

    if (!isValidObjectId(receiverId)) {
        throw new ApiError(400, "Invalid user id");
    }

    if (senderId.equals(receiverId)) {
        throw new ApiError(400, "You cannot send a friend request to yourself");
    }

    // Fetch both users in parallel
    const [sender, receiver] = await Promise.all([
        User.findById(senderId).select("blockedUsers friends"),
        User.findById(receiverId).select("blockedUsers friends")
    ]);

    if (!receiver) {
        throw new ApiError(404, "User not found");
    }

    // 🚫 Block checks
    if (
        receiver.blockedUsers.includes(senderId) ||
        sender.blockedUsers.includes(receiverId)
    ) {
        throw new ApiError(403, "Friend request not allowed");
    }

    // 🤝 Already friends?
    if (receiver.friends.includes(senderId)) {
        throw new ApiError(400, "You are already friends");
    }

    /**
     * 🧠 Smart logic:
     * If receiver already sent a request → auto accept
     */
    const reverseRequest = await Request.findOne({
        sender: receiverId,
        receiver: senderId,
        status: "pending"
    });

    if (reverseRequest) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            await Promise.all([
                reverseRequest.updateOne({ status: "accepted" }, { session }),
                User.updateOne(
                    { _id: senderId },
                    { $addToSet: { friends: receiverId } },
                    { session }
                ),
                User.updateOne(
                    { _id: receiverId },
                    { $addToSet: { friends: senderId } },
                    { session }
                )
            ]);

            await session.commitTransaction();

            return res.status(200).json(
                new ApiResponse(200, null, "Friend request accepted automatically")
            );

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // 🚀 Create request atomically
    const request = await Request.create({
        sender: senderId,
        receiver: receiverId
    });

    return res.status(201).json(
        new ApiResponse(201, request, "Friend request sent successfully")
    );
});

const acceptOrRejectRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { action } = req.body;
    const userId = req.user._id;

    if (!isValidObjectId(requestId)) {
        throw new ApiError(400, "Invalid request id");
    }

    if (!["accept", "reject"].includes(action)) {
        throw new ApiError(400, "Invalid action");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const request = await Request.findOne({
            _id: requestId,
            receiver: userId,
            status: "pending"
        }).session(session);

        if (!request) {
            throw new ApiError(404, "Friend request not found or already handled");
        }

        // 🚫 Reject flow
        if (action === "reject") {
            await request.deleteOne({ session });

            await session.commitTransaction();
            return res.status(200).json(
                new ApiResponse(200, null, "Friend request rejected")
            );
        }

        // 🤝 Accept flow
        await Promise.all([
            request.deleteOne({ session }),
            User.updateOne(
                { _id: request.sender },
                { $addToSet: { friends: request.receiver } },
                { session }
            ),
            User.updateOne(
                { _id: request.receiver },
                { $addToSet: { friends: request.sender } },
                { session }
            )
        ]);

        await session.commitTransaction();

        return res.status(200).json(
            new ApiResponse(200, null, "Friend request accepted")
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});

const getPendingRequests = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const requests = await Request.aggregate([
        {
            $match: {
                receiver: userId,
                status: "pending"
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $lookup: {
                from: "users",
                localField: "sender",
                foreignField: "_id",
                as: "sender"
            }
        },
        {
            $unwind: "$sender"
        },
        {
            $project: {
                _id: 1,
                createdAt: 1,
                "sender._id": 1,
                "sender.username": 1,
                "sender.avatar": 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, requests, "Pending requests fetched successfully")
    );
});

const getFriends = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const friends = await User.aggregate([
        {
            $match: { _id: userId }
        },
        {
            $lookup: {
                from: "users",
                localField: "friends",
                foreignField: "_id",
                as: "friends"
            }
        },
        {
            $unwind: "$friends"
        },
        {
            $project: {
                _id: 0,
                "friends._id": 1,
                "friends.username": 1,
                "friends.avatar": 1
            }
        },
        {
            $replaceRoot: { newRoot: "$friends" }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, friends, "Friends fetched successfully")
    );
});

const removeFriend = asyncHandler(async (req, res) => {
    const { friendId } = req.params;
    const userId = req.user._id;

    if (!isValidObjectId(friendId)) {
        throw new ApiError(400, "Invalid friend id");
    }

    if (userId.equals(friendId)) {
        throw new ApiError(400, "You cannot remove yourself");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const result = await Promise.all([
            User.updateOne(
                { _id: userId, friends: friendId },
                { $pull: { friends: friendId } },
                { session }
            ),
            User.updateOne(
                { _id: friendId, friends: userId },
                { $pull: { friends: userId } },
                { session }
            )
        ]);

        // 🧠 If nothing was modified, they weren't friends
        if (result[0].modifiedCount === 0) {
            throw new ApiError(400, "You are not friends");
        }

        await session.commitTransaction();

        return res.status(200).json(
            new ApiResponse(200, null, "Friend removed successfully")
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});

const blockUser = asyncHandler(async (req, res) => {
    const { userId: targetId } = req.body;
    const userId = req.user._id;

    if (!isValidObjectId(targetId)) {
        throw new ApiError(400, "Invalid user id");
    }

    if (userId.equals(targetId)) {
        throw new ApiError(400, "You cannot block yourself");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 🧱 Block + clean all relations atomically
        await Promise.all([
            // Add to blocked list
            User.updateOne(
                { _id: userId },
                { $addToSet: { blockedUsers: targetId } },
                { session }
            ),

            // Remove friendship from both sides
            User.updateOne(
                { _id: userId },
                { $pull: { friends: targetId } },
                { session }
            ),
            User.updateOne(
                { _id: targetId },
                { $pull: { friends: userId } },
                { session }
            ),

            // Remove any friend requests in either direction
            Request.deleteMany(
                {
                    $or: [
                        { sender: userId, receiver: targetId },
                        { sender: targetId, receiver: userId }
                    ]
                },
                { session }
            )
        ]);

        await session.commitTransaction();

        return res.status(200).json(
            new ApiResponse(200, null, "User blocked successfully")
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});

const unblockUser = asyncHandler(async (req, res) => {
    const { userId: targetId } = req.body;
    const userId = req.user._id;

    if (!isValidObjectId(targetId)) {
        throw new ApiError(400, "Invalid user id");
    }

    if (userId.equals(targetId)) {
        throw new ApiError(400, "You cannot unblock yourself");
    }

    const result = await User.updateOne(
        { _id: userId },
        { $pull: { blockedUsers: targetId } }
    );

    if (result.modifiedCount === 0) {
        throw new ApiError(400, "User is not blocked");
    }

    return res.status(200).json(
        new ApiResponse(200, null, "User unblocked successfully")
    );
});

const getBlockedUsers = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const blockedUsers = await User.aggregate([
        {
            $match: { _id: userId }
        },
        {
            $lookup: {
                from: "users",
                localField: "blockedUsers",
                foreignField: "_id",
                as: "blockedUsers"
            }
        },
        {
            $unwind: "$blockedUsers"
        },
        {
            $project: {
                _id: 0,
                "blockedUsers._id": 1,
                "blockedUsers.username": 1,
                "blockedUsers.avatar": 1
            }
        },
        {
            $replaceRoot: { newRoot: "$blockedUsers" }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, blockedUsers, "Blocked users fetched successfully")
    );
});

const getSuggestedFriends = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const [result] = await User.aggregate([
        // 1️⃣ Load current user's graph
        {
            $match: { _id: userId }
        },
        {
            $project: {
                friends: 1,
                blockedUsers: 1
            }
        },

        // 2️⃣ Lookup potential users
        {
            $lookup: {
                from: "users",
                let: {
                    friends: "$friends",
                    blocked: "$blockedUsers"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $ne: ["$_id", userId] },
                                    { $not: { $in: ["$_id", "$$friends"] } },
                                    { $not: { $in: ["$_id", "$$blocked"] } }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            avatar: 1
                        }
                    },
                    { $skip: skip },
                    { $limit: limit }
                ],
                as: "suggestedFriends"
            }
        },

        // 3️⃣ Count total suggestions
        {
            $lookup: {
                from: "users",
                let: {
                    friends: "$friends",
                    blocked: "$blockedUsers"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $ne: ["$_id", userId] },
                                    { $not: { $in: ["$_id", "$$friends"] } },
                                    { $not: { $in: ["$_id", "$$blocked"] } }
                                ]
                            }
                        }
                    },
                    { $count: "total" }
                ],
                as: "count"
            }
        },
        {
            $project: {
                suggestedFriends: 1,
                total: { $ifNull: [{ $arrayElemAt: ["$count.total", 0] }, 0] }
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                data: result.suggestedFriends,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limit)
                }
            },
            "Suggested friends fetched successfully"
        )
    );
});

const getCommonFriends = asyncHandler(async (req, res) => {
    const { userId: targetId } = req.params;
    const userId = req.user._id;

    if (!isValidObjectId(targetId)) {
        throw new ApiError(400, "Invalid user id");
    }
    const targetUser = await User.findById(targetId).lean();
    if (!targetUser) {
        throw new ApiError(404, "User not found");
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const [result] = await User.aggregate([
        {
            $match: {
                _id: { $in: [userId, new mongoose.Types.ObjectId(targetId)] }
            }
        },
        {
            $group: {
                _id: null,
                friendsLists: { $push: "$friends" }
            }
        },
        {
            $project: {
                commonFriends: {
                    $setIntersection: [
                        { $arrayElemAt: ["$friendsLists", 0] },
                        { $arrayElemAt: ["$friendsLists", 1] }
                    ]
                }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "commonFriends",
                foreignField: "_id",
                as: "commonFriends"
            }
        },
        {
            $unwind: "$commonFriends"
        },
        {
            $project: {
                _id: 0,
                "commonFriends._id": 1,
                "commonFriends.username": 1,
                "commonFriends.avatar": 1
            }
        },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit }
                ],
                totalCount: [
                    { $count: "total" }
                ]
            }
        },
        {
            $project: {
                data: 1,
                total: {
                    $ifNull: [{ $arrayElemAt: ["$totalCount.total", 0] }, 0]
                }
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                data: result.data,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limit)
                }
            },
            "Common friends fetched successfully"
        )
    );
});

export { signUp, signIn, getMe, signOut, updateProfile, sendFriendRequest, acceptOrRejectRequest, getPendingRequests, getFriends, removeFriend, blockUser, unblockUser, getBlockedUsers, getSuggestedFriends, getCommonFriends }