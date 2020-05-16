// Copyright 2020 Daniel Araujo. All rights reserved. MIT license.
import { RsyncItemizeChangesParser } from "../rsync-itemize-changes-parser.ts";

const TEST_DIR = await Deno.makeTempDirSync();

try {
  // Source.
  Deno.mkdirSync(`${TEST_DIR}/source`);
  Deno.writeFileSync(`${TEST_DIR}/source/one`, new Uint8Array([1]));
  Deno.writeFileSync(`${TEST_DIR}/source/two`, new Uint8Array([2]));

  // Destination.
  Deno.mkdirSync(`${TEST_DIR}/destination`);
  Deno.writeFileSync(`${TEST_DIR}/destination/one`, new Uint8Array([1, 1]));
  Deno.writeFileSync(`${TEST_DIR}/destination/three`, new Uint8Array([3, 3]));

  const rsync = Deno.run({
    cmd: [
      "rsync",
      "--itemize-changes",
      "--dry-run",
      "--delete",
      "--archive",
      `${TEST_DIR}/source/`,
      `${TEST_DIR}/destination/`,
    ],
    stdout: "piped",
  });

  if (!rsync.stdout) {
    throw new Error("No stdout?");
  }

  let parser = new RsyncItemizeChangesParser(rsync.stdout);

  for await (let token of parser) {
    switch (token.type) {
      case "create":
        console.log(`Created ${token.path}`);
        break;

      case "update":
        console.log(`Updated ${token.path}`);
        break;

      case "delete":
        console.log(`Deleted ${token.path}`);
        break;
    }
  }
} finally {
  Deno.removeSync(TEST_DIR, { recursive: true });
}
