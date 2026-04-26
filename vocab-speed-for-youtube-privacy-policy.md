# Privacy Policy for Vocab Speed for YouTube

Effective date: 2026-04-26

Vocab Speed for YouTube is a Chrome extension that adapts YouTube playback speed based on unfamiliar words in visible captions.

## Data Stored Locally

The extension stores the following data in Chrome local storage:

- Extension settings, such as playback speeds and unfamiliar-word threshold
- Optional Supabase URL and anon key provided by the user
- Local known-word list provided by the user
- Phrase Queue items saved by the user, including sentence text, unfamiliar words, video URL, video ID, approximate timestamp, and cached meanings
- Cached Chinese meanings for previously looked-up words

This data stays in the user's browser unless the user connects external services as described below.

## External Services

If the user configures Supabase, the extension connects to the user's Supabase project to read vocabulary data. The extension is designed for anon keys or read-only endpoints. Users should not enter service role keys.

If "automatic Chinese meaning lookup" is enabled, the extension may send individual English words to MyMemory Translated API to obtain a short Chinese meaning. It does not send full YouTube captions, YouTube URLs, Supabase keys, or Phrase Queue content to this translation service.

## YouTube Pages

On YouTube pages, the extension reads visible caption text and controls the page's video playback rate. The extension does not collect browsing history or monitor non-YouTube pages.

## Data Sale and Sharing

The extension does not sell user data. The extension does not use user data for advertising. The extension does not transfer user data except for the user-configured Supabase requests and optional single-word meaning lookup described above.

## Security

Settings and cached data are stored using Chrome extension storage. Users are responsible for using safe Supabase credentials. Do not enter service role keys or private server keys into the extension.

## Contact

For questions about this privacy policy, contact the publisher email configured in the Chrome Web Store listing.
