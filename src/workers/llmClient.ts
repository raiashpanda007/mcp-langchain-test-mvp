import OpenAI from "openai";
import { OPENROUTER_KEY } from "../config";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "../config";

export const EMBEDDING_CLIENT  =  new GoogleGenAI({apiKey:GEMINI_API_KEY,});
export const LLMClient = new OpenAI({apiKey:OPENROUTER_KEY,baseURL:"https://openrouter.ai/api/v1"})

