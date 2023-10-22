import {
  cleanupProject,
  newProject,
  runCLI,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';

expect.addSnapshotSerializer({
  serialize(str: string) {
    return (
      str
        // Remove all output unique to specific projects to ensure deterministic snapshots
        .replaceAll(`/private/${tmpProjPath()}`, '')
        .replaceAll(tmpProjPath(), '')
        .replaceAll('/private/', '')
        .replaceAll(/public-pkg-\d+/g, '{public-project-name}')
        .replaceAll(/private-pkg\d+/g, '{private-project-name}')
        .replaceAll(/\s\/{private-project-name}/g, ' {private-project-name}')
        .replaceAll(
          /integrity:\s*.*/g,
          'integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
        )
        .replaceAll(/\b[0-9a-f]{40}\b/g, '{SHASUM}')
        .replaceAll(/\d*B  index\.js/g, 'XXB  index.js')
        .replaceAll(/\d*B  project\.json/g, 'XXB  project.json')
        .replaceAll(/\d*B package\.json/g, 'XXXB package.json')
        .replaceAll(/size:\s*\d*\s?B/g, 'size: XXXB')
        .replaceAll(/\d*\.\d*\s?kB/g, 'XXX.XXX kb')
        // We trim each line to reduce the chances of snapshot flakiness
        .split('\n')
        .map((r) => r.trim())
        .join('\n')
    );
  },
  test(val: string) {
    return val != null && typeof val === 'string';
  },
});

describe('nx release - private JS packages', () => {
  let publicPkg1: string;
  let publicPkg2: string;
  let privatePkg: string;

  beforeAll(() => {
    newProject({
      unsetProjectNameAndRootFormat: false,
    });

    publicPkg1 = uniq('public-pkg-1');
    runCLI(`generate @nx/workspace:npm-package ${publicPkg1}`);

    publicPkg2 = uniq('public-pkg-2');
    runCLI(`generate @nx/workspace:npm-package ${publicPkg2}`);

    privatePkg = uniq('private-pkg');
    runCLI(`generate @nx/workspace:npm-package ${privatePkg}`);
    updateJson(`${privatePkg}/package.json`, (json) => {
      json.private = true;
      return json;
    });

    /**
     * Update public-pkg2 to depend on private-pkg.
     *
     * At the time of writing this is not something we protect the user against,
     * so we expect this to not cause any issues, and public-pkg2 will be published.
     *
     * TODO: these tests will need to be updated when we add support for protecting against this
     */
    updateJson(`${publicPkg2}/package.json`, (json) => {
      json.dependencies ??= {};
      json.dependencies[`@proj/${privatePkg}`] = '0.0.0';
      return json;
    });
  });
  afterAll(() => cleanupProject());

  it('should skip private packages and log a warning', async () => {
    runCLI(`release version 999.9.9`);

    // This is the verdaccio instance that the e2e tests themselves are working from
    const e2eRegistryUrl = execSync('npm config get registry')
      .toString()
      .trim();

    // Thanks to the custom serializer above, the publish output should be deterministic
    const publicPkg1PublishOutput = runCLI(`release publish -p ${publicPkg1}`);
    expect(publicPkg1PublishOutput).toMatchInlineSnapshot(`

      >  NX   Your filter "{public-project-name}" matched the following projects:

      - {public-project-name}


      >  NX   Running target nx-release-publish for project {public-project-name}:

      - {public-project-name}



      > nx run {public-project-name}:nx-release-publish


      📦  @proj/{public-project-name}@999.9.9
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{public-project-name}
      version:       999.9.9
      filename:      proj-{public-project-name}-999.9.9.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"



      >  NX   Successfully ran target nx-release-publish for project {public-project-name}



    `);

    // This will include the private package publish output as it is a dependency
    const publicPkg2PublishOutput = runCLI(`release publish -p ${publicPkg2}`);
    expect(publicPkg2PublishOutput).toMatchInlineSnapshot(`

      >  NX   Your filter "{public-project-name}" matched the following projects:

      - {public-project-name}


      >  NX   Running target nx-release-publish for project {public-project-name} and 1 task it depends on:

      - {public-project-name}



      > nx run {private-project-name}:nx-release-publish

      Skipping package "@proj/{private-project-name}" from project "{private-project-name}", because it has \`"private": true\` in {private-project-name}/package.json

      > nx run {public-project-name}:nx-release-publish


      📦  @proj/{public-project-name}@999.9.9
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{public-project-name}
      version:       999.9.9
      filename:      proj-{public-project-name}-999.9.9.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"



      >  NX   Successfully ran target nx-release-publish for project {public-project-name} and 1 task it depends on



    `);

    // The two public packages should have been published
    expect(
      execSync(`npm view @proj/${publicPkg1} version`).toString().trim()
    ).toEqual('999.9.9');
    expect(
      execSync(`npm view @proj/${publicPkg2} version`).toString().trim()
    ).toEqual('999.9.9');

    // The private package should have never been published
    expect(() => execSync(`npm view @proj/${privatePkg} version`)).toThrowError(
      /npm ERR! code E404/
    );
  }, 500000);
});
