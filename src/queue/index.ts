import { Queue } from "bullmq";

const queue = new Queue("text-embedding-queue");

export default queue;
