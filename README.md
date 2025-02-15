# Voice Agent

## Description

Voice Agent is an AI-powered voice assistant application built with Next.js, React, and Tailwind CSS. It leverages the Groq SDK and ElevenLabs API to provide natural language processing and text-to-speech capabilities.

## Features

- Voice recognition using the browser's SpeechRecognition API
- Real-time AI responses using Groq SDK
- Text-to-speech conversion using ElevenLabs API
- Responsive and modern UI with Tailwind CSS

## Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/MuhammadRaffey/voice-agent
   cd voice-agent
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Create a `.env` file in the root directory and add your environment variables:
   ```env
   NEXT_PUBLIC_ELEVENLABS_API_KEY=your-elevenlabs-api-key
   GROQ_API_KEY=your-groq-api-key
   ```

## Usage

1. Start the development server:

   ```sh
   pnpm dev
   ```

2. Open your browser and navigate to `http://localhost:3000`.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
