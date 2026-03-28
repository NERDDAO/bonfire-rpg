import { Wallet, LogOut, Loader2 } from "lucide-react";
import { usePlayerStore } from "@/stores/playerStore";

const WalletButton = () => {
  const { wallet, isConnecting, error, connectWallet, disconnectWallet } = usePlayerStore();

  if (wallet) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-mono">
          {wallet.slice(0, 6)}...{wallet.slice(-4)}
        </span>
        <button
          type="button"
          onClick={disconnectWallet}
          className="text-gray-500 hover:text-gray-300 p-1"
          title="Disconnect"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={connectWallet}
        disabled={isConnecting}
        className="bg-amber-800 hover:bg-amber-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wallet className="w-4 h-4" />
        )}
        Connect
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
};

export default WalletButton;
