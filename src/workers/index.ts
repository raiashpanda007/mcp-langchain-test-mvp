import { Worker } from "bullmq";

const worker = new Worker('text-embedding-queue', async (job) => {
    console.log("Processing job of job id", job.id, "data : \n",job.data)
}, {
    concurrency: 100,
    connection: {
        host: 'localhost',
        port: 6379
    }
})

worker.on("completed", (job) => {
  console.log(`✅ Job completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job failed: ${job?.id}`, err);
});

worker.on("error", (err) => {
  console.error("Worker connection error:", err);
});
