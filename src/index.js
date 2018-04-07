import Router from 'router';
import serveStatic from 'serve-static';
import FSStore from 'fs-blob-store';
import isStream from 'is-stream';
import isBuffer from 'is-buffer';
import through from 'through2';
import fromBuffer from 'from2-buffer';
import imageType from 'image-type';

function toImageStream(input) {
  let stream;
  if (isStream(input)) {
    stream = input;
  } else if (isBuffer(input)) {
    stream = fromBuffer(input);
  } else {
    throw new TypeError('toImageStream: Expected a stream or a Buffer.');
  }

  const output = through();
  stream.pipe(output);

  return new Promise((resolve, reject) => {
    stream.once('data', (chunk) => {
      const type = imageType(chunk);
      if (!type) {
        stream.destroy();
        reject(new Error('toImageStream: Not an image.'));
      }

      Object.assign(output, type);
      resolve(output);
    });
  });
}

function onFinish(stream) {
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function assertPermission(user, permission) {
  const can = await user.can(permission);
  if (!can) throw new Error(`User does not have the "${permission}" role.`);
  return true;
}

class EmojiManager extends Router {
  constructor(uw, opts) {
    const router = super();

    this.uw = uw;
    this.opts = opts;
    this.store = opts.store;
    if (!this.store && opts.path) {
      this.store = new FSStore({ path: opts.path, cache: opts.cache });
    }
    this.emojiSets = [];

    this.uw.mongo.model('CustomEmoji', {
      shortcode: { type: String, index: true, unique: true },
      name: { type: String },
      addedBy: {},
    });

    if (this.store) {
      this.use(this.getCustomEmojiMiddleware());
    }

    return router;
  }

  get Emoji() {
    return this.uw.model('CustomEmoji');
  }

  useEmojiSet(set) {
    if (!set.middleware) {
      throw new TypeError('Emoji set did not provide middleware.');
    }
    this.use(set.middleware());
    this.emojiSets.push(set);
    return this;
  }

  async getEmoji(shortcode) {
    const custom = await this.Emoji.findOne({ shortcode });
    if (custom) {
      return {
        set: null,
        shortcode: custom.shortcode,
        name: custom.name,
        addedBy: custom.addedBy,
      };
    }

    const set = this.emojiSets.find(s => typeof s.emoji[shortcode] === 'string');
    if (set) {
      const name = set.emoji[shortcode];
      return {
        set: set.name || 'unknown',
        shortcode,
        name,
      };
    }

    return null;
  }

  async addCustomEmoji(user, shortcode, emoji) {
    if (!this.store) {
      throw new Error('Custom emoji are not enabled.');
    }
    if (user) {
      await assertPermission(user, 'emoji.add');
    }
    if (typeof shortcode !== 'string') {
      throw new TypeError('shortcode: Expected a string');
    }

    const emojiStream = await toImageStream(emoji);
    if (!emojiStream) {
      throw new Error('Invalid emoji image provided');
    }

    const name = `${shortcode}.${emojiStream.ext}`;
    const writeStream = this.store.createWriteStream({ key: name });
    await onFinish(emojiStream.pipe(writeStream));

    await this.Emoji.create({
      shortcode,
      name,
      addedBy: user._id, // eslint-disable-line no-underscore-dangle
    });
    await this.uw.publish('emoji:add', {
      shortcode,
      name,
      addedBy: user ? user.id : null,
    });

    return {
      set: null,
      shortcode,
      name,
      addedBy: user,
    };
  }

  async deleteCustomEmoji(user, shortcode) {
    if (user) {
      await assertPermission(user, 'emoji.remove');
    }
    const emoji = await this.Emoji.findOne({ shortcode });
    if (emoji) {
      await emoji.remove();
      await this.uw.publish('emoji:remove', {
        shortcode,
        user: user.id,
      });
    }
  }

  getCustomEmojiMiddleware() {
    if (this.store instanceof FSStore) {
      return serveStatic(this.opts.path);
    }
    return (req, res, next) => {
      const key = req.url.slice(1);
      this.store.createReadStream({ key })
        .pipe(res)
        .on('error', next);
    };
  }

  async list() {
    const map = {};
    this.emojiSets.forEach((set) => {
      Object.keys(set.emoji).forEach((shortcode) => {
        map[shortcode] = set.emoji[shortcode];
      });
    });
    const emoji = await this.Emoji.find({}, { shortcode: 1, name: 1 }).lean().exec();
    emoji.forEach(({ shortcode, name }) => {
      map[shortcode] = name;
    });
    return map;
  }
}

export default function emojiPlugin(opts = {}) {
  return (uw) => {
    uw.emoji = new EmojiManager(uw, opts); // eslint-disable-line no-param-reassign
    return uw.emoji;
  };
}
