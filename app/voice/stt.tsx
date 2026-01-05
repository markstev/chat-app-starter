"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "../../utils/trpc";
import { useAmplitude } from "../hooks";
import {
  createClient,
  LiveTranscriptionEvents,
  type ListenLiveClient,
} from "@deepgram/sdk";

interface STTButtonProps {
  onSpeechDone: (transcribedText: string) => void;
  onStreamingTranscript?: (transcript: string) => void;
  disabled?: boolean;
}

export function STTButton({
  onSpeechDone,
  onStreamingTranscript,
  disabled = false,
}: STTButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramConnectionRef = useRef<ListenLiveClient | null>(null);
  const streamingTranscriptRef = useRef<string>("");
  const recordingStartTimeRef = useRef<number | null>(null);

  const getTokenQuery = trpc.voice.getDeepgramToken.useQuery(undefined, {
    enabled: false,
    refetchOnWindowFocus: false,
  });
  const { track } = useAmplitude();

  // Cleanup function to stop recording and release resources
  const cleanup = () => {
    if (deepgramConnectionRef.current) {
      try {
        deepgramConnectionRef.current.finish();
      } catch (error) {
        console.error("Error closing Deepgram connection:", error);
      }
      deepgramConnectionRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("Error stopping MediaRecorder:", error);
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    streamingTranscriptRef.current = "";
    recordingStartTimeRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      // First, get the ephemeral token from the backend
      setIsTranscribing(true);
      const tokenData = await getTokenQuery.refetch();
      if (!tokenData.data?.token) {
        throw new Error("Failed to get Deepgram token");
      }

      // Create Deepgram client with the ephemeral token
      const deepgram = createClient({ accessToken: tokenData.data.token });
      const connection = deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
      });

      deepgramConnectionRef.current = connection;
      streamingTranscriptRef.current = "";

      // Set up Deepgram event handlers
      connection.on(LiveTranscriptionEvents.Open, async () => {
        console.log("Deepgram connection opened");
        setIsTranscribing(false);
        setIsRecording(true);
        recordingStartTimeRef.current = Date.now();
        track("record_voice");

        // Request microphone access
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          streamRef.current = stream;

          // Create MediaRecorder with WebM format (default browser support)
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported("audio/webm")
              ? "audio/webm"
              : MediaRecorder.isTypeSupported("audio/ogg")
              ? "audio/ogg"
              : "",
          });

          mediaRecorderRef.current = mediaRecorder;

          // Send audio chunks to Deepgram
          mediaRecorder.ondataavailable = (event) => {
            if (
              event.data.size > 0 &&
              connection.getReadyState() === 1 // WebSocket.OPEN
            ) {
              connection.send(event.data);
            }
          };

          // Start recording with 250ms chunks for low latency
          mediaRecorder.start(250);
        } catch (error) {
          console.error("Error accessing microphone:", error);
          cleanup();
          setIsRecording(false);
          setIsTranscribing(false);
          if (error instanceof Error) {
            if (error.name === "NotAllowedError") {
              alert(
                "Microphone permission denied. Please enable microphone access in your browser settings."
              );
            } else if (error.name === "NotFoundError") {
              alert(
                "No microphone found. Please connect a microphone and try again."
              );
            } else {
              alert(`Error accessing microphone: ${error.message}`);
            }
          }
        }
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          if (data.is_final) {
            // For final transcripts, append to the accumulated text
            streamingTranscriptRef.current +=
              (streamingTranscriptRef.current ? " " : "") + transcript;
            // Update UI with the accumulated final transcript
            onStreamingTranscript?.(streamingTranscriptRef.current);
          } else {
            // For interim transcripts, show current accumulated + interim
            const currentTranscript =
              streamingTranscriptRef.current +
              (streamingTranscriptRef.current ? " " : "") +
              transcript;
            onStreamingTranscript?.(currentTranscript);
          }
        }
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log("Deepgram connection closed");
      });

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error("Deepgram connection error:", error);
        cleanup();
        setIsRecording(false);
        setIsTranscribing(false);
        alert("Error with transcription service. Please try again.");
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsTranscribing(false);
      setIsRecording(false);
      if (error instanceof Error) {
        alert(`Error starting transcription: ${error.message}`);
      }
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    setIsRecording(false);
    setIsTranscribing(true);

    // Stop media recorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }

    // Close Deepgram connection
    if (deepgramConnectionRef.current) {
      try {
        deepgramConnectionRef.current.finish();
      } catch (error) {
        console.error("Error closing Deepgram connection:", error);
      }
      deepgramConnectionRef.current = null;
    }

    // Stop all audio tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Calculate duration and words per minute
    const endTime = Date.now();
    const durationSeconds = recordingStartTimeRef.current
      ? Math.round((endTime - recordingStartTimeRef.current) / 1000)
      : 0;

    // Get final transcript
    const finalTranscript = streamingTranscriptRef.current.trim();

    // Clear streaming display first
    onStreamingTranscript?.("");

    if (finalTranscript) {
      // Count words in transcript
      const wordCount = finalTranscript
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
      const wordsPerMinute =
        durationSeconds > 0
          ? Math.round((wordCount / durationSeconds) * 60)
          : 0;

      // Append summary to transcript
      const transcriptWithSummary = `${finalTranscript}\n\n[spoke for ${durationSeconds} seconds, ${wordsPerMinute} words per minute]\n\n`;

      onSpeechDone(transcriptWithSummary);
    } else {
      // Even if no transcript, we should notify that transcription is done
      // This ensures the UI state is cleared (parent will handle empty string)
      onSpeechDone("");
    }

    // Clear streaming transcript
    streamingTranscriptRef.current = "";
    recordingStartTimeRef.current = null;
    setIsTranscribing(false);
  };

  const handleClick = () => {
    if (disabled || isTranscribing) {
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isTranscribing}
      className={`p-2 rounded-lg transition-colors ${
        isRecording
          ? "bg-red-500 dark:bg-red-600 text-white animate-pulse"
          : isTranscribing
          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      } ${disabled || isTranscribing ? "opacity-50 cursor-not-allowed" : ""}`}
      title={
        isRecording
          ? "Stop recording"
          : isTranscribing
          ? "Transcribing..."
          : "Start voice input"
      }
    >
      {isTranscribing ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : isRecording ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      )}
    </button>
  );
}
