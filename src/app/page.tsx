import VoiceAssistant from "@/components/VoiceAssistant";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-grow flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 text-center bg-gradient-to-r from-blue-500 to-emerald-500 text-transparent bg-clip-text">
          Voice Agent
        </h1>
        <p className="text-gray-400 text-sm sm:text-base mb-8 text-center max-w-md">
          Your AI-powered voice assistant. Ask questions, get answers, and have
          natural conversations.
        </p>
        <div className="w-full max-w-lg bg-gray-900/50 backdrop-blur-sm shadow-xl rounded-xl p-4 sm:p-6 border border-gray-800/50">
          <VoiceAssistant />
        </div>
      </div>
      <div className="w-full max-w-3xl mx-auto px-4 mb-4 sm:mb-6">
        <Footer />
      </div>
    </main>
  );
}
