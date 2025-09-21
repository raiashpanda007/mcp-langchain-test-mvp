import { Queue } from "bullmq";

const queue = new Queue('text-embedding-queue', {
    connection: {
        host: 'localhost',
        port: 6379,
    },
});

export default queue;
