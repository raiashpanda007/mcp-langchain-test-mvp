import { PrismaClient } from '@prisma/client';
import { QdrantClient } from "@qdrant/js-client-rest";
import { QDRANT_URL } from "./config"
let prismaClientSingleton: PrismaClient | null = null;

function getPrismaClient() {
  if (!prismaClientSingleton) {
    prismaClientSingleton = new PrismaClient();
  }
  return prismaClientSingleton;
}

export const prisma = getPrismaClient();


export const qdrant = new QdrantClient({ url: "http://localhost:6333" });

export async function ensureQdrantCollection() {
  try {
    // Check if collection exists
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === "ASHNA-VECTOR-EMBEDDINGS"
    );

    if (!exists) {
      console.log("Creating Qdrant collection...");
      await qdrant.createCollection("ASHNA-VECTOR-EMBEDDINGS", {
        vectors: { size: 3072, distance: "Cosine" },
      });
      console.log("✅ Collection created.");
    } else {
      console.log("✅ Qdrant collection already exists.");
    }
  } catch (err) {
    console.error("❌ Error ensuring Qdrant collection:", err);
  }
}


