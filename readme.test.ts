// Copyright 2020 Daniel Araujo. All rights reserved. MIT license.
import { assertStrictEquals } from "https://deno.land/std@0.77.0/testing/asserts.ts";
import { readLines } from "https://deno.land/std@0.77.0/io/bufio.ts";

/** Extracts main code block from readme file. */
async function naiveCodeExtraction(file: Deno.File) {
  let started = false;
  let collected = [];

  for await (let line of readLines(file)) {
    if (line === '```js') {
      started = true;
      continue;
    } else if (line === '```') {
      started = false;
      break;
    }

    if (started) {
      collected.push(line);
    }
  }

  return collected.join('\n');
}

/** Runs piece of code through deno. */
async function runCode(code: string) {
  let tmpPath = Deno.makeTempFileSync();
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const data = encoder.encode(code);
    Deno.writeFileSync(tmpPath, data);

    let program = await Deno.run({
      cmd: [Deno.execPath(), 'run', tmpPath],
      stdout: 'piped',
    });

    try {
      if (!program.stdout) {
        throw new Error('Expected stdout.');
      }

      try {
        return decoder.decode(await Deno.readAll(program.stdout));
      } finally {
        program.stdout.close();
      }
    } finally {
      program.close();
    }
  } finally {
    Deno.removeSync(tmpPath);
  }
}

/** Replaces imports to remote code with imports to local code. */
function naiveUseLocalCode(code: String) {
  let dir = new URL('.', import.meta.url).pathname;
  return code.replace(/https:\/\/deno.land\/x\/rsync_parser@.+\/mod.ts/, dir + './mod.ts');
}

Deno.test("main example produces expected output", async () => {
  let expectedOutput = `Created src/
Created src/index.js
Updated LICENSE
Updated package.json
Deleted package-lock.json
`;

  let readme = Deno.openSync('./README.md');

  try {
    let code = await naiveCodeExtraction(readme);

    // The example uses remote URL. Here we want to test against local changes.
    code = naiveUseLocalCode(code);

    let output = await runCode(code);

    assertStrictEquals(output, expectedOutput);
  } finally {
    readme.close();
  }
});
