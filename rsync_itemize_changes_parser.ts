// Copyright 2020 Daniel Araujo. All rights reserved. MIT license.
import { StringReader } from "https://deno.land/std@v0.51.0/io/readers.ts";
import { readLines } from "https://deno.land/std@v0.51.0/io/bufio.ts";

// Rsync operation types
///////////////////////////////////////////////////////////////////////////////
// A file is being transferred to the remote host (sent).
const RSYNC_TYPE_SENT = "<";

// A file is being transferred to the local host (received).
const RSYNC_TYPE_RECEIVED = ">";

// A local change/creation is occurring for the item (such as the creation of a
// directory or the changing of a symlink, etc.).
const RSYNC_TYPE_CHANGED = "c";

// The item is a hard link to another item (requires --hard-links).
const RSYNC_TYPE_INFO_HARD_LINK = "h";

// The item is not being updated (though it might have attributes that are being
// modified).
const RSYNC_TYPE_NONE = ".";

// The rest of the itemized-output area contains a message (e.g. "deleting").
const RSYNC_TYPE_MESSAGE = "*";
///////////////////////////////////////////////////////////////////////////////

// Rsync file types
///////////////////////////////////////////////////////////////////////////////
// File.
const RSYNC_FILE_FILE = "f";

// Directory.
const RSYNC_FILE_DIRECTORY = "d";

// Symbolic link.
const RSYNC_FILE_SYMLINK = "L";

// Device.
const RSYNC_FILE_DEVICE = "D";

// Special file.
const RSYNC_FILE_SPECIAL = "S";
///////////////////////////////////////////////////////////////////////////////

type FileType = "file" | "directory" | "symlink" | "device" | "special";

/** Converts rsync file type to our file type. */
function rsyncFileTypeToOurFileType(rsyncFileType: string): FileType {
  switch (rsyncFileType) {
    case RSYNC_FILE_FILE:
      return "file";
    case RSYNC_FILE_DIRECTORY:
      return "directory";
    case RSYNC_FILE_SYMLINK:
      return "symlink";
    case RSYNC_FILE_DEVICE:
      return "device";
    case RSYNC_FILE_SPECIAL:
      return "special";
    default:
      throw new Error("Type not recognized.");
  }
}

type Token = TokenCreate | TokenUpdate | TokenDelete | TokenCannotDelete;

interface TokenCreate {
  type: "create";
  local: boolean;
  sent: boolean;
  received: boolean;
  hardlink: boolean;
  hardlinkPath: string | null;
  path: string;
  fileType: FileType;
}

interface TokenUpdate {
  type: "update";
  sent: boolean;
  received: boolean;
  hardlink: boolean;
  hardlinkPath: string | null;
  checksum: boolean;
  size: boolean;
  timestamp: boolean;
  permissions: boolean;
  owner: boolean;
  group: boolean;
  acl: boolean;
  xattr: boolean;
  path: string;
  fileType: FileType;
}

interface TokenDelete {
  type: "delete";
  path: string;
}

interface TokenCannotDelete {
  type: "cannotDelete";
  path: string;
  fileType: FileType;
}

/** Parses output from rsync command ran with the --itemize-changes option.
 */
export class RsyncItemizeChangesParser {
  /** Rsync output stream. */
  #stream: Deno.Reader;

  /** Line iterator. */
  #readLines: AsyncIterableIterator<string>;

  /** Parses output from rsync command ran with the --itemize-changes option. Can
   * parse from a string or a readable stream.
   */
  constructor(stream: string | Deno.Reader) {
    if (typeof stream === "string") {
      this.#stream = new StringReader(stream);
    } else {
      this.#stream = stream as Deno.Reader;
    }

    this.#readLines = readLines(this.#stream);
  }

  /** Reads next token. Returns null when no more tokens are available. */
  async read(): Promise<Token | null> {
    let iter = await this.#readLines.next();

    if (iter.done) {
      return null;
    }

    let line = iter.value;

    // The general format is like the string YXcstpoguax although some strings
    // do not comform.

    // Y is replaced by the type of update being done.
    let Y = line[0];

    if (line.startsWith("cannot delete non-empty directory:")) {
      // This does not follow the general format but it shows up in the
      // output.

      // Path shows up after the message.
      let path = line.substring(35);

      return {
        type: "cannotDelete",
        path: path,
        fileType: "directory",
      };
    } else if (
      Y == RSYNC_TYPE_SENT || Y === RSYNC_TYPE_RECEIVED ||
      Y === RSYNC_TYPE_INFO_HARD_LINK ||
      Y === RSYNC_TYPE_CHANGED
    ) {
      // File type.
      let X = line[1];

      // Checksum for regular files, a change in some value for symlinks,
      // devices and special files. If it's a plus sign then it means that a
      // file was created.
      let c = line[2];

      // Path is separated by a space from the codes.
      let path = line.substring(line.indexOf(" ") + " ".length);

      let hardlink = Y === RSYNC_TYPE_INFO_HARD_LINK;
      let hardlinkPath = (() => {
        if (Y === RSYNC_TYPE_INFO_HARD_LINK) {
          // The path may also contain information about the hard link.
          let hardLinkSeparatorIndex = path.indexOf(" => ");
          if (hardLinkSeparatorIndex !== -1) {
            // It is present. We can retrieve it.
            let hardlinkPath = path.substring(
              hardLinkSeparatorIndex + " => ".length,
            );

            // The hard link information needs to be removed from path.
            path = path.substring(0, hardLinkSeparatorIndex);

            return hardlinkPath;
          }
        }

        return null;
      })();

      if (c === "+") {
        return {
          type: "create",
          local: Y == RSYNC_TYPE_CHANGED,
          sent: Y == RSYNC_TYPE_SENT,
          received: Y === RSYNC_TYPE_RECEIVED,
          hardlink: hardlink,
          hardlinkPath: hardlinkPath,
          path: path,
          fileType: rsyncFileTypeToOurFileType(X),
        };
      } else {
        // Different checksum
        let c = line[2];

        // Size change.
        let s = line[3];

        // Timestamp change.
        let t = line[4];

        // Permissions change.
        let p = line[5];

        // Owner change.
        let o = line[6];

        // Group change.
        let g = line[7];

        // ACL change.
        let a = line[9];

        // Extended attributes changed.
        let x = line[10];

        // This space separates the codes from the path.
        let expectedSpace = line[11];

        if (expectedSpace === " ") {
          return {
            type: "update",
            sent: Y == RSYNC_TYPE_SENT,
            received: Y === RSYNC_TYPE_RECEIVED,
            hardlink: hardlink,
            hardlinkPath: hardlinkPath,
            checksum: c === "c",
            size: s === "s",
            timestamp: t === "t" || t === "T",
            permissions: p === "p",
            owner: o === "o",
            group: g === "g",
            acl: a === "a",
            xattr: x === "x",
            path: path,
            fileType: rsyncFileTypeToOurFileType(X),
          };
        }
      }
    } else if (Y === RSYNC_TYPE_MESSAGE) {
      // Does not follow general format.

      let deletingMessage = line.substring(1, 9);

      if (deletingMessage === "deleting") {
        let path = line.substring(12);

        return {
          type: "delete",
          path: path,
        };
      }
    }

    // Couldn't interpret this line in any way. Trying next line.
    return this.read();
  }

  async *[Symbol.asyncIterator]() {
    let token;
    while (token = await this.read()) {
      yield token;
    }
  }
}
