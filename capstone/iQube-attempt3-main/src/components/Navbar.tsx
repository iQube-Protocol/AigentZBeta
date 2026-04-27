import { useWallet } from "../context/WalletContext";
import { NavLink } from "react-router-dom";

const NAV_LINKS = [
  { to: "/", label: "Mint" },
  { to: "/my-iqubes", label: "My iQubes" },
  { to: "/decrypt", label: "Decrypt" },
  { to: "/transfer", label: "Transfer" },
  { to: "/registry", label: "Registry" },
  { to: "/dvn-test", label: "DVN Test" },
  { to: "/agent-chat", label: "Agent Chat" },
];

export default function Navbar() {
  const { address, isConnecting, connect, disconnect } = useWallet();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-8">
      <div className="flex items-center gap-10">
        <span className="text-xl font-bold text-slate-900 tracking-tight">iQube</span>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
      <div>
        {address ? (
          <div className="flex items-center gap-4">
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 font-mono">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            <button
              onClick={disconnect}
              className="h-10 px-4 rounded-lg text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="h-10 px-5 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isConnecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
      </div>
    </nav>
  );
}
