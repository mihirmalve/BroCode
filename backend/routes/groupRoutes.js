import express from "express";
import groupController from "../controllers/groupController.js";

const router = express.Router();

router.post("/create", groupController.createGroup);
router.post("/join", groupController.joinGroup);
router.post("/info", groupController.getGroupInfo);
router.post("/kick", groupController.kickUser);
router.post("/leave", groupController.leaveGroup);
router.post("/saveCodeGroup", groupController.saveCodeGroup);
router.post("/getCodeGroup", groupController.getCodeGroup);

export default router;
