import { NextRequest } from "next/server";
import Groq from "groq-sdk";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  throw new Error("GROQ API key is not set in environment variables");
}

const groqClient = new Groq({ apiKey: GROQ_API_KEY });

export async function POST(request: NextRequest): Promise<Response> {
  try {
    console.log("API Request Received");
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
      });
    }

    // console.log("Starting conversation with text:", text);

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content:
          "You are a language model called DeepSeek R1 created by DeepSeek, answer the questions being asked in less than 500 characters.",
      },
      {
        role: "user",
        content: `${text}`,
      },
    ];

    let textBuffer = "";

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          // console.log("Requesting Groq completion...");
          const completionStream = await groqClient.chat.completions.create({
            model: "llama-3.3-70b-versatile", //deepseek-r1-distill-llama-70b
            messages: messages,
            temperature: 0.7,
            max_tokens: 1024,
            top_p: 1,
            stop: null,
            stream: true,
          });
          // console.log("Groq stream received");

          for await (const chunk of completionStream) {
            const delta: string = chunk.choices[0]?.delta?.content || "";
            textBuffer += delta;
            // console.log("Chunk received from Groq:", delta);

            // Check if the buffer ends with a period to send a full sentence
            if (textBuffer.endsWith(".")) {
              // console.log("Full sentence ready:", textBuffer);
              controller.enqueue(
                `data: ${JSON.stringify({ text: textBuffer })}\n\n`
              );
              textBuffer = ""; // Reset buffer after sending the sentence
            }
          }

          // Send any remaining text in the buffer
          if (textBuffer) {
            // console.log("Final buffer processing:", textBuffer);
            controller.enqueue(
              `data: ${JSON.stringify({ text: textBuffer })}\n\n`
            );
          }

          // console.log("Stream complete, sending event: done");
          controller.enqueue(`event: done\ndata: {}\n\n`);
          controller.close();
        } catch (error) {
          console.error("Error in streaming API:", error);
          controller.enqueue(
            `event: error\ndata: ${JSON.stringify({
              error: "Stream error",
            })}\n\n`
          );
          controller.close();
        }
      },
    });

    console.log("Returning SSE response");
    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in API route:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
