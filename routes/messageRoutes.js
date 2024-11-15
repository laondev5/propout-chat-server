import express from "express";
import { saveMessage, getMessages } from "../controllers/messageController.js";

const router = express.Router();

router.post("/messages", saveMessage);
router.get("/messages", getMessages);

export default router;
