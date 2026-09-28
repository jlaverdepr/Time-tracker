const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm workspaces symlink shared packages (e.g. @workspace/api-client-react)
// into node_modules instead of copying them — Metro needs to know about the
// monorepo root and follow symlinks to find them.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
// NOT disableHierarchicalLookup: pnpm nests each package's own dependencies
// (e.g. expo-modules-core inside expo's own node_modules) — Metro needs to
// walk up from the importing file's real (symlink-resolved) location to
// find those, same as Node's own resolution algorithm.

module.exports = config;
