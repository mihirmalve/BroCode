import { Server } from "socket.io";
import http from "http";
import express from "express";
import cookie from "cookie";
import messageModel from "../models/messageModel.js";
import groupModel from "../models/groupModel.js";
import * as Y from "yjs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from "mongoose";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://68c2cb1e6867be2d54149275--aquamarine-bonbon-ba22bb.netlify.app/",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const userSocketMap = {}; // {userId: socketId}
const yDocs = {}; // Store Yjs documents for each group

const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

io.on("connection", (socket) => {
  const cookieHeader = socket.handshake.headers.cookie;

  if (!cookieHeader) {
    console.log("❌ No cookies, disconnecting socket:", socket.id);
    socket.disconnect();
    return;
  }

  const parsedCookies = cookie.parse(cookieHeader);
  const jwt = parsedCookies.jwt;

  if (!jwt) {
    console.log(
      "❌ JWT token not found in cookies, disconnecting socket:",
      socket.id
    );
    socket.disconnect();
    return;
  }

  console.log("a user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId != "undefined") {
    userSocketMap[userId] = socket.id;
  }

  // Emit when connect
  io.emit("getOnlineUsers", Object.keys(userSocketMap));
  console.log("Emitted online users:", Object.keys(userSocketMap));


  // Join the group room
  socket.on("joinGroup", async (groupId) => {
    socket.join(groupId);
    try {
      const group = await groupModel.findById(groupId);

      if (!group) {
        return socket.emit("error", { message: "Group not found" });
      }

      // Create a Yjs document for this group if it doesn't exist
      if (!yDocs[groupId]) {
        yDocs[groupId] = new Y.Doc(); // Create new Yjs document
      }

      const yText = yDocs[groupId].getText("text");
      
      // Send the initial document state to the client
      socket.emit("sync", yText.toString());

      // Handle document updates from clients
      socket.on("updateDocument", (update) => {
        try {
          // Convert Array from client back to Uint8Array for Yjs
          const uint8Update = new Uint8Array(update);
          
          // Apply the update to the Yjs document
          Y.applyUpdate(yDocs[groupId], uint8Update);

          // Broadcast the update to all other clients in the group
          socket.to(groupId).emit("documentUpdated", update);
        } catch (error) {
          console.error("Error applying Yjs update:", error);
          socket.emit("error", { message: "Failed to update document" });
        }
      });

      // Send previous messages
      const populatedGroup = await group.populate("messages");
      socket.emit("previousMessages", populatedGroup.messages);
    } catch (error) {
      console.error("Error in joinGroup:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // Leave the group room
  socket.on("leaveGroup", (groupId) => {
    socket.leave(groupId);
    // Clean up Yjs document listeners for this socket
    socket.removeAllListeners("updateDocument");
  });

  // When user is typing
  socket.on("typing", (data) => {
    const { groupId, userId } = data;
    socket.to(groupId).emit("typing", { userId });
  });

  // When user stop typing
  socket.on("stopTyping", (data) => {
    const { groupId, userId } = data;
    socket.to(groupId).emit("stopTyping", { userId });
  });

  // When user send message
  socket.on("sendMessage", async (data) => {
    try {
      const { username, groupId, messageContent, userId } = data;

      // Save the message to the database
      const message = new messageModel({
        sendername: username,
        sender: userId,
        group: groupId,
        message: messageContent,
      });

      await message.save();

      // Now, update the group with this new message
      const group = await groupModel.findById(groupId);
      group.messages.push(message._id);
      await group.save();

      // Emit the new message to all users in this group
      io.to(groupId).emit("newMessage", message);

      if (messageContent.startsWith("@metaAI")) {
        const userQuery = messageContent.replace("@metaAI", "").trim();

        // Get Gemini reply
        const result = await model.generateContent(userQuery);
        const geminiReply = result.response.text();

        // Create Gemini message
        const aiMessage = new messageModel({
          sendername: "MetaAI",
          sender: new mongoose.Types.ObjectId(process.env.GEMINI_USER_ID), // create/store a dummy AI user in your DB
          group: groupId,
          message: geminiReply
        });

        await aiMessage.save();

        group.messages.push(aiMessage._id);
        await group.save();

        // Emit Gemini reply
        io.to(groupId).emit("newMessage", aiMessage);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", { message: "Failed to send the message." });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    
    // Remove user from online users
    if (userId != "undefined") {
      delete userSocketMap[userId];
    }
    
    // Emit updated online users list
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    console.log("Emitted online users:", Object.keys(userSocketMap));

  });
});

// Add a cleanup mechanism for unused Yjs documents
// This could be run periodically to save resources
const cleanupUnusedDocs = () => {
  for (const groupId in yDocs) {
    const room = io.sockets.adapter.rooms.get(groupId);
    // If room doesn't exist or is empty, clean up the document
    if (!room || room.size === 0) {
      console.log(`Cleaning up unused Yjs document for group ${groupId}`);
      delete yDocs[groupId];
    }
  }
};

// Run cleanup every hour
setInterval(cleanupUnusedDocs, 60 * 60 * 1000);

export { app, io, server, getReceiverSocketId };