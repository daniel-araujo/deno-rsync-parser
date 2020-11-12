// Copyright 2020 Daniel Araujo. All rights reserved. MIT license.
import {
  assert,
  assertStrictEquals,
} from "https://deno.land/std@0.77.0/testing/asserts.ts";
import { StringReader } from "https://deno.land/std@0.77.0/io/readers.ts";

import { RsyncItemizeChangesParser } from "./rsync_itemize_changes_parser.ts";

// Constructor options.
///////////////////////////////////////////////////////////////////////////////
Deno.test("constructor: reads from a stream", async () => {
  let stream = new StringReader(`cd+++++++++ dir
`);

  let parser = new RsyncItemizeChangesParser(stream);

  let token = await parser.read();
  assert(token !== null && token.type === "create");

  let token2 = await parser.read();
  assertStrictEquals(token2, null);
});

Deno.test("constructor: reads from a string", async () => {
  let output = `cd+++++++++ dir
`;

  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "create");

  let token2 = await parser.read();
  assertStrictEquals(token2, null);
});
///////////////////////////////////////////////////////////////////////////////

// Read behavior
///////////////////////////////////////////////////////////////////////////////
Deno.test("read: consumes enough to find a token, leaves remaining output for the next call", async () => {
  let output = `cd+++++++++ dir
>f.st...... file
`;

  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "create");
  assertStrictEquals(token.fileType, "directory");

  let token2 = await parser.read();
  assert(token2 !== null && token2.type === "update");
  assertStrictEquals(token2.fileType, "file");
});

Deno.test("read: skips content that it cannot interpret", async () => {
  let output = `cd+++++++++ dir
cstarts with a c
>f.st...... file
`;

  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "create");
  assertStrictEquals(token.fileType, "directory");

  let token2 = await parser.read();
  assert(token2 !== null && token2.type === "update");
  assertStrictEquals(token2.fileType, "file");
});

Deno.test("read: returns null when no more tokens exist", async () => {
  let output = `cd+++++++++ file
`;

  let parser = new RsyncItemizeChangesParser(output);

  await parser.read();

  let token = await parser.read();
  assertStrictEquals(token, null);
});
///////////////////////////////////////////////////////////////////////////////

// Common tests for creating files.
///////////////////////////////////////////////////////////////////////////////
for (let code of ["c", ">", "<"]) {
  Deno.test(`read: (${code}) transfers new file`, async () => {
    let output = `${code}f+++++++++ path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "create");
    assertStrictEquals(token.local, code === "c");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, false);
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "file");
  });

  Deno.test(`read: (${code}) transfers new directory`, async () => {
    let output = `${code}d+++++++++ path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "create");
    assertStrictEquals(token.local, code === "c");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, false);
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "directory");
  });

  Deno.test(`read: (${code}) transfers new symbolic link`, async () => {
    let output = `${code}L+++++++++ path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "create");
    assertStrictEquals(token.local, code === "c");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, false);
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "symlink");
  });

  Deno.test(`read: (${code}) transfers new device`, async () => {
    let output = `${code}D+++++++++ path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "create");
    assertStrictEquals(token.local, code === "c");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, false);
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "device");
  });

  Deno.test(`read: (${code}) transfers new special file`, async () => {
    let output = `${code}S+++++++++ path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "create");
    assertStrictEquals(token.local, code === "c");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, false);
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "special");
  });
}

// Common path recognition.
///////////////////////////////////////////////////////////////////////////////
for (let code of [">", "<", "h", "."]) {
  Deno.test(`read: (${code}) reads path with spaces in remote create`, async () => {
    let output = `${code}f+++++++++ path with spaces
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "create");
    assertStrictEquals(token.path, "path with spaces");
  });

  Deno.test(`read: (${code}) reads path with spaces in remote update`, async () => {
    let output = `${code}f.st...... path with spaces
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.path, "path with spaces");
  });

  Deno.test(`read: (${code}) reads path with slashes in remote create`, async () => {
    let output = `${code}f+++++++++ path/with/spaces
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "create");
    assertStrictEquals(token.path, "path/with/spaces");
  });

  Deno.test(`read: (${code}) reads path with slashes in remote update`, async () => {
    let output = `${code}f.st...... path/with/spaces
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.path, "path/with/spaces");
  });
}

// Common update attributes
///////////////////////////////////////////////////////////////////////////////
for (let code of [">", "<", "h", "."]) {
  Deno.test(`read: (${code}) transfers updates to a file`, async () => {
    let output = `${code}f.st...... path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, code === "h");
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "file");
  });

  Deno.test(`read: (${code}) transfers updates to a directory`, async () => {
    let output = `${code}d.st...... path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, code === "h");
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "directory");
  });

  Deno.test(`read: (${code}) transfers updates to a symbolic link`, async () => {
    let output = `${code}L.st...... path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, code === "h");
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "symlink");
  });

  Deno.test(`read: (${code}) transfers updates to a device`, async () => {
    let output = `${code}D.st...... path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, code === "h");
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "device");
  });

  Deno.test(`read: (${code}) transfers updates to a special file`, async () => {
    let output = `${code}S.st...... path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.received, code === ">");
    assertStrictEquals(token.sent, code === "<");
    assertStrictEquals(token.hardlink, code === "h");
    assertStrictEquals(token.path, "path");
    assertStrictEquals(token.fileType, "special");
  });

  Deno.test(`read: (${code}) sets checksum to true when checksum is reported to have changed`, async () => {
    let output = `${code}fc.t...... path
`;

    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.checksum, true);
  });

  Deno.test(`read: (${code}) sets checksum to false if checksum is not reported in update`, async () => {
    let output = `${code}f..t...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.checksum, false);
  });

  Deno.test(`read: (${code}) sets size to true if different size is reported in update`, async () => {
    let output = `${code}f.st...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.size, true);
  });

  Deno.test(`read: (${code}) sets size to false if different size is not reported in update`, async () => {
    let output = `${code}f..t...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.size, false);
  });

  Deno.test(`read: (${code}) sets timestamp to true if different timestamp is reported in update`, async () => {
    let output = `${code}f..t...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.timestamp, true);
  });

  Deno.test(`read: (${code}) sets timestamp to true when transfer time flag T is reported`, async () => {
    let output = `${code}fc.T...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.timestamp, true);
  });

  Deno.test(`read: (${code}) sets timestamp to false if timestamp is not reported in update`, async () => {
    let output = `${code}fc........ path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.timestamp, false);
  });

  Deno.test(`read: (${code}) sets permissions to true if permissions were changed in update`, async () => {
    let output = `${code}f..tp..... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.permissions, true);
  });

  Deno.test(`read: (${code}) sets permissions to false if permissions were not changed in update`, async () => {
    let output = `${code}f..t...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.permissions, false);
  });

  Deno.test(`read: (${code}) sets owner to true if owner were changed in update`, async () => {
    let output = `${code}f..t.o.... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.owner, true);
  });

  Deno.test(`read: (${code}) sets owner to false if owner were not changed in update`, async () => {
    let output = `${code}f..t...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.owner, false);
  });

  Deno.test(`read: (${code}) sets group to true if group were changed in update`, async () => {
    let output = `${code}f..t..g... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.group, true);
  });

  Deno.test(`read: (${code}) sets group to false if group were not changed in update`, async () => {
    let output = `${code}f..t...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.group, false);
  });

  Deno.test(`read: (${code}) sets acl to true if acl were changed in update`, async () => {
    let output = `${code}f..t....a. path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.acl, true);
  });

  Deno.test(`read: (${code}) sets acl to false if acl were not changed in update`, async () => {
    let output = `${code}f..t...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.acl, false);
  });

  Deno.test(`read: (${code}) sets xattr to true if extended attributes were changed in update`, async () => {
    let output = `${code}f..t.....x path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.xattr, true);
  });

  Deno.test(`read: (${code}) sets xattr to false if extended attributes were not changed in update`, async () => {
    let output = `${code}f..t...... path
`;
    let parser = new RsyncItemizeChangesParser(output);

    let token = await parser.read();
    assert(token !== null && token.type === "update");
    assertStrictEquals(token.xattr, false);
  });
}
///////////////////////////////////////////////////////////////////////////////

// File deletion
///////////////////////////////////////////////////////////////////////////////
Deno.test("read: recognizes deleted file", async () => {
  let output = `*deleting   path
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "delete");
  assertStrictEquals(token.path, "path");
});

Deno.test("read: recognizes failure to delete directory", async () => {
  // This can happen when the delete option is used and rsync is unable to
  // delete the contents inside a directory. Rsync writes to stderr about being
  // unable to delete the files but it writes to stdout that it cannot delete
  // the directory for not being empty. We only parse content from stdout.

  let output = `cannot delete non-empty directory: path
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "cannotDelete");
  assertStrictEquals(token.path, "path");
  assertStrictEquals(token.fileType, "directory");
});

Deno.test("read: correctly parses path with slashes when failing to delete directory", async () => {
  let output = `cannot delete non-empty directory: path/with/slashes
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "cannotDelete");
  assertStrictEquals(token.path, "path/with/slashes");
});

