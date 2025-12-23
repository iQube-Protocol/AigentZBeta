/**
 * @agentiq/avatar-host
 * Global persistent metaAvatar interface for agent interactions
 *
 * @example
 * ```tsx
 * import { AvatarProvider, AvatarHost, useAvatar } from '@agentiq/avatar-host';
 *
 * function App() {
 *   return (
 *     <AvatarProvider
 *       context={{
 *         franchiseId: 'theqriptopian',
 *         tenantId: 'main',
 *       }}
 *     >
 *       <YourApp />
 *       <AvatarHost position="bottom-right" defaultAgent="copilot" />
 *     </AvatarProvider>
 *   );
 * }
 *
 * function SomeComponent() {
 *   const { sendMessage, toggle } = useAvatar();
 *
 *   return (
 *     <button onClick={() => {
 *       sendMessage('Analyze this content');
 *       toggle();
 *     }}>
 *       Ask Agent
 *     </button>
 *   );
 * }
 * ```
 */
export { AvatarProvider, useAvatar } from './AvatarContext';
export { AvatarHost } from './AvatarHost';
export type { AvatarPosition, AvatarState, AgentConfig, AvatarMessage, AvatarContext, AvatarHostProps, AvatarContextValue, } from './types';
//# sourceMappingURL=index.d.ts.map