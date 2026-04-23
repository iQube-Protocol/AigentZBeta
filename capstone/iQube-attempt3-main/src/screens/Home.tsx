import { Link } from 'react-router-dom'
import WalletConnect from '../components/WalletConnect'
import { useWallet } from '../context/WalletContext'

export default function Home() {
  const { address } = useWallet()

  return (
    <div className="center-container bg-[#fff] flex flex-col">
      <h2 className="text-[84px]">WELCOME</h2>
      <div>
        <Link to="/register">META/AMOY</Link>
      </div>
      <p className="my-[60px] text-[20px]">OR</p>
      <WalletConnect />
      {address && (
        <div className="mt-[20px]">
          <Link to="/app">Open App</Link>
        </div>
      )}
    </div>
  )
}
