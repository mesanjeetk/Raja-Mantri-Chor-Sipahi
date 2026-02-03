import express from "express";
import { signUp, signIn, getMe } from "../controllers/user.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { signUpSchema, loginSchema } from "../validators/user.validator.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/signup", validate(signUpSchema), signUp);
router.post("/signin", validate(loginSchema), signIn);


router.get("/me", verifyJWT, getMe);

export default router;