Deno.test("read: correctly parses path with spaces when failing to delete directory", async () => {
  let output = `cannot delete non-empty directory: path with spaces
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "cannotDelete");
  assertStrictEquals(token.path, "path with spaces");
});
///////////////////////////////////////////////////////////////////////////////

// Hard link
///////////////////////////////////////////////////////////////////////////////
Deno.test("read: recognizes hard link creation", async () => {
  let output = `
>f+++++++++ file
hf+++++++++ hardlink => file
`;
  let parser = new RsyncItemizeChangesParser(output);

  // Skip normal file creation. This is not what we want to test.
  await parser.read();

  let token = await parser.read();
  assert(token !== null && token.type === "create");
  assertStrictEquals(token.path, "hardlink");
  assertStrictEquals(token.hardlink, true);
  assertStrictEquals(token.hardlinkPath, "file");
});

Deno.test("read: recognizes hard link update with no hard link path", async () => {
  let output = `
>f..t...... file
hf..t...... hardlink
`;
  let parser = new RsyncItemizeChangesParser(output);

  // Skip normal file update. This is not what we want to test.
  await parser.read();

  let token = await parser.read();
  assert(token !== null && token.type === "update");
  assertStrictEquals(token.path, "hardlink");
  assertStrictEquals(token.hardlink, true);
  assertStrictEquals(token.hardlinkPath, null);
});

Deno.test("read: recognizes hard link update with hard link path", async () => {
  // hardlink was linked to file, changed to file2.
  let output = `
>f..t...... file
>f..t...... file2
hf..t...... hardlink => file2
`;
  let parser = new RsyncItemizeChangesParser(output);

  // Skip normal file update. This is not what we want to test.
  await parser.read();
  await parser.read();

  let token = await parser.read();
  assert(token !== null && token.type === "update");
  assertStrictEquals(token.path, "hardlink");
  assertStrictEquals(token.hardlink, true);
  assertStrictEquals(token.hardlinkPath, "file2");
});
///////////////////////////////////////////////////////////////////////////////

// Unchanged files
///////////////////////////////////////////////////////////////////////////////
Deno.test("read: recognizes unchanged file", async () => {
  let output = `
.f          file
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "unchanged");
  assertStrictEquals(token.fileType, "file");
  assertStrictEquals(token.path, "file");
});

Deno.test("read: recognizes unchanged directory", async () => {
  let output = `
.d          file
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "unchanged");
  assertStrictEquals(token.fileType, "directory");
  assertStrictEquals(token.path, "file");
});

Deno.test("read: recognizes unchanged symbolic link", async () => {
  let output = `
.L          file
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "unchanged");
  assertStrictEquals(token.fileType, "symlink");
  assertStrictEquals(token.path, "file");
});

Deno.test("read: recognizes unchanged device", async () => {
  let output = `
.D          file
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "unchanged");
  assertStrictEquals(token.fileType, "device");
  assertStrictEquals(token.path, "file");
});

Deno.test("read: recognizes unchanged special file", async () => {
  let output = `
.S          file
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "unchanged");
  assertStrictEquals(token.fileType, "special");
  assertStrictEquals(token.path, "file");
});

Deno.test("read: does not mistake confusing modification for unchanged", async () => {
  let output = `
.f..t...... file
`;
  let parser = new RsyncItemizeChangesParser(output);

  let token = await parser.read();
  assert(token !== null && token.type === "update");
});
///////////////////////////////////////////////////////////////////////////////

// Iterator.
///////////////////////////////////////////////////////////////////////////////
Deno.test("for await...of is equivalent to calling read multiple times", async () => {
  let output = `cd+++++++++ file1
>f.st...... file
`;

  let parser = new RsyncItemizeChangesParser(output);

  let iterations = 0;

  for await (let token of parser) {
    iterations += 1;

    if (iterations === 1) {
      assert(token !== null && token.type === "create");
      assertStrictEquals(token.fileType, "directory");
    }

    if (iterations === 2) {
      assert(token !== null && token.type === "update");
      assertStrictEquals(token.fileType, "file");
    }
  }

  assertStrictEquals(iterations, 2);
});

Deno.test("after using for await...of it does not rewind", async () => {
  let output = `cd+++++++++ file1
cd+++++++++ file2
`;

  let parser = new RsyncItemizeChangesParser(output);

  for await (let _ of parser);

  let iterations = 0;

  for await (let _ of parser) {
    iterations += 1;
    console.log(_);
  }

  assertStrictEquals(iterations, 0);
});
///////////////////////////////////////////////////////////////////////////////
