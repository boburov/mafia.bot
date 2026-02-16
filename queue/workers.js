import { Worker } from "bullmq";
import { connection } from "./redis";

export function startWorkers(bot) {
    new Worker(
        "game",
        async (job) => {
            const { roomId, phase } = job.data;

            // Minimal demo:
            await bot.telegram.sendMessage(job.data.chatId, `⏳ Phase ended: ${phase} (room ${roomId})`);

            // Keyingi fazani boshlash logikang shu yerda bo‘ladi:
            // if (phase === "NIGHT") await startDay(roomId)
        },
        { connection }
    );

    // Reminders
    new Worker(
        "reminders",
        async (job) => {
            const { chatId, text } = job.data;
            await bot.telegram.sendMessage(chatId, `⏰ Reminder: ${text}`);
        },
        { connection }
    );
}
