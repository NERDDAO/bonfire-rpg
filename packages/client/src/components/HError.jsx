import { AlertTriangle, Wifi, Server, Lock, Search, Zap } from "lucide-react";

const HError = ({ error }) => {
  const getErrorConfig = () => {
    const configs = {
      400: {
        icon: AlertTriangle,
        title: "Bad Request",
        message: "The request could not be understood by the server.",
        color: "text-yellow-400",
        bgColor: "from-yellow-400/20 to-orange-400/20",
        borderColor: "border-yellow-400/30",
      },
      401: {
        icon: Lock,
        title: "Unauthorized",
        message: "Authentication is required to access this resource.",
        color: "text-red-400",
        bgColor: "from-red-400/20 to-pink-400/20",
        borderColor: "border-red-400/30",
      },
      403: {
        icon: Lock,
        title: "Forbidden",
        message: "You don't have permission to access this resource.",
        color: "text-red-400",
        bgColor: "from-red-400/20 to-pink-400/20",
        borderColor: "border-red-400/30",
      },
      404: {
        icon: Search,
        title: "Not Found",
        message: "The requested resource could not be found.",
        color: "text-blue-400",
        bgColor: "from-blue-400/20 to-purple-400/20",
        borderColor: "border-blue-400/30",
      },
      500: {
        icon: Server,
        title: "Internal Server Error",
        message: "Something went wrong on our end. Please try again later.",
        color: "text-red-400",
        bgColor: "from-red-400/20 to-pink-400/20",
        borderColor: "border-red-400/30",
      },
      502: {
        icon: Server,
        title: "Bad Gateway",
        message: "The server received an invalid response from upstream.",
        color: "text-orange-400",
        bgColor: "from-orange-400/20 to-red-400/20",
        borderColor: "border-orange-400/30",
      },
      503: {
        icon: Server,
        title: "Service Unavailable",
        message: "The service is temporarily unavailable. Please try again later.",
        color: "text-orange-400",
        bgColor: "from-orange-400/20 to-red-400/20",
        borderColor: "border-orange-400/30",
      },
      network: {
        icon: Wifi,
        title: "Network Error",
        message: "Unable to connect to the server. Check your internet connection.",
        color: "text-gray-400",
        bgColor: "from-gray-400/20 to-slate-400/20",
        borderColor: "border-gray-400/30",
      },
      timeout: {
        icon: Zap,
        title: "Request Timeout",
        message: "The request took too long to complete. Please try again.",
        color: "text-yellow-400",
        bgColor: "from-yellow-400/20 to-orange-400/20",
        borderColor: "border-yellow-400/30",
      },
    };

    return configs[error] || configs[500];
  };

  const config = getErrorConfig(error);
  const IconComponent = config.icon;

  return (
    <div className="flex items-center justify-center min-h-[300px] p-8">
      <div
        className={`relative max-w-md w-full bg-gradient-to-br ${config.bgColor} backdrop-blur-sm border ${config.borderColor} rounded-2xl p-8 shadow-2xl`}
      >
        {/* Subtle glow effect */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${config.bgColor} rounded-2xl blur-xl opacity-50 -z-10`}
        ></div>

        <div className="text-center space-y-6">
          {/* Error code */}
          <div className="space-y-4">
            <div
              className={`inline-flex items-center justify-center w-16 h-16 ${config.color} bg-slate-800/50 rounded-full border border-slate-700/50`}
            >
              <IconComponent className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className={`text-4xl font-bold ${config.color}`}>
                {typeof error === "number" ? error : ""}
              </h1>
              <h2 className="text-xl font-semibold text-white">{config.title}</h2>
            </div>
          </div>

          {/* Error message */}
          <p className="text-slate-300 text-sm leading-relaxed">{config.message}</p>

          {/* Optional retry button area */}
          <div className="pt-2">
            <div className="flex justify-center space-x-1 opacity-60">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 ${config.color} rounded-full animate-pulse`}
                  style={{
                    animationDelay: `${i * 0.3}s`,
                    animationDuration: "2s",
                  }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HError;
