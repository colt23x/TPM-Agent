import { Config } from "./config";
import { Entity } from "./model";
import { McpHost } from "./mcp/host";
import { getAdapter } from "./sources";
import { correlate } from "./intelligence/correlate";
import { detectRisks } from "./intelligence/risk";
import { Snapshot } from "./store";

/**
 * The ingest pipeline: connect to every configured MCP server, pull and
 * normalize its data, then run the deterministic intelligence passes
 * (correlate, detect risks) over the unified model.
 */
export async function sync(config: Config, now = new Date()): Promise<Snapshot> {
  const host = new McpHost();
  const entities: Entity[] = [];
  const servers = Object.entries(config.servers);
  let failures = 0;
  try {
    for (const [name, serverCfg] of servers) {
      try {
        const adapter = getAdapter(serverCfg.adapter);
        process.stderr.write(`Connecting to "${name}" (${serverCfg.adapter} adapter)...\n`);
        await host.connect(name, serverCfg);
        const fetched = await adapter.fetch(host, name, serverCfg);
        process.stderr.write(`  ${fetched.length} entities from ${name}\n`);
        entities.push(...fetched);
      } catch (err) {
        failures++;
        process.stderr.write(
          `  Failed to sync "${name}": ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    }
  } finally {
    await host.closeAll();
  }
  if (servers.length > 0 && failures === servers.length) {
    throw new Error(`All ${failures} configured server(s) failed to sync.`);
  }
  return enrich(entities, config, now);
}

/** Correlation + risk passes; shared by real sync and demo mode. */
export function enrich(entities: Entity[], config: Config, now = new Date()): Snapshot {
  const workstreams = correlate(entities);
  detectRisks(entities, config, now);
  return { syncedAt: now.toISOString(), entities, workstreams };
}
