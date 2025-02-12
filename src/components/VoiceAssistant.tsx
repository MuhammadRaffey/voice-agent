"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Loader2 } from "lucide-react";

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    webkitAudioContext: typeof AudioContext;
  }
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "";
const voiceId = "EXAVITQu4vr4xnSDxMaL";
const model = "eleven_flash_v2_5";
const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}`;

interface SSEEvent {
  text: string;
}

export default function VoiceAssistant() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalResponse, setFinalResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [visibleText, setVisibleText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioChunks: Uint8Array[] = [];
  const responseBuffer = useRef(""); // Added to handle streaming text accumulation

  useEffect(() => {
    const preloadSocket = new WebSocket(wsUrl);
    preloadSocket.onopen = () => {
      console.log("Preloading WebSocket...");
      preloadSocket.send(
        JSON.stringify({
          text: "Hi",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
          xi_api_key: ELEVENLABS_API_KEY,
        })
      );
      preloadSocket.send(JSON.stringify({ text: "" }));
    };

    preloadSocket.onerror = (error) => {
      console.warn("Preload WebSocket error (expected):", error);
    };

    preloadSocket.onclose = () => {
      console.log("Preload WebSocket closed.");
    };

    return () => preloadSocket.close();
  }, []);

  useEffect(() => {
    if (isSpeaking && finalResponse) {
      const words = finalResponse.split(" ");
      if (wordIndex < words.length) {
        const timer = setTimeout(() => {
          setVisibleText(words.slice(0, wordIndex + 1).join(" "));
          setWordIndex((prev) => prev + 1);
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [isSpeaking, wordIndex, finalResponse]);

  const startRecording = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const resultTranscript = event.results[0][0].transcript;
      setTranscript(resultTranscript);
      fetchAIResponse(resultTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const fetchAIResponse = async (userText: string) => {
    setFinalResponse("");
    setIsLoading(true);
    setVisibleText("");
    setWordIndex(0);
    responseBuffer.current = ""; // Reset response buffer

    try {
      const response = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.startsWith("data:")) {
            const jsonStr = part.replace(/^data:\s*/, "");
            try {
              const event: SSEEvent = JSON.parse(jsonStr);
              responseBuffer.current += event.text; // Use buffer ref instead of state
            } catch (err) {
              console.error("Error parsing SSE event:", err);
            }
          } else if (part.startsWith("event: done")) {
            setFinalResponse(responseBuffer.current); // Use buffered response
            setIsLoading(false);
            streamAudio(responseBuffer.current); // Pass buffered text directly
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      setIsLoading(false);
    }
  };

  const streamAudio = (text: string) => {
    audioChunks.length = 0;
    const socket = new WebSocket(wsUrl);
    setIsSpeaking(true);

    socket.onopen = () => {
      const bosMessage = {
        text: " ",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        xi_api_key: ELEVENLABS_API_KEY,
      };
      socket.send(JSON.stringify(bosMessage));
      socket.send(JSON.stringify({ text }));
      socket.send(JSON.stringify({ text: "" }));
    };

    socket.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.audio) {
        try {
          const audioData = Uint8Array.from(atob(response.audio), (c) =>
            c.charCodeAt(0)
          );
          audioChunks.push(audioData);
        } catch (err) {
          console.error("Error converting audio data:", err);
        }
      }
      if (response.isFinal) {
        playAudioChunks();
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setIsSpeaking(false);
    };

    socket.onclose = () => {
      setTimeout(() => setIsSpeaking(false), 2000);
    };
  };

  const playAudioChunks = async () => {
    if (audioChunks.length === 0) {
      console.warn("No audio chunks available for merging.");
      return;
    }

    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      if (audioContext.state === "suspended") await audioContext.resume();

      const combinedBuffer = mergeAudioChunks(audioChunks);
      const audioBuffer = await decodeAudioDataWithRetry(
        audioContext,
        combinedBuffer,
        3
      );

      if (!audioBuffer)
        throw new Error("Audio buffer decoding failed after retries.");

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);

      source.onended = () => setIsSpeaking(false);
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsSpeaking(false);
    }
  };

  const decodeAudioDataWithRetry = async (
    audioContext: AudioContext,
    buffer: ArrayBuffer,
    retries: number
  ): Promise<AudioBuffer | null> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await new Promise<AudioBuffer>((resolve, reject) => {
          audioContext.decodeAudioData(buffer, resolve, reject);
        });
      } catch (error) {
        console.warn(`decodeAudioData attempt ${attempt} failed:`, error);
      }
    }
    return null;
  };

  const mergeAudioChunks = (chunks: Uint8Array[]): ArrayBuffer => {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const mergedArray = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      mergedArray.set(chunk, offset);
      offset += chunk.length;
    }
    return mergedArray.buffer;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 bg-gray-900 rounded-xl shadow-2xl">
      <button
        onClick={startRecording}
        disabled={isRecording}
        className={`w-full relative overflow-hidden group px-6 py-4 rounded-lg font-semibold text-lg transition-all duration-300 ease-in-out ${
          isRecording
            ? "bg-red-600 hover:bg-red-700"
            : "bg-blue-600 hover:bg-blue-700"
        } flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isRecording ? (
          <>
            <div className="animate-pulse">
              <Mic className="w-6 h-6" />
            </div>
            <span>Listening...</span>
          </>
        ) : (
          <>
            <Mic className="w-6 h-6" />
            <span>Record your question</span>
          </>
        )}
      </button>

      {transcript && (
        <div className="space-y-2 animate-fadeIn">
          <h3 className="text-gray-400 font-medium">You said:</h3>
          <p className="text-white text-lg p-4 bg-gray-800 rounded-lg">
            {transcript}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-3 text-blue-400 animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Processing response...</span>
        </div>
      )}

      {finalResponse && (
        <div className="space-y-2 animate-fadeIn">
          <div className="flex items-center gap-3">
            <h3 className="text-gray-400 font-medium">DeepSeek R1:</h3>
            {isSpeaking && (
              <div className="relative flex items-center justify-center">
                <div className="absolute w-3 h-3 bg-blue-500 rounded-full"></div>
                <div className="absolute w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
                <div className="absolute w-4 h-4 bg-blue-400 rounded-full animate-pulse opacity-75"></div>
              </div>
            )}
          </div>
          <div className="relative p-4 bg-gray-800 rounded-lg">
            <p className="text-white text-lg whitespace-pre-line">
              {isSpeaking ? visibleText : finalResponse}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
