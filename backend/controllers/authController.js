import userModel from "../models/userModel.js";
import bcrypt from "bcryptjs";
import tokenService from "../services/tokenService.js";
import jwt from "jsonwebtoken";

class authController {

    async protectController(req, res) {
        try {
            const token = req.cookies.jwt
            if(!token)
            {
                return res.json({error: "Unauthorized - No token found"})
            }
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
            if(!decoded)
            {
                return res.json({error: "Unauthorized - Invalid token"})
            }
    
            const user = await userModel.findById(decoded.userId).select("-password")
            if(!user)
            {
                return res.json({error: "User not found"})
            }
    
            res.json({user})
        } catch (error) {
            console.log("Error in protect controller", error.message)
            res.json({error: "Internal server error"})
        }
    }
    
  async logoutHandler(req, res) {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/", // important: must match cookie path
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}


  async checkUserAndEmailHandler(req, res) {
    try {
      const { email, username } = req.body;
      const user = await userModel.findOne({ email });
      if (user) {
        return res.json({ check: "Email repeated" });
      }
      const user2 = await userModel.findOne({ username });
      if (user2) {
        return res.json({ check: "Username repeated" });
      }
      return res.json({ check: "ok" });
    } catch (error) {
      console.log("Error in checkUserAndEmail controller", error.message);
      res.json({ error: "Internal server error" });
    }
  }

  async signupHandler(req, res) {
    try {
      const { name, username, age, password, email } = req.body;

      // HASH PASSWORD

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = new userModel({
        fullName: name,
        username,
        age,
        email,
        password: hashedPassword,
        joinedGroups: [],
        createdGroups: [],
        code: "Welcome to DevSquad",
        language: "cpp"
      });


      if (newUser) {
        // Generate JWT token
        await newUser.save();
        tokenService.generateTokenAndSetCookie(newUser._id, res);
        res.json({
            _id: newUser._id,
            fullName: newUser.fullName,
            username: newUser.username,
        });
      } else {
        res.json({ error: "Invalid user data" });
      }
    } catch (error) {
      console.log("Error in signup controller", error.message);
      res.json({ error: "Internal server error" });
    }
  }

  async loginHandler(req, res) {
    try {
      const { email, password } = req.body;

      let user = await userModel.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Incorrect password" });
      }
      tokenService.generateTokenAndSetCookie(user._id, res);
      res.json({
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
      });
    } catch (error) {
      console.log("Error in login controller", error.message);
      res.json({ error: "Internal server error" });
    }
  }
}

export default new authController();
