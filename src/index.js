/* eslint max-len: [0] */

const { shellCommand, memoize } = require("cerebro-tools");
const pluginIcon = require("./icon.png");
const { execFile } = require("child_process");
const path = require("path");
const parseString = require("xml2js").parseString;
const applescript = require("applescript");
const DEFAULT_ICON = require("./ExecutableBinaryIcon.png");
const pinyin = require('tiny-pinyin');

const REGEXP = /win\s(.*)/;

const MEMOIZE_OPTIONS = {
  promise: "then",
  maxAge: 5 * 1000,
  preFetch: true,
};

function getIcon(processPath) {
  if (processPath === 'switch.png') {
    return DEFAULT_ICON;
  }
  const match = processPath.match(/^.*?\.app/);
  // If no .app was found, use OS X's generic 'executable binary' icon.
  return match ? match[0] : DEFAULT_ICON;
}

let lastCache = [];

const dirName = eval("__dirname");

function updateCache() {
  return new Promise((resolve) => {
    execFile(
      path.join(dirName, "../vendor/EnumWindows"),
      [`--search=""`],
      (err, stdout, stderr) => {
        const output = stdout.toString();
        if (err || stderr) {
          alert(output);
        }
        parseString(output, (err, data) => {
          if (err) {
            console.error(err);
          }
          lastCache = (data.items && data.items.item) || [];
          lastCache = lastCache.map(item => {
            return Object.assign({}, item, {
              fullText: (item.title[0] + '|' + item.subtitle[0] + '|' + pinyin.convertToPinyin(item.title[0]) + '|' + pinyin.convertToPinyin(item.subtitle[0])).toLowerCase(),
            });
          });
          resolve();
        });
      }
    );
  });
}

setInterval(() => {
  updateCache();
}, 1000 * 30);

const findWindow = memoize((searchWindowName, update) => {
  const load = () => {
    const items = lastCache.filter((item) => {
      return item.fullText.indexOf(searchWindowName.toLowerCase()) !== -1;
    });

    update(items);
  };
  // search first with cache
  load();
  updateCache().then(load);
}, MEMOIZE_OPTIONS);

/**
 * Plugin to look and display local and external IPs
 *
 * @param  {String} options.term
 * @param  {Function} options.display
 */
const fn = ({ term, display }) => {
  const match = term.match(REGEXP);
  if (match) {
    const searchWindowName = match[1];

    if (!searchWindowName) {
      return;
    }

    findWindow(searchWindowName, (list) => {
      const results = list.map(({ uid, title, subtitle, icon, $ }) => {
        return {
          title: title[0],
          id: $.arg,
          icon: getIcon(icon[0]),
          subtitle: subtitle[0],
          onSelect: () => {
            applescript.execString(`
          set q to "${$.arg}"
          set argv to extract_argv(q, "|||||")
          
          set proc to item 1 of argv
          set tabIndex to item 2 of argv as integer
          set windowName to item 3 of argv
          
          try
            tell application "System Events"
              with timeout of 0.1 seconds
                tell process proc to perform action "AXRaise" of window windowName
              end timeout
            end tell
          end try
          
          tell application proc
            activate
          end tell
          
          if proc = "Safari Technology Preview" then
            tell front window of application "Safari Technology Preview"
              set current tab to tab tabIndex
            end tell
          end if

          if proc = "Google Chrome" then
            tell application "Google Chrome"
              activate
              set win_List to every window
              repeat with win in win_List
                if title of win = windowName then
                  set index of win to 1
                  set active tab index of win to tabIndex
                end if
              end repeat
            end tell
          end if

          if proc = "Microsoft Edge" then
            tell application "Microsoft Edge"
              activate
              set win_List to every window
              repeat with win in win_List
                if title of win = windowName then
                  set index of win to 1
                  set active tab index of win to tabIndex
                end if
              end repeat
            end tell
          end if
          
          on extract_argv(source_string, new_delimiter)
            set backup to AppleScript's text item delimiters
            set AppleScript's text item delimiters to new_delimiter
            set argv to every text item of source_string
            set AppleScript's text item delimiters to backup
            return argv
          end extract_argv
          `);
          },
        };
      });
      display(results);
    });
  }
};

module.exports = {
  name: "Switch Windows",
  keyword: "win",
  icon: pluginIcon,
  fn,
};
