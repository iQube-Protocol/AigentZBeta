/**
 * useMoneyPennyClient Hook
 * 
 * Provides access to the MoneyPenny client instance
 * Handles initialization and configuration
 */

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AgentiQConfig } from "@/types/agentiq";
import { MoneyPennyClient } from "../components/MoneyPennyClient";

export function useMoneyPennyClient() {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const config: AgentiQConfig = {
      agentClass: 'moneypenny',
      tenantId: 'qripto-hft',
      enableA2A: true,
      apiBaseUrl: process.env.NEXT_PUBLIC_AIGENT_API_URL || 'https://dev-beta.aigentz.me',
      quotesUrl: process.env.NEXT_PUBLIC_QUOTES_API_URL || 'https://quotes.qripto.io',
    };

    try {
      return new MoneyPennyClient(config, queryClient);
    } catch (error) {
      console.error('Failed to initialize MoneyPenny client:', error);
      return null;
    }
  }, [queryClient]);
}
