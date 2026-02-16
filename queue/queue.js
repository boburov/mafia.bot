import { Queue } from "bullmq";
import { connection } from "./redis";

export const gameQueue = new Queue("game", { connection });
export const reminderQueue = new Queue("reminders", { connection });
