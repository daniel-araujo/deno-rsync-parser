# rsync_parser

Parses the output of rsync when called with the `--itemize-changes` option. This
allows you to programmatically identify files that got created, updated and
deleted. Output can be in the form of strings and streams.

Requires no additional permissions.


## Example

```js
import {
  RsyncItemizeChangesParser
} from "https://deno.land/x/rsync_parser@v2.2.1/mod.ts";

const parser = new RsyncItemizeChangesParser(`
cd+++++++++ src/
>f+++++++++ src/index.js
>f..tp..... LICENSE
>f.st...... package.json
*deleting   package-lock.json
`);

// Reads a single token.
let token = await parser.read();
if (token && token.type === 'create') {
  console.log(`Created ${token.path}`);
}

// Iterates over every token.
for await (const token of parser) {
  switch (token.type) {
  case 'create':
    console.log(`Created ${token.path}`);
    break;

  case 'update':
    console.log(`Updated ${token.path}`);
    break;

  case 'delete':
    console.log(`Deleted ${token.path}`);
    break;
  }
}
```


## Contributing

The easiest way to contribute is by starring this project on GitHub!

https://github.com/daniel-araujo/deno-rsync-parser

If you've found a bug, would like to suggest a feature or need help, feel free to create an issue:

https://github.com/daniel-araujo/deno-rsync-parser/issues


## See also

Node.js version of this library:
https://www.npmjs.com/package/rsync-parser
