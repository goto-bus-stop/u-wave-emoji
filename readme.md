# u-wave-emoji

Generic support for emoji sets and configurable custom emoji for üWave servers.

## Install

```bash
npm install --save u-wave-emoji
```

## Usage

First create an instance of the `u-wave-emoji` plugin and `.use()` it.
To enable custom emoji, also provide a local path or a custom [blob-store](https://github.com/maxogden/abstract-blob-store) instance.
Then add the `uw.emoji` middleware to the Express app.

```js
import emoji from 'u-wave-emoji';

uw.use(emoji({
  path: './custom-emoji',
  // OR
  store: require('fs-blob-store')('./custom-emoji')
}));


app.use('/assets/emoji', uw.emoji);
```

## API

### `uw.use(emoji(opts={}))`

Create and use the emoji plugin.

Available options are:

 - `opts.path` - A file path to a directory where custom emoji should be stored.
 - `opts.store` - A [blob-store](https://github.com/maxogden/abstract-blob-store) to be used to store emoji.
   By default, an [fs](https://github.com/mafintosh/fs-blob-store) store is used that saves emoji in the directory specified by `opts.path`.

### `uw.emoji.useEmojiSet(set)`

Use a predefined emoji set.
Multiple emoji sets can be used.
If there are duplicate shortcodes, emoji that were registered first take precedence over emoji that were registered later.

```js
import emojione from 'u-wave-emojione'

uw.emoji.useEmojiSet(emojione)
```

### `uw.emoji.addCustomEmoji(user, shortcode, stream)`

> In order to use custom emoji, a Blob Store must be configured.

Define a custom emoji.
Custom emoji persist across server restarts.

**Parameters**

 - `user` - The user who is adding the emoji.
   This user must have the `emoji.add` role.
 - `shortcode` - String representing the emoji short code.
   May not contain whitespace.
 - `stream` - A stream or Buffer containing the emoji image data.

### `uw.emoji.deleteCustomEmoji(user, shortcode)`

Delete an emoji.

**Parameters**

 - `user` - The user who is deleting the emoj.
   This user must have the `emoji.remove` role.
 - `shortcode` - Shortcode of the emoji to remove.

### `uw.emoji.getEmoji(shortcode)`

Get information about an emoji.

**Parameters**

 - `shortcode` - Shortcode of the emoji.

Returns an object `{set, shortcode, name, addedBy}`.
`set` identifies the emoji set the emoji is a part of, or `null` if the emoji is custom.
`addedBy` identifies the user that added the emoji, and is only present for custom emoji.

### `uw.emoji.list()`

Retrieve all emoji.
Returns a Promise for an object of the shape `{shortcode: "name"}`.

### Message: `emoji:add`

Whenever a custom emoji is added, an `emoji:add` message is published to the `uwave` channel.

**Data**

 - `shortcode` - Shortcode of the new emoji.
 - `name` - File name of the emoji.
 - `addedBy` - User ID of the user who added the emoji.

### Message: `emoji:remove`

Whenever a custom emoji is removed, an `emoji:remove` message is published to the `uwave` channel.

**Data**

 - `shortcode` - Shortcode of the emoji that has been removed.
 - `user` - User ID of the user who removed the emoji.

## License

[MIT](./LICENSE)
