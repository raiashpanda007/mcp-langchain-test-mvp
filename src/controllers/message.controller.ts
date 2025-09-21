import { asyncHandler, Response } from "../utils";
import { z as zod } from "zod";
import queue from "../queue"
import { v4 as uuid } from "uuid";


const MessageSchema = zod.object({
    message: zod.string().min(1).max(1000),
    messageFiles: zod.object({
        path: zod.string(),
        fileContent: zod.string().max(1000)
    }).optional()
})
export const MessageController = asyncHandler(async (req, res) => {
    const body = req.body;

    const parsedBody = MessageSchema.safeParse(body);

    if (!parsedBody.success) {
        return res.status(401).json(new Response(401, "Please provide complete info of project", {}));
    }
    const { message, messageFiles } = parsedBody.data;

    const chatID = "97b8691b-5118-4af0-ac72-b40efa66ceec"
    const uniqueId = uuid();
    const messageDetails = await queue.add(`message/${chatID}/${uniqueId}`, {
        message,
        messageFiles:{
            ...messageFiles
        }
    });
    console.log("Saved into redis :: ", messageDetails.data)




})