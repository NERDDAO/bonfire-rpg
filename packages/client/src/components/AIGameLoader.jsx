import { useState, useEffect } from "react";
import { Zap, Brain, Sparkles, Code, Gamepad2 } from "lucide-react";

const AIGameLoader = () => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentIcon, setCurrentIcon] = useState(0);

  const loadingMessages = [
    "🤖 AI is thinking about the next move...",
    "⚡ Generating epic adventure...",
    "🧠 Analyzing possibilities...",
    "✨ Weaving the narrative...",
    "🎲 Rolling the dice of fate...",
    "🏰 Building the world...",
    "⚔️ Preparing challenges...",
    "📖 Writing your story...",
    "🌟 Adding magic...",
    "🎯 Finalizing the adventure...",
  ];

  const icons = [Brain, Zap, Sparkles, Code, Gamepad2];
  const IconComponent = icons[currentIcon];

  useEffect(() => {
    // Change message every 2 seconds
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);

    // Change icon every 1.5 seconds
    const iconInterval = setInterval(() => {
      setCurrentIcon((prev) => (prev + 1) % icons.length);
    }, 1500);

    return () => {
      clearInterval(messageInterval);
      clearInterval(iconInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-16 px-8">
      {/* Main container with glow effect */}
      <div className="relative">
        {/* Background glow effect */}
        <div className="absolute inset-0 blur-xl opacity-30">
          <div className="w-32 h-32 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
        </div>

        {/* Main icon */}
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-full border border-slate-700 shadow-2xl">
          <IconComponent
            className="w-16 h-16 text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text animate-bounce"
            style={{
              filter: "drop-shadow(0 0 10px rgba(168, 85, 247, 0.4))",
            }}
          />

          {/* Rotating rings */}
          <div className="absolute inset-0 border-2 border-transparent border-t-blue-400 border-r-purple-500 rounded-full animate-spin"></div>
          <div
            className="absolute inset-2 border-2 border-transparent border-b-pink-400 border-l-purple-500 rounded-full animate-spin"
            style={{ animationDirection: "reverse", animationDuration: "3s" }}
          ></div>
        </div>
      </div>

      {/* Animated message */}
      <div className="text-center space-y-4 mt-12">
        <div className="h-8 flex items-center justify-center">
          <p
            key={currentMessageIndex}
            className="text-lg font-medium text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text animate-fadeIn"
          >
            {loadingMessages[currentMessageIndex]}
          </p>
        </div>

        {/* Additional text */}
        <p className="text-sm text-slate-500 max-w-md">
          Our AI is crafting a unique adventure just for you. This might take a moment, but it'll be
          worth the wait!
        </p>
      </div>

      {/* Pulsing dots at the bottom */}
      <div className="flex space-x-2 mt-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-pulse"
            style={{
              animationDelay: `${i * 0.3}s`,
              animationDuration: "1.5s",
            }}
          ></div>
        ))}
      </div>

      {/* <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style> */}
    </div>
  );
};

export default AIGameLoader;
