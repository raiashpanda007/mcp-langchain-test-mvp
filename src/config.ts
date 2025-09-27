import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT;
const HF_KEY = process.env.HF_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_KEY
const QDRANT_URL = process.env.QDRANT_URL
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
function validateConfig() {
  const required = {
    PORT,
    HF_KEY,
    OPENROUTER_KEY,
    QDRANT_URL,
    GEMINI_API_KEY
  };
  for (const [key, value] of Object.entries(required)) {
    console.log("KEY :: ",key, "VALUE :: ", value);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  console.log("All required environment variables are set.");
}

validateConfig();

export {
  PORT,
  OPENROUTER_KEY,
  HF_KEY,
  QDRANT_URL,
  GEMINI_API_KEY
}