import bcrypt from "bcryptjs"; 
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import groupModel from "../models/groupModel.js";

class groupController {
  async createGroup(req, res) {
    try {
      const { name, description, password } = req.body;
      const token = req.cookies.jwt;
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user_id = decoded.userId;
      
      // Hash the group password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const user = await userModel.findById( user_id );
      
      const newGroup = await groupModel.create({
        name,
        description,
        admin: user_id,
        members: [user_id],
        password: hashedPassword, // Store hashed password
      });

      // Update user’s createdGroups and joinedGroups
      user.createdGroups.push(newGroup._id);
      user.joinedGroups.push(newGroup._id);
      await user.save();
      
      res.status(201).json(newGroup);
    } catch (err) {
      console.error("Error creating group:", err);
      res.status(500).json({ message: "Server error" });
    }
  }

  async saveCodeGroup(req, res) {
    try {
        const { language, code, groupId } = req.body;
        if (!language) {
          return res.status(400).json({ error: "Language is required" });
        }
          
          const group = await groupModel.findById(groupId);
          if (!group) {
            return res.status(404).json({ error: "Group not found" });
          }
          
          group.codes.set(language, code);
        await group.save();
          console.log(`Code saved successfully for ${language}`);
          res.status(200).json({ message: "Code saved successfully" });
        } catch (error) {
          console.log("Error in saveCodeGroup controller", error.message);
          res.json({ error: "Could not save the code" });
        }
  }

  async getCodeGroup(req, res) {
    try {
      const { language, groupId } = req.body;
      const group = await groupModel.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
    if (!language) {
      return res.status(400).json({ error: "Language is required" });
    }
      const code = group.codes?.get(language) || "";
    res.status(200).json({ code });
    } catch (error) {
      console.log("Error in getCode controller", error.message);
      res.json({ error: "Could not fetch the code" });
    }
  }

  async joinGroup(req, res) {
    try {
      const { name, password } = req.body;
      const token = req.cookies.jwt;
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user_id = decoded.userId;
 
    
      // Check if the group exists
      const group = await groupModel.findOne({ name });
      if (!group) {
        console.log(1);
        return res.status(404).json({ message: "Group not found" });
      } else {
        // Check if the group password is correct
        if (group.password) {
          const isMatch = await bcrypt.compare(password, group.password);
          if (!isMatch) {
            console.log(2);
            return res.status(400).json({ message: "Incorrect password" });
          }
        }
      }
      const user = await userModel.findById( user_id );
      const groupId = group._id;
      
      // Add user to group members
      if (!group.members.includes(user_id)) {
        group.members.push(user_id);
        await group.save();
        // Add group to user joined Groups
        user.joinedGroups.push(groupId);
        await user.save();
      
      } 

      res.status(201).json({ message: "Joined group successfully" });
    } catch (err) {
      console.error("Error joining group:", err);
      res.status(500).json({ message: "Server error" });
    }
  }   
  
  // In your controller file

async getGroupInfo(req, res) {
  try {
    const { groupId } = req.body;
    
    const group = await groupModel
      .findById(groupId)
      .populate("members", "_id username "); 

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    
    res.status(200).json(group);
  } catch (err) {
    console.error("Error getting group info:", err);
    res.status(500).json({ message: "Server error" });
  }
}
async kickUser(req,res){
  try {
    const { groupId, userId } = req.body;
    const group = await groupModel.findById(groupId);
    const user = await userModel.findById(userId); 
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    group.members.pull(userId);
    user.joinedGroups.pull(groupId);
    await group.save();
    res.status(200).json({ message: "User kicked successfully" });
  } catch (err) {
    console.error("Error kicking user:", err);
    res.status(500).json({ message: "Server error" });
  }
}
async leaveGroup(req, res) {
  try {
    const { groupId } = req.body;
    const token = req.cookies.jwt;
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user_id = decoded.userId;

    // Fetch both the group and the user at the same time
   
    const group = await groupModel.findById(groupId);
    const user = await userModel.findById(user_id); // NEW: Fetch the user

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!user) { // NEW: Add a check for the user
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user is the admin of the group
    if (group.admin.toString() === user_id) {
      const newAdmin = group.members.find((member) => member.toString() !== user_id);
     
      if (newAdmin) {
        group.admin = newAdmin;
      } else {
       
        // If the admin is the last member, delete the group
        await groupModel.findByIdAndDelete(groupId);
        // Also remove the group from the user's list before responding
        user.joinedGroups.pull(groupId); 
        await user.save();             
        return res.status(200).json({ message: "Group deleted successfully" });
      }
    }

    // Remove the user from the group's members array
    group.members.pull(user_id);
    user.joinedGroups.pull(groupId);

    await Promise.all([group.save(), user.save()]);

    res.status(200).json({ message: "User left group successfully" });
  } catch (err) {
    console.error("Error leaving group:", err);
    res.status(500).json({ message: "Server error" });
  }
}

}
export default new groupController();