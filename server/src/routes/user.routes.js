import express from "express";
import {
    signUp,
    signIn,
    getMe,
    signOut,
    updateProfile,
    sendFriendRequest,
    acceptOrRejectRequest,
    getPendingRequests,
    getFriends,
    removeFriend,
    blockUser,
    unblockUser,
    getBlockedUsers,
    getSuggestedFriends,
    getCommonFriends
} from "../controllers/user.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { signUpSchema, loginSchema, updateProfileSchema } from "../validators/user.validator.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/signup", validate(signUpSchema), signUp);
router.post("/signin", validate(loginSchema), signIn);


router.get("/me", verifyJWT, getMe);
router.post("/signout", verifyJWT, signOut);
router.put("/profile", verifyJWT, validate(updateProfileSchema), updateProfile);

router.post("/friend-request", verifyJWT, sendFriendRequest);
router.post("/friend-request/:requestId", verifyJWT, acceptOrRejectRequest);
router.get("/friend-requests", verifyJWT, getPendingRequests);
router.get("/friends", verifyJWT, getFriends);
router.delete("/friends/:friendId", verifyJWT, removeFriend);
router.post("/block", verifyJWT, blockUser);
router.post("/unblock", verifyJWT, unblockUser);
router.get("/blocked", verifyJWT, getBlockedUsers);
router.get("/suggested-friends", verifyJWT, getSuggestedFriends);
router.get("/common-friends/:userId", verifyJWT, getCommonFriends);

export default router;
