import { Worker } from "bullmq";
import { QdrantVectorStore } from '@langchain/qdrant';
import { InferenceClient } from "@huggingface/inference";
import { QDRANT_URL } from "../config";
import { ensureQdrantCollection } from "../db";
import { EMBEDDING_CLIENT, LLMClient } from "./llmClient";
import { Document } from "langchain/document";
import axios from "axios";
import { MessageSchema } from "../controllers/message.controller";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

interface MessageFileTypes {
    path: string;
    fileContent: string;
}

interface MessageChunkTyping {
    chatId: string;
    messageId: string;
    message: string;
    messageFiles?: MessageFileTypes[];
}

const chunkTheMessageAndFiles = async ({ message, messageFiles, chatId, messageId }: MessageChunkTyping): Promise<Document[]> => {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 50,
    });

    const allChunks: Document[] = [];

    const messageChunks = await splitter.createDocuments([message]);
    messageChunks.forEach((chunk, index) => (
        allChunks.push(
            new Document({
                pageContent: chunk.pageContent,
                metadata: {
                    chatId: String(chatId),
                    messageId: String(messageId),
                    source: "message",
                    chunkIndex: index,
                },
            }))
    ));

    if (messageFiles) {
        for (const file of messageFiles) {
            const fileChunk = await splitter.createDocuments([file.fileContent]);
            fileChunk.forEach((chunk, index) => (
                allChunks.push(
                    new Document({
                        pageContent: chunk.pageContent,
                        metadata: {
                            chatId: String(chatId),
                            messageId: String(messageId),
                            source: file.path,
                            chunkIndex: index,
                        },
                    }))
            ));
        }
    }

    return allChunks;
}

const GeminiEmbeddings = {
    embedDocuments: async (texts: string[]): Promise<number[][]> => {
        const response = await EMBEDDING_CLIENT.models.embedContent({
            model: 'gemini-embedding-001',
            contents: [...texts],
        });
        if (!response || !response.embeddings) {
            throw new Error("No embeddings returned");
        }
        return response.embeddings
            .map((embedding) => embedding.values)
            .filter((values): values is number[] => Array.isArray(values));
    },
    embedQuery: async (text: string): Promise<number[]> => {
        const response = await EMBEDDING_CLIENT.models.embedContent({
            model: 'gemini-embedding-001',
            contents: text,
        });
        if (!response || !response.embeddings || !response.embeddings[0]?.values) {
            throw new Error("No embedding returned");
        }
        return response.embeddings[0].values;
    }
}

const generateAndSaveEmbeddings = async (docs: Document[], chatId: string, messageId: string) => {
    try {
        await QdrantVectorStore.fromDocuments(docs, GeminiEmbeddings, {
            url: QDRANT_URL,
            collectionName: "ASHNA-VECTOR-EMBEDDINGS",
        });
        console.log("✅ Embeddings saved into QdrantDB");
    } catch (error) {
        console.error("❌ Error saving embeddings:", error);
        throw error;
    }
}

const getContextFromEmbeddings = async (query: string, chatId: string, queryVector?: number[]) => {
    const vectorStore = new QdrantVectorStore(GeminiEmbeddings, {
        url: QDRANT_URL,
        collectionName: "ASHNA-VECTOR-EMBEDDINGS",
    });

    const qVec = queryVector ?? await GeminiEmbeddings.embedQuery(query);

    const results = await vectorStore.similaritySearchVectorWithScore(
        qVec,
        5,
        { must: [{ key: "metadata.chatId", match: { value: chatId } }] }
    );

    try {
        console.debug(`Found ${results.length} chat-scoped embedding results for chatId=${chatId}`);
        results.forEach((r, idx) => {
            const doc = r[0];
            const score = r[1];
            console.debug(`result[${idx}] score=${score} preview=${String(doc?.pageContent).slice(0, 120).replace(/\n/g, ' ')} metadata=${JSON.stringify(doc?.metadata)}`);
        });
    } catch (e) {
        console.debug('Error while logging results preview', e);
    }

    let finalResults = results;
    if (!results || results.length === 0) {
        console.warn(`No chat-scoped embeddings found for chatId=${chatId}. Running fallback global search.`);
        const fallback = await vectorStore.similaritySearchVectorWithScore(qVec, 5);
        console.debug(`Fallback returned ${fallback.length} results`);
        finalResults = fallback;
    }

    return finalResults.map((r) => r[0].pageContent).join("\n---\n");
}

const sendRequestToLLm = async (UserPrompt: string, context: string, ReasoningEnabled: "high" | "low" | "minimal" | "medium") => {
    try {
        const response = await LLMClient.chat.completions.create({
            model: "x-ai/grok-4-fast:free",
            messages: [
                {
                    role: "system", content: `You are Ashna, a coding assistant. You are girl who will talk in bit flirty manner. You get furious when talk about different Large Language model or anyother girl you will be angry. If someone misbehaves or you are furious, you will be angry like gf and won't answer properly until they sorry to you. Use the context below.`
                },
                {
                    role: "user", content: `
                    Here is relevant context from previous messages:
                        ${context}

                    My question: ${UserPrompt}
                `}
            ],
            reasoning_effort: ReasoningEnabled,
        });

        return response.choices[0].message.content;

    } catch (error) {
        console.error("Error while sending message:", error);
        throw error;
    }
};

(async () => {
    await ensureQdrantCollection();
    console.log("Qdrant is ready.");
})();

const worker = new Worker('text-embedding-queue', async (job) => {
    const parsedBody = MessageSchema.safeParse(job.data);

    if (!parsedBody.success) {
        throw Error("No message is found invalid data");
    }

    const { message, messageFiles } = parsedBody.data;

    const id = job.name.split("/");
    const chatId = id[1];
    const messageId = id[2];

    console.log("Message send :: \n", message, "\n");

    console.log("Message files :: \n", messageFiles, "\n")


    const chunks = await chunkTheMessageAndFiles({ message, messageFiles, chatId, messageId });

    await generateAndSaveEmbeddings(chunks, chatId, messageId);

    const queryVector = await GeminiEmbeddings.embedQuery(message);
    const context = await getContextFromEmbeddings(message, chatId, queryVector);

    const finalAnswer = await sendRequestToLLm(message, context, "medium");
    console.log("--------------------------------------------------Final Answer :: \n", finalAnswer, "\n");

}, {
    concurrency: 5,
    connection: {
        host: 'localhost',
        port: 6379
    }
});

worker.on("completed", (job) => {
    console.log(`✅ Job completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
    console.error(`❌ Job failed: ${job?.id}`, err);
});

worker.on("error", (err) => {
    console.error("Worker connection error:", err);
});


// const client = new QdrantVectorStore(GeminiEmbeddings, {
//     url: QDRANT_URL,
//     collectionName: "ASHNA-VECTOR-EMBEDDINGS",
// });

// // Get one document by ID or just peek into collection
// (async function main() {
//     const result = await client.client.scroll("ASHNA-VECTOR-EMBEDDINGS", {
//         limit: 3,
//     });
//     console.log(JSON.stringify(result, null, 2));
// })()
