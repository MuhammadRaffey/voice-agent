"use client";

import { useState, useRef } from "react";

const ELEVENLABS_API_KEY =
  "sk_87afd3392e91f4f81fff9c737ccb2089b1ac2ff6586bb1ef";
const voiceId = "EXAVITQu4vr4xnSDxMaL";
const model = "eleven_flash_v2_5";
const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}`;

interface SSEEvent {
  text: string;
}

export default function VoiceAssistant() {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [responseText, setResponseText] = useState<string>("");
  const [finalResponse, setFinalResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioChunks: Uint8Array[] = [];

  const startRecording = () => {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

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

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const fetchAIResponse = async (userText: string) => {
    setResponseText("");
    setFinalResponse("");
    setIsLoading(true);

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
              setResponseText((prev) => prev + event.text);
            } catch (err) {
              console.error("Error parsing SSE event:", err);
            }
          } else if (part.startsWith("event: done")) {
            setFinalResponse(responseText);
            setIsLoading(false);
            streamAudio(responseText);
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
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      const bosMessage = {
        text: " ",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
        xi_api_key: ELEVENLABS_API_KEY,
      };

      socket.send(JSON.stringify(bosMessage));
      socket.send(JSON.stringify({ text }));
      socket.send(JSON.stringify({ text: "" }));
    };

    socket.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.audio) {
        const audioData = Uint8Array.from(atob(response.audio), (c) =>
          c.charCodeAt(0)
        );
        audioChunks.push(audioData);
      }
      if (response.isFinal) {
        playAudioChunks();
      }
    };

    socket.onerror = (error) => console.error("WebSocket Error:", error);
    socket.onclose = (event) =>
      console[event.wasClean ? "info" : "warn"](
        `Connection ${event.wasClean ? "closed cleanly" : "died"}, code=${
          event.code
        }, reason=${event.reason}`
      );
  };

  const playAudioChunks = () => {
    const audioContext = new AudioContext();
    const combinedBuffer = mergeAudioChunks(audioChunks);
    audioContext.decodeAudioData(combinedBuffer, (buffer) => {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
    });
  };

  const mergeAudioChunks = (chunks: Uint8Array[]): ArrayBuffer => {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const mergedArray = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
      mergedArray.set(chunk, offset);
      offset += chunk.length;
    });
    return mergedArray.buffer;
  };

  return (
    <>
      <button
        onClick={startRecording}
        className={`w-full px-4 py-2 font-semibold rounded ${
          isRecording ? "bg-red-600" : "bg-blue-600"
        } text-white hover:opacity-90 focus:outline-none`}
        disabled={isRecording}
      >
        {isRecording ? "Listening..." : "Record your question"}
      </button>

      {transcript && (
        <div className="mt-4">
          <p className="text-gray-700">
            <span className="font-semibold">You said:</span> {transcript}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="mt-4 text-blue-600 font-medium">
          Processing response...
        </div>
      )}

      {finalResponse && (
        <div className="mt-4">
          <p className="text-gray-700 whitespace-pre-line">
            <span className="font-semibold">DeepSeek R1:</span> {finalResponse}
          </p>
        </div>
      )}
    </>
  );
}
