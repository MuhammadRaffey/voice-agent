import VoiceAssistant from "@/components/VoiceAssistant";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-6 text-center">
        DeepSeek R1 Voice Agent
      </h1>
      <div className="w-full max-w-lg shadow-md rounded-lg p-6">
        <VoiceAssistant />
      </div>
      <div className="w-full max-w-lg shadow-md rounded-lg p-6">
        <Footer />
      </div>
    </main>
  );
}
