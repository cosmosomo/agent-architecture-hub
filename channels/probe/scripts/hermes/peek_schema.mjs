// Peek ACP schema definitions needed for hermes L1a probes.
import fs from "node:fs";
import path from "node:path";

const sdk = path.join(process.env.APPDATA, "npm", "node_modules", "acpx", "node_modules", "@agentclientprotocol", "sdk");
const j = JSON.parse(fs.readFileSync(path.join(sdk, "schema", "schema.json"), "utf8"));
const defs = j.$defs || {};
const pat = process.argv[2] || "NewSessionRequest|SetSessionConfigOptionRequest|ForkSessionRequest|LoadSessionRequest|SessionNotification";
for (const k of Object.keys(defs).filter((k) => new RegExp(pat).test(k))) {
  console.log("==", k);
  console.log(JSON.stringify(defs[k]).slice(0, 900));
}
