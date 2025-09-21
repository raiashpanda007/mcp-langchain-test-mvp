import { Router } from "express";
import { MessageController } from "../controllers/message.controller";
const messageRouter = Router();

messageRouter.post("/", MessageController);

export default messageRouter;