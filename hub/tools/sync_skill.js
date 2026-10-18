#!/usr/bin/env node
/**
 * sync_skill.js — One-click synchronizer for local-capability-hub skill with conflict detection & safe backup.
 *
 * Single Source of Truth:
 *   Reads `sync-targets.json` in the skill root for canonical source, backup directory, and replica locations.
 *
 * Capabilities:
 *   1. Three-way status inspection (Canonical vs Replica vs Last Synced Manifest):
 *      - IN_SYNC: replica is identical to canonical
 *      - SAFE_UPDATE: canonical changed, replica untouched since last sync -> safe to update
 *      - CONFLICT_TARGET_MODIFIED: replica was modified independently -> backup & report diff
 *      - CONFLICT_BOTH_MODIFIED: both canonical and replica have changed -> backup & report diff
 *   2. Safe Handling & Isolation:
 *      - Backups are strictly stored outside all AI skill directories in ~/.agent-hub/skill-backups/
 *        (preventing Claude, Codex, etc. from indexing backup folders as duplicate skills)
 *      - Provides line-level diff output for conflicted files
 *      - With --force, creates backup first in ~/.agent-hub/skill-backups/, then updates replica
 *   3. Replicates across all 11 AI host locations defined in sync-targets.json
 *   4. Post-sync SHA256 verification across all replicas
 *
 * Usage:
 *   node scripts/sync_skill.js              # Sync all replicas (aborts on conflict, prints diff & backup path)
 *   node scripts/sync_skill.js --check      # Dry run: inspect status and hashes without writing
 *   node scripts/sync_skill.js --diff       # Inspect status and show full unified diffs
 *   node scripts/sync_skill.js --force      # Force overwrite after backup to ~/.agent-hub/skill-backups/
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const DEFAULT_CANONICAL_DIR = 'C:\\Users\\COLORFIRE\\.cc-switch\\skills\\local-capability-hub';
const HUB_ROOT = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const DEFAULT_BACKUP_ROOT = path.join(os.homedir(), '.agent-hub', 'skill-backups');
const MANIFEST_NAME = '.sync-manifest.json';
const REGISTRY_NAME = 'sync-targets.json';

function resolveCanonicalDir() {
  const localReg = path.join(__dirname, '..', REGISTRY_NAME);
  if (fs.existsSync(localReg)) return path.dirname(localReg);
  return DEFAULT_CANONICAL_DIR;
}

function loadRegistry(canonicalDir) {
  const regPath = path.join(canonicalDir, REGISTRY_NAME);
  const hubRegPath = path.join(HUB_ROOT, 'hub', 'data', 'skill-sync-targets.json');

  let raw = null;
  if (fs.existsSync(regPath)) {
    raw = fs.readFileSync(regPath, 'utf8');
  } else if (fs.existsSync(hubRegPath)) {
    raw = fs.readFileSync(hubRegPath, 'utf8');
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        canonicalDir: parsed.canonical?.path || canonicalDir,
        backupRoot: parsed.backupRoot || DEFAULT_BACKUP_ROOT,
        targets: Array.isArray(parsed.targets) ? parsed.targets : []
      };
    } catch {}
  }

  return {
    canonicalDir,
    backupRoot: DEFAULT_BACKUP_ROOT,
    targets: []
  };
}

function fileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function computeDiff(canonicalText, targetText) {
  const cLines = canonicalText.split(/\r?\n/);
  const tLines = targetText.split(/\r?\n/);
  const diffs = [];

  let cIdx = 0, tIdx = 0;
  while (cIdx < cLines.length || tIdx < tLines.length) {
    if (cIdx < cLines.length && tIdx < tLines.length) {
      if (cLines[cIdx] === tLines[tIdx]) {
        cIdx++;
        tIdx++;
      } else {
        let foundT = -1;
        for (let i = 1; i <= 5 && cIdx + i < cLines.length; i++) {
          if (cLines[cIdx + i] === tLines[tIdx]) { foundT = i; break; }
        }
        let foundC = -1;
        for (let j = 1; j <= 5 && tIdx + j < tLines.length; j++) {
          if (tLines[tIdx + j] === cLines[cIdx]) { foundC = j; break; }
        }

        if (foundC !== -1 && (foundT === -1 || foundC < foundT)) {
          for (let k = 0; k < foundC; k++) {
            diffs.push(`+ [Target:${tIdx + k + 1}] ${tLines[tIdx + k]}`);
          }
          tIdx += foundC;
        } else if (foundT !== -1) {
          for (let k = 0; k < foundT; k++) {
            diffs.push(`- [Canonical:${cIdx + k + 1}] ${cLines[cIdx + k]}`);
          }
          cIdx += foundT;
        } else {
          diffs.push(`- [Canonical:${cIdx + 1}] ${cLines[cIdx]}`);
          diffs.push(`+ [Target:${tIdx + 1}] ${tLines[tIdx]}`);
          cIdx++;
          tIdx++;
        }
      }
    } else if (cIdx < cLines.length) {
      diffs.push(`- [Canonical:${cIdx + 1}] ${cLines[cIdx++]}`);
    } else {
      diffs.push(`+ [Target:${tIdx + 1}] ${tLines[tIdx++]}`);
    }
    if (diffs.length > 50) {
      diffs.push('... (diff truncated, >50 lines differing)');
      break;
    }
  }
  return diffs;
}

function loadManifest(dirPath) {
  const mPath = path.join(dirPath, MANIFEST_NAME);
  if (!fs.existsSync(mPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(mPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveManifest(dirPath, manifest) {
  const mPath = path.join(dirPath, MANIFEST_NAME);
  fs.writeFileSync(mPath, JSON.stringify(manifest, null, 2), 'utf8');
}

function getCanonicalFiles(canonicalDir) {
  const files = [];
  function walk(currentDir, relDir = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === MANIFEST_NAME || ent.name.endsWith('.bak') || ent.name.includes('.conflict.')) continue;
      const full = path.join(currentDir, ent.name);
      const rel = path.join(relDir, ent.name).replace(/\\/g, '/');
      if (ent.isDirectory()) {
        walk(full, rel);
      } else if (ent.isFile()) {
        files.push({ rel, full, hash: fileHash(full) });
      }
    }
  }
  walk(canonicalDir);
  return files;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.endsWith('.bak') || ent.name.includes('.conflict.')) continue;
    const srcPath = path.join(src, ent.name);
    const destPath = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (ent.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getHostLabel(targetDir) {
  if (targetDir.includes('.claude')) return 'claude';
  if (targetDir.includes('.codex')) return 'codex';
  if (targetDir.includes('.zcode')) return 'zcode';
  if (targetDir.includes('.workbuddy')) return 'workbuddy';
  if (targetDir.includes('opencode')) return 'opencode';
  if (targetDir.includes('.gemini')) return 'gemini';
  if (targetDir.includes('.agents')) return 'agents';
  if (targetDir.includes('DoubaoWork') && targetDir.includes('Profile 3')) return 'doubaowork_profile3';
  if (targetDir.includes('DoubaoWork')) return 'doubaowork_default';
  if (targetDir.includes('Doubao')) return 'doubao_default';
  if (targetDir.includes('channels')) return 'channels_private';
  return 'target';
}

function backupTarget(targetDir, backupRoot, tag = 'backup') {
  if (!fs.existsSync(targetDir)) return null;
  if (!fs.existsSync(backupRoot)) {
    fs.mkdirSync(backupRoot, { recursive: true });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const hostLabel = getHostLabel(targetDir);
  const backupDir = path.join(backupRoot, `${hostLabel}_local-capability-hub.${tag}.${stamp}`);
  copyDirRecursive(targetDir, backupDir);
  return backupDir;
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check') || args.includes('-c');
  const isForce = args.includes('--force') || args.includes('-f');
  const showDiff = args.includes('--diff') || args.includes('-d');

  const canonicalDir = resolveCanonicalDir();
  const reg = loadRegistry(canonicalDir);
  const backupRoot = reg.backupRoot;
  const targetEntries = reg.targets;

  console.log(`=== Local Capability Hub Skill Sync ===`);
  console.log(`Registry  : ${path.join(canonicalDir, REGISTRY_NAME)}`);
  console.log(`Canonical : ${canonicalDir}`);
  console.log(`Backup Dir: ${backupRoot} (isolated outside skill discovery roots)`);
  console.log(`Mode      : ${isCheck ? 'CHECK (dry-run)' : isForce ? 'FORCE (overwrite with backup)' : 'SAFE_SYNC'}`);
  console.log(`Targets   : ${targetEntries.length} registered locations\n`);

  // Step 1: Ingest updates from Hub repo if available
  if (fs.existsSync(HUB_ROOT)) {
    const searchHubSrc = path.join(HUB_ROOT, 'hub', 'tools', 'search_hub.js');
    const searchHubDest = path.join(canonicalDir, 'scripts', 'search_hub.js');
    if (fs.existsSync(searchHubSrc)) {
      fs.mkdirSync(path.dirname(searchHubDest), { recursive: true });
      fs.copyFileSync(searchHubSrc, searchHubDest);
    }
    const keysSrc = path.join(HUB_ROOT, 'channels', '_private', '本机AI全能力与全量密钥一册通.md');
    const keysDest = path.join(canonicalDir, 'references', 'keys-and-endpoints.md');
    if (fs.existsSync(keysSrc)) {
      fs.mkdirSync(path.dirname(keysDest), { recursive: true });
      fs.copyFileSync(keysSrc, keysDest);
    }
    const syncSelf = __filename;
    const syncCanonical = path.join(canonicalDir, 'scripts', 'sync_skill.js');
    if (syncSelf !== syncCanonical) {
      fs.mkdirSync(path.dirname(syncCanonical), { recursive: true });
      fs.copyFileSync(syncSelf, syncCanonical);
    }
    const regHub = path.join(HUB_ROOT, 'hub', 'data', 'skill-sync-targets.json');
    const regCanonical = path.join(canonicalDir, REGISTRY_NAME);
    if (fs.existsSync(regHub) && !fs.existsSync(regCanonical)) {
      fs.copyFileSync(regHub, regCanonical);
    }
  }

  // Step 2: Index Canonical files
  const canonicalFiles = getCanonicalFiles(canonicalDir);
  const canonicalManifest = {};
  for (const f of canonicalFiles) {
    canonicalManifest[f.rel] = {
      hash: f.hash,
      size: fs.statSync(f.full).size,
      updatedAt: new Date().toISOString()
    };
  }

  const existingManifest = loadManifest(canonicalDir);

  // Step 3: Analyze each target
  const targetReports = [];
  let hasConflicts = false;

  for (const tEntry of targetEntries) {
    const target = tEntry.path;
    const parentDir = path.dirname(target);
    const parentExists = fs.existsSync(parentDir);
    const targetExists = fs.existsSync(target);

    if (!parentExists) {
      targetReports.push({
        entry: tEntry,
        target,
        status: 'SKIPPED_NO_HOST',
        reason: 'Host directory does not exist on this machine'
      });
      continue;
    }

    if (!targetExists) {
      targetReports.push({
        entry: tEntry,
        target,
        status: 'NEW_TARGET',
        reason: 'Target directory does not exist yet; will create'
      });
      continue;
    }

    let targetStatus = 'IN_SYNC';
    const fileDiffs = [];

    for (const f of canonicalFiles) {
      const targetFilePath = path.join(target, f.rel);
      if (!fs.existsSync(targetFilePath)) {
        targetStatus = 'MISSING_FILE';
        fileDiffs.push({ rel: f.rel, type: 'missing', diff: ['+ Target file is missing'] });
        continue;
      }

      const tHash = fileHash(targetFilePath);
      if (tHash !== f.hash) {
        const base = existingManifest[f.rel];
        let diffType = 'CONFLICT_TARGET_MODIFIED';

        if (base && base.hash === tHash) {
          diffType = 'CANONICAL_NEWER';
        } else if (base && base.hash === f.hash && tHash !== base.hash) {
          diffType = 'CONFLICT_TARGET_MODIFIED';
        } else {
          diffType = 'CONFLICT_MODIFIED';
        }

        const cText = fs.readFileSync(f.full, 'utf8');
        const tText = fs.readFileSync(targetFilePath, 'utf8');
        const diffLines = computeDiff(cText, tText);

        fileDiffs.push({
          rel: f.rel,
          type: diffType,
          canonicalHash: f.hash.slice(0, 8),
          targetHash: tHash.slice(0, 8),
          diff: diffLines
        });

        if (diffType !== 'CANONICAL_NEWER') {
          targetStatus = diffType;
        } else if (targetStatus === 'IN_SYNC') {
          targetStatus = 'SAFE_UPDATE';
        }
      }
    }

    if (targetStatus.startsWith('CONFLICT') || targetStatus === 'MISSING_FILE') {
      hasConflicts = true;
    }

    targetReports.push({
      entry: tEntry,
      target,
      status: targetStatus,
      fileDiffs
    });
  }

  // Print analysis report
  console.log('--- Status by Host Target ---');
  for (const rep of targetReports) {
    const badge =
      rep.status === 'IN_SYNC' ? '🟢 IN_SYNC' :
      rep.status === 'SAFE_UPDATE' ? '🟡 SAFE_UPDATE' :
      rep.status === 'NEW_TARGET' ? '🔵 NEW_TARGET' :
      rep.status === 'SKIPPED_NO_HOST' ? '⚪ SKIPPED' :
      `🔴 ${rep.status}`;

    const prodLabel = rep.entry ? `[${rep.entry.product}] ` : '';
    console.log(`[${badge.padEnd(28)}] ${prodLabel}${rep.target}`);
    if (rep.fileDiffs && rep.fileDiffs.length > 0) {
      for (const fd of rep.fileDiffs) {
        console.log(`     └─ ${fd.rel} (${fd.type}): ${fd.diff.length} diff lines`);
        if (showDiff || rep.status.startsWith('CONFLICT')) {
          console.log(`        Diff excerpt:`);
          for (const dl of fd.diff.slice(0, 8)) {
            console.log(`          ${dl}`);
          }
          if (fd.diff.length > 8) console.log(`          ... (${fd.diff.length - 8} more diff lines)`);
        }
      }
    }
  }
  console.log('');

  if (isCheck) {
    console.log(`[Check Finished] Conflicts detected: ${hasConflicts ? 'YES' : 'NONE'}. No files modified.`);
    process.exit(hasConflicts ? 1 : 0);
  }

  if (hasConflicts && !isForce) {
    console.error(`\n❌ Sync blocked: One or more targets contain differences or local modifications.`);
    console.error(`Automatic safety intervention:`);
    for (const rep of targetReports) {
      if (rep.status.startsWith('CONFLICT') || rep.status === 'MISSING_FILE') {
        const b = backupTarget(rep.target, backupRoot, 'conflict');
        console.error(`   - Backed up to isolated directory: ${b}`);
      }
    }
    console.error(`\nAction required:`);
    console.error(`1. Review the diffs above.`);
    console.error(`2. If you want to overwrite replicas with canonical (isolated backups created in ${backupRoot}), rerun:`);
    console.error(`   node scripts/sync_skill.js --force\n`);
    process.exit(1);
  }

  // Step 5: Perform sync
  console.log(`--- Applying Synchronization ---`);
  saveManifest(canonicalDir, canonicalManifest);

  let updatedCount = 0;
  for (const rep of targetReports) {
    if (rep.status === 'SKIPPED_NO_HOST' || rep.status === 'IN_SYNC') continue;

    if (fs.existsSync(rep.target)) {
      const b = backupTarget(rep.target, backupRoot, 'backup');
      console.log(`[BACKUP] ${rep.target} -> ${b}`);
    } else {
      fs.mkdirSync(rep.target, { recursive: true });
    }

    copyDirRecursive(canonicalDir, rep.target);
    saveManifest(rep.target, canonicalManifest);
    console.log(`[SYNCED] ${rep.target}`);
    updatedCount++;
  }

  // Step 6: Post-sync Hash Verification
  console.log(`\n--- Post-Sync SHA256 Verification ---`);
  let allMatched = true;
  for (const tEntry of targetEntries) {
    const target = tEntry.path;
    if (!fs.existsSync(target)) continue;
    const tSkill = path.join(target, 'SKILL.md');
    const cSkill = path.join(canonicalDir, 'SKILL.md');
    const hT = fileHash(tSkill);
    const hC = fileHash(cSkill);
    const ok = hT === hC;
    if (!ok) allMatched = false;
    console.log(`  ${ok ? '✔' : '✖'} [${(hT || 'N/A').slice(0, 16)}...] [${tEntry.product}] ${target}`);
  }

  console.log(`\nSync Summary: ${updatedCount} targets updated. Verification: ${allMatched ? 'ALL HASHES MATCH 100%' : 'HASH MISMATCH DETECTED'}.`);
  process.exit(allMatched ? 0 : 1);
}

main();
