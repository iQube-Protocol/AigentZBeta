/**
 * WalletButton Component
 * Pre-built wallet connection button
 */
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
export declare function WalletButton({ className, connectedClassName, connectingClassName, connectText, connectingText, onConnect, onDisconnect, showBalance, showAddress, addressFormat, }: WalletButtonProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=WalletButton.d.ts.map