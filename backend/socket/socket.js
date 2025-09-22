import { Server } from "socket.io";
import http from "http";
import express from "express";
import cookie from "cookie";
import messageModel from "../models/messageModel.js";
import groupModel from "../models/groupModel.js";
import * as Y from "yjs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from "mongoose";

// A simple, self-contained debounce function. No new library is needed.
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://b2code.netlify.app",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const userSocketMap = {};
const yDocs = new Map(); // Store Yjs documents for each group
const saveTimers = new Map(); // Store save timers for each group

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
    console.log("❌ JWT token not found in cookies, disconnecting socket:", socket.id);
    socket.disconnect();
    return;
  }

  console.log("a user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId != "undefined") {
    userSocketMap[userId] = socket.id;
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("joinGroup", async (groupId) => {
    socket.join(groupId);
    try {
      if (!yDocs.has(groupId)) {
        const doc = new Y.Doc();
        yDocs.set(groupId, doc);

        console.log(`First user in group ${groupId}, loading from DB...`);
        const groupData = await groupModel.findById(groupId);
        if (groupData && groupData.code) {
          groupData.code.forEach(langData => {
            doc.getText(langData.language).insert(0, langData.content);
          });
        }
      }

      // Send the full current state of the document to the newly joined user
      const doc = yDocs.get(groupId);
      const docState = Y.encodeStateAsUpdate(doc);
      socket.emit("document-sync", Array.from(docState));

      // Send chat messages
      const group = await groupModel.findById(groupId).populate("messages");
      if (group) {
        socket.emit("previousMessages", group.messages);
      }
    } catch (error) {
      console.error("Error in joinGroup:", error);
      socket.emit("error", { message: error.message });
    }
  });

 
  socket.on("document-change", ({ groupId, update }) => {
    // LOG 2
    console.log(`➡️ BACKEND: Received 'document-change' for group: ${groupId}`);
    
    const doc = yDocs.get(groupId);
    if (!doc) return;
    
    Y.applyUpdate(doc, new Uint8Array(update));
    socket.to(groupId).emit("document-update", update);

    // LOG 3
    console.log(`⬅️ BACKEND: Broadcasted 'document-update' to room: ${groupId}`);
    
    if (!saveTimers.has(groupId)) {
      // ... debounce logic ...
    }
    
    // LOG 5
    console.log(`⏳ BACKEND: Triggering debounced save for group: ${groupId}`);
    saveTimers.get(groupId)();
  });

  socket.on("leaveGroup", (groupId) => {
    socket.leave(groupId);
  });

  socket.on("typing", (data) => {
    const { groupId, userId } = data;
    socket.to(groupId).emit("typing", { userId });
  });

  socket.on("stopTyping", (data) => {
    const { groupId, userId } = data;
    socket.to(groupId).emit("stopTyping", { userId });
  });

  socket.on("sendMessage", async (data) => {
    try {
      const { username, groupId, messageContent, userId } = data;
      const message = new messageModel({
        sendername: username,
        sender: userId,
        group: groupId,
        message: messageContent,
      });
      await message.save();
      const group = await groupModel.findById(groupId);
      group.messages.push(message._id);
      await group.save();
      io.to(groupId).emit("newMessage", message);

      if (messageContent.startsWith("@metaAI")) {
        const userQuery = messageContent.replace("@metaAI", "").trim();
        const result = await model.generateContent(userQuery);
        const geminiReply = result.response.text();
        const aiMessage = new messageModel({
          sendername: "MetaAI",
          sender: new mongoose.Types.ObjectId(process.env.GEMINI_USER_ID),
          group: groupId,
          message: geminiReply
        });
        await aiMessage.save();
        group.messages.push(aiMessage._id);
        await group.save();
        io.to(groupId).emit("newMessage", aiMessage);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", { message: "Failed to send the message." });
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    if (userId != "undefined") {
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

const cleanupUnusedDocs = () => {
  for (const groupId in yDocs) {
    const room = io.sockets.adapter.rooms.get(groupId);
    if (!room || room.size === 0) {
      console.log(`Cleaning up unused Yjs document for group ${groupId}`);
      // Important to also clear the timer to prevent memory leaks
      const timer = saveTimers.get(groupId);
      if (timer) {
          // If your debounce function had a .cancel method, you'd call it here.
          // Since our simple one doesn't, we just delete it. The timeout will expire harmlessly.
          saveTimers.delete(groupId);
      }
      delete yDocs[groupId];
    }
  }
};

setInterval(cleanupUnusedDocs, 60 * 60 * 1000);

export { app, io, server, getReceiverSocketId };