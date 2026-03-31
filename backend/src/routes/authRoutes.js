import express from "express";
import {
  sendOTP,
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controller/authController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";

const authRouter = express.Router();

authRouter.post("/send-otp", sendOTP);

authRouter.post("/register", register);

authRouter.post("/login", login);

authRouter.post("/logout", logout);

authRouter.post("/change-password", isAuthenticated, changePassword);

authRouter.post("/forgot-password", forgotPassword);

authRouter.post("/reset-password", resetPassword);

authRouter.get("/check", isAuthenticated, (req, res) => {

  const user = req.result;

  const reply = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    emailId: user.emailId,
    organisationName: user.organisationName, // Added for your B2B model
    role: user.role,
    isActive: user.isActive,
  };

  res.status(200).json({
    success: true,
    user: reply,
    message: "Authenticated session is valid.",
  });
});

export default authRouter;
