/**
 * WalletButton Component
 * Pre-built wallet connection button
 */

import { useWallet } from './useWallet';

interface WalletButtonProps {
  className?: string;
  connectedClassName?: string;
  connectingClassName?: string;
  connectText?: string;
  connectingText?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  showBalance?: boolean;
  showAddress?: boolean;
  addressFormat?: 'short' | 'full';
}

export function WalletButton({
  className = '',
  connectedClassName = '',
  connectingClassName = '',
  connectText = 'Connect Wallet',
  connectingText = 'Connecting...',
  onConnect,
  onDisconnect,
  showBalance = false,
  showAddress = true,
  addressFormat = 'short',
}: WalletButtonProps) {
  const { account, isConnecting, isConnected, error, connect, disconnect } = useWallet();

  const handleClick = async () => {
    if (isConnected) {
      disconnect();
      onDisconnect?.();
    } else {
      await connect();
      onConnect?.();
    }
  };

  const formatAddress = (address: string) => {
    if (addressFormat === 'full') return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return num.toFixed(4);
  };

  if (isConnecting) {
    return (
      <button
        className={`${className} ${connectingClassName}`}
        disabled
      >
        {connectingText}
      </button>
    );
  }

  if (isConnected && account) {
    return (
      <button
        className={`${className} ${connectedClassName}`}
        onClick={handleClick}
      >
        {showBalance && account.balance && (
          <span>{formatBalance(account.balance)} ETH</span>
        )}
        {showAddress && (
          <span>{formatAddress(account.address)}</span>
        )}
      </button>
    );
  }

  return (
    <button
      className={className}
      onClick={handleClick}
    >
      {connectText}
    </button>
  );
}
