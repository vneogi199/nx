import { workspaceRoot } from '@nx/devkit';
import { mergeConfig } from 'metro-config';
import type { MetroConfig } from 'metro-config';
import { existsSync } from 'fs-extra';

import { getResolveRequest } from './metro-resolver';

interface WithNxOptions {
  debug?: boolean;
  extensions?: string[];
  watchFolders?: string[];
}

export async function withNxMetro(
  userConfig: MetroConfig,
  opts: WithNxOptions = {}
) {
  const extensions = ['', 'ts', 'tsx', 'js', 'jsx', 'json'];
  if (opts.debug) process.env.NX_REACT_NATIVE_DEBUG = 'true';
  if (opts.extensions) extensions.push(...opts.extensions);

  let watchFolders = [workspaceRoot];
  if (opts.watchFolders?.length) {
    watchFolders = watchFolders.concat(opts.watchFolders);
  }

  watchFolders = watchFolders.filter((folder) => existsSync(folder));

  const nxConfig: MetroConfig = {
    resolver: {
      resolveRequest: getResolveRequest(extensions),
    },
    watchFolders,
  };

  return mergeConfig(userConfig, nxConfig);
}
