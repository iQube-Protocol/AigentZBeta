import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WalletButton Component
 * Pre-built wallet connection button
 */
import { useWallet } from './useWallet';
export function WalletButton({ className = '', connectedClassName = '', connectingClassName = '', connectText = 'Connect Wallet', connectingText = 'Connecting...', onConnect, onDisconnect, showBalance = false, showAddress = true, addressFormat = 'short', }) {
    const { account, isConnecting, isConnected, error, connect, disconnect } = useWallet();
    const handleClick = async () => {
        if (isConnected) {
            disconnect();
            onDisconnect?.();
        }
        else {
            await connect();
            onConnect?.();
        }
    };
    const formatAddress = (address) => {
        if (addressFormat === 'full')
            return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };
    const formatBalance = (balance) => {
        const num = parseFloat(balance);
        return num.toFixed(4);
    };
    if (isConnecting) {
        return (_jsx("button", { className: `${className} ${connectingClassName}`, disabled: true, children: connectingText }));
    }
    if (isConnected && account) {
        return (_jsxs("button", { className: `${className} ${connectedClassName}`, onClick: handleClick, children: [showBalance && account.balance && (_jsxs("span", { children: [formatBalance(account.balance), " ETH"] })), showAddress && (_jsx("span", { children: formatAddress(account.address) }))] }));
    }
    return (_jsx("button", { className: className, onClick: handleClick, children: connectText }));
}
