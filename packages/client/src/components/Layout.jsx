import { Flame } from "lucide-react";
import { useLocation } from "wouter";

const Layout = ({ children }) => {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-amber-900/30 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Flame className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold text-amber-100">Bonfire RPG</h1>
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
};

export default Layout;
