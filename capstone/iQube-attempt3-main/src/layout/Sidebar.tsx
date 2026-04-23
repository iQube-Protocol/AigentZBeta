import { Outlet, NavLink } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'
import WalletConnect from '../components/WalletConnect'

const routes = [
  { name: 'Create iQube', path: '/app/create' },
  { name: 'Content Qube', path: '/app/contentqube' },
  { name: 'Transfer',     path: '/app/transfer' },
  { name: 'Decrypt',      path: '/app/decrypt' },
  { name: 'Cross Chain',  path: '/app/crosschain' },
]

export default function Sidebar() {
  const { address } = useWallet()

  return (
    <div className="flex min-h-screen bg-slate-900">
      {/* Sidebar */}
      <div className="fixed top-0 left-0 w-64 h-full bg-slate-950 border-r border-white/10 flex flex-col p-5">
        <p className="text-white font-bold text-lg mb-8">iQube</p>

        <nav className="flex-1 space-y-1">
          {routes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              {route.name}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/10">
          {address ? (
            <p className="text-xs text-slate-500 truncate" title={address}>
              {address.slice(0, 6)}…{address.slice(-4)}
            </p>
          ) : null}
          <div className="mt-2">
            <WalletConnect />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="ml-64 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
