import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { relative } from 'path';
import { dirSync, fileSync } from 'tmp';
import runCommands, {
  interpolateArgsIntoCommand,
  LARGE_BUFFER,
} from './run-commands.impl';
import { env } from 'npm-run-path';

const {
  devDependencies: { nx: version },
} = require('package.json');

function normalize(p: string) {
  return p.startsWith('/private') ? p.substring(8) : p;
}

function readFile(f: string) {
  return readFileSync(f).toString().replace(/\s/g, '');
}

describe('Run Commands', () => {
  const context = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should interpolate provided --args', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      {
        command: `echo {args.key} >> ${f}`,
        args: '--key=123',
        __unparsed__: [],
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it('should interpolate all unknown args as if they were --args', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      {
        command: `echo {args.key} >> ${f}`,
        key: 123,
        __unparsed__: [],
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it.each([
    [`--key=123`, `args.key`, `123`],
    [`--key="123.10"`, `args.key`, `123.10`],
    [`--nested.key="123.10"`, `args.nested.key`, `123.10`],
  ])(
    'should interpolate %s into %s as %s',
    async (cmdLineArg, argKey, expected) => {
      const f = fileSync().name;
      const result = await runCommands(
        {
          command: `echo {${argKey}} >> ${f}`,
          __unparsed__: [cmdLineArg],
        },
        context
      );
      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(readFile(f)).toEqual(expected);
    }
  );

  it('should run commands serially', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      {
        commands: [`sleep 0.2 && echo 1 >> ${f}`, `echo 2 >> ${f}`],
        parallel: false,
        __unparsed__: [],
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('12');
  });

  it('should run commands in parallel', async () => {
    const f = fileSync().name;
    const result = await runCommands(
      {
        commands: [
          {
            command: `echo 1 >> ${f}`,
          },
          {
            command: `echo 2 >> ${f}`,
          },
        ],
        parallel: true,
        __unparsed__: [],
      },
      context
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    const contents = readFile(f);
    expect(contents).toContain('1');
    expect(contents).toContain('2');
  });

  describe('readyWhen', () => {
    it('should error when parallel = false', async () => {
      try {
        await runCommands(
          {
            commands: [{ command: 'echo foo' }, { command: 'echo bar' }],
            parallel: false,
            readyWhen: 'READY',
            __unparsed__: [],
          },
          context
        );
        fail('should throw');
      } catch (e) {
        expect(e.message).toEqual(
          `ERROR: Bad executor config for run-commands - "readyWhen" can only be used when "parallel=true".`
        );
      }
    });

    it('should return success true when the string specified as ready condition is found', async () => {
      const f = fileSync().name;
      const result = await runCommands(
        {
          commands: [`echo READY && sleep 0.1 && echo 1 >> ${f}`, `echo foo`],
          parallel: true,
          readyWhen: 'READY',
          __unparsed__: [],
        },

        context
      );
      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('');

      setTimeout(() => {
        expect(readFile(f)).toEqual('1');
      }, 150);
    });
  });

  it('should stop execution and fail when a command fails', async () => {
    const f = fileSync().name;

    try {
      await runCommands(
        {
          commands: [`echo 1 >> ${f} && exit 1`, `echo 2 >> ${f}`],
          parallel: false,
          __unparsed__: [],
        },
        context
      );
      fail('should fail when a command fails');
    } catch (e) {}
    expect(readFile(f)).toEqual('1');
  });

  describe('interpolateArgsIntoCommand', () => {
    it('should add all unparsed args when forwardAllArgs is true', () => {
      expect(
        interpolateArgsIntoCommand(
          'echo',
          { __unparsed__: ['one', '-a=b'] } as any,
          true
        )
      ).toEqual('echo one -a=b');
    });
  });

  describe('--color', () => {
    it('should not set FORCE_COLOR=true', async () => {
      const exec = jest.spyOn(require('child_process'), 'exec');
      await runCommands(
        {
          commands: [`echo 'Hello World'`, `echo 'Hello Universe'`],
          parallel: true,
          __unparsed__: [],
        },
        context
      );

      expect(exec).toHaveBeenCalledTimes(2);
      expect(exec).toHaveBeenNthCalledWith(1, `echo 'Hello World'`, {
        maxBuffer: LARGE_BUFFER,
        env: {
          ...process.env,
          ...env(),
        },
      });
      expect(exec).toHaveBeenNthCalledWith(2, `echo 'Hello Universe'`, {
        maxBuffer: LARGE_BUFFER,
        env: {
          ...process.env,
          ...env(),
        },
      });
    });

    it('should set FORCE_COLOR=true when running with --color', async () => {
      const exec = jest.spyOn(require('child_process'), 'exec');
      await runCommands(
        {
          commands: [`echo 'Hello World'`, `echo 'Hello Universe'`],
          parallel: true,
          color: true,
          __unparsed__: [],
        },
        context
      );

      expect(exec).toHaveBeenCalledTimes(2);
      expect(exec).toHaveBeenNthCalledWith(1, `echo 'Hello World'`, {
        maxBuffer: LARGE_BUFFER,
        env: { ...process.env, FORCE_COLOR: `true`, ...env() },
      });
      expect(exec).toHaveBeenNthCalledWith(2, `echo 'Hello Universe'`, {
        maxBuffer: LARGE_BUFFER,
        env: { ...process.env, FORCE_COLOR: `true`, ...env() },
      });
    });
  });

  describe('cwd', () => {
    it('should use workspace root package when cwd is not specified', async () => {
      const root = dirSync().name;
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `nx --version >> ${f}`,
            },
          ],
          parallel: true,
          cwd: process.cwd(),
          __unparsed__: [],
        },
        { root } as any
      );
      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).not.toBe('12.0.0');
    });

    it('should run the task in the workspace root when no cwd is specified', async () => {
      const root = dirSync().name;
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `pwd >> ${f}`,
            },
          ],
          parallel: true,
          __unparsed__: [],
        },

        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).toBe(root);
    });

    it('should run the task in the specified cwd relative to the workspace root when cwd is not an absolute path', async () => {
      const root = dirSync().name;
      const childFolder = dirSync({ dir: root }).name;
      const cwd = relative(root, childFolder);
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `pwd >> ${f}`,
            },
          ],
          cwd,
          parallel: true,
          __unparsed__: [],
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).toBe(childFolder);
    });

    it('should terminate properly with an error if the cwd is not valid', async () => {
      const root = dirSync().name;
      const cwd = 'bla';

      const result = await runCommands(
        {
          commands: [
            {
              command: `echo "command does not run"`,
            },
          ],
          cwd,
          parallel: true,
          __unparsed__: [],
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: false }));
    }, 1000);

    it('should run the task in the specified absolute cwd', async () => {
      const root = dirSync().name;
      const childFolder = dirSync({ dir: root }).name;
      const f = fileSync().name;

      const result = await runCommands(
        {
          commands: [
            {
              command: `pwd >> ${f}`,
            },
          ],
          cwd: childFolder,
          parallel: true,
          __unparsed__: [],
        },
        { root } as any
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(normalize(readFile(f))).toBe(childFolder);
    });
  });

  describe('dotenv', () => {
    beforeAll(() => {
      writeFileSync('.env', 'NRWL_SITE=https://nrwl.io/');
    });

    beforeEach(() => {
      delete process.env.NRWL_SITE;
      delete process.env.NX_SITE;
    });

    afterAll(() => {
      unlinkSync('.env');
    });

    it('should load the root .env file by default if there is one', async () => {
      let f = fileSync().name;
      const result = await runCommands(
        {
          commands: [
            {
              command: `echo $NRWL_SITE >> ${f}`,
            },
          ],
          __unparsed__: [],
        },
        context
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('https://nrwl.io/');
    });

    it('should load the specified .env file instead of the root one', async () => {
      const devEnv = fileSync().name;
      writeFileSync(devEnv, 'NX_SITE=https://nx.dev/');
      let f = fileSync().name;
      const result = await runCommands(
        {
          commands: [
            {
              command: `echo $NX_SITE >> ${f} && echo $NRWL_SITE >> ${f}`,
            },
          ],
          envFile: devEnv,
          __unparsed__: [],
        },
        context
      );

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('https://nx.dev/');
    });

    it('should error if the specified .env file does not exist', async () => {
      let f = fileSync().name;
      try {
        await runCommands(
          {
            commands: [
              {
                command: `echo $NX_SITE >> ${f} && echo $NRWL_SITE >> ${f}`,
              },
            ],
            envFile: '/somePath/.fakeEnv',
            __unparsed__: [],
          },

          context
        );
        fail('should not reach');
      } catch (e) {
        expect(e.message).toContain(
          `no such file or directory, open '/somePath/.fakeEnv'`
        );
      }
    });
  });
});
