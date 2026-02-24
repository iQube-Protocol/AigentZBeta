/**
 * MoneyPenny Page
 * 
 * Main entry point for the Aigent MoneyPenny cartridge
 * Renders the complete MoneyPenny trading interface
 */

import MoneyPennyCartridge from "./components/MoneyPennyCartridge";

export default function MoneyPennyPage() {
  return (
    <div className="h-full w-full">
      <MoneyPennyCartridge />
    </div>
  );
}
