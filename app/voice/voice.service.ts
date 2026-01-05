import { createClient } from "@deepgram/sdk";
import { Readable } from "stream";

/**
 * Transcribe audio data using Deepgram API
 * @param audioData - Base64 encoded audio string or Buffer
 * @returns Transcribed text string
 */
export async function transcribeAudio(
  audioData: string | Buffer
): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY environment variable is not set");
  }

  const deepgram = createClient(apiKey);

  // Convert base64 string to buffer if needed
  let audioBuffer: Buffer;
  if (typeof audioData === "string") {
    // Remove data URL prefix if present (e.g., "data:audio/webm;base64,")
    const base64Data = audioData.includes(",")
      ? audioData.split(",")[1]
      : audioData;
    audioBuffer = Buffer.from(base64Data, "base64");
  } else {
    audioBuffer = audioData;
  }

  // Create a Node.js readable stream from the buffer
  const stream = Readable.from(audioBuffer);

  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      stream,
      {
        model: "nova-3",
        smart_format: true,
      }
    );

    if (error) {
      throw new Error(`Deepgram API error: ${error.message}`);
    }

    if (!result?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      throw new Error("No transcript found in Deepgram response");
    }

    const transcript =
      result.results.channels[0].alternatives[0].transcript || "";

    return transcript;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
}
