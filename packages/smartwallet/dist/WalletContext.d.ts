/**
 * WalletContext
 * Provides wallet state and actions to the application
 * Supports Q¢ (QriptoCENT), QCT, QOYN, KNYT tokens
 */
import { ReactNode } from 'react';
import type { WalletState, WalletActions, WalletConfig } from './types';
export interface WalletContextValue extends WalletState, WalletActions {
}
export declare const WalletContext: import("react").Context<WalletContextValue | null>;
interface WalletProviderProps {
    children: ReactNode;
    config?: WalletConfig;
}
export declare function WalletProvider({ children, config }: WalletProviderProps): import("react/jsx-runtime").JSX.Element;
declare global {
    interface Window {
        ethereum?: any;
    }
}
export {};
//# sourceMappingURL=WalletContext.d.ts.map