import { z } from "zod";
import { router, userProcedure } from "../../server/trpc";
import { TRPCError } from "@trpc/server";
import { transcribeAudio } from "./voice.service";

export const voiceRouter = router({
  transcribe: userProcedure
    .input(
      z.object({
        audioData: z.string(), // Base64 encoded audio string
      })
    )
    .mutation(async (opts) => {
      const transcript = await transcribeAudio(opts.input.audioData);
      return { transcript };
    }),
  getDeepgramToken: userProcedure.query(async () => {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "DEEPGRAM_API_KEY not configured",
      });
    }

    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "speak" }),
    });

    if (!response.ok) {
      console.log("Failed to get token from deepgram, ", response);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate Deepgram token",
      });
    }

    const data = await response.json();
    console.log("Deepgram response: ", data);
    return { token: data.access_token };
  }),
});
