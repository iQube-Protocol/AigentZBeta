import { describe, expect, it } from 'vitest';
import { AGENT_MANIFEST_URI, agentDiscoveryManifest } from '../services/threshold/agentManifest';
import { listResources, readResource, type GatewayContext } from '../services/threshold/gateway';

const bareCtx: GatewayContext = { origin: 'http://localhost:3000', gatewayUrl: 'http://localhost:3000/api/threshold/mcp' };

describe('Threshold canonical agent discovery manifest', () => {
  it('is the first listed resource and is public without an authenticated session', async () => {
    expect(listResources()[0].uri).toBe(AGENT_MANIFEST_URI);
    const result = await readResource(AGENT_MANIFEST_URI, bareCtx);
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.contents[0].text)).toEqual(agentDiscoveryManifest());
  });

  it('declares source precedence and the required constitutional distinctions', () => {
    const manifest = agentDiscoveryManifest();
    expect(manifest.sourcePrecedence[0]).toBe('ratified-canon');
    expect(manifest.sourcePrecedence.at(-1)).toBe('historical-or-deprecated');
    expect(manifest.distinctions).toContain('Personhood != Identity != Persona');
    expect(manifest.distinctions).toContain('Authorization != Payload disclosure');
    expect(manifest.distinctions).toContain('Registry existence != Resource readability');
    expect(manifest.distinctions).toContain('Implemented != MCP-exposed');
  });

  it('routes every component to at least one source and MCP route without treating implementation absence as non-existence', () => {
    for (const component of agentDiscoveryManifest().components) {
      expect(component.canonicalSources.length).toBeGreaterThan(0);
      expect(component.mcpRoutes.length).toBeGreaterThan(0);
      expect(component.accessRequirements.length).toBeGreaterThan(0);
    }
    expect(agentDiscoveryManifest().components.find((entry) => entry.id === 'agentiq-nanos')?.mcpExposure).toBe('implemented-not-exposed');
  });
});
