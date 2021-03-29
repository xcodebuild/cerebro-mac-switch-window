/* eslint max-len: [0] */

const { shellCommand, memoize } = require('cerebro-tools');
const pluginIcon = require('./icon.png');
const {execFile} = require('child_process');
const path = require('path');
const parseString = require('xml2js').parseString;
const applescript = require('applescript');

const REGEXP = /win\s(.*)/;
const LIST_CMD = 'ps -A -o pid -o %cpu -o comm | sed 1d';

const DEFAULT_ICON = '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ExecutableBinaryIcon.icns';

const MEMOIZE_OPTIONS = {
  promise: 'then',
  maxAge: 5 * 1000,
  preFetch: true
}

const defaultOptions = {
  attributeNamePrefix : "@_",
  attrNodeName: "@", //default is false
  textNodeName : "#text",
  ignoreAttributes : true,
  cdataTagName: "__cdata", //default is false
  cdataPositionChar: "\\c",
  format: false,
  indentBy: "  ",
  supressEmptyNode: false,
  tagValueProcessor: a=> he.encode(a, { useNamedReferences: true}),// default is a=>a
  attrValueProcessor: a=> he.encode(a, {isAttributeValue: isAttribute, useNamedReferences: true})// default is a=>a
};


function getIcon(processPath) {
  const match = processPath.match(/^.*?\.app/);
  // If no .app was found, use OS X's generic 'executable binary' icon.
  return match ? match[0] : DEFAULT_ICON;
}

const findWindow = memoize((searchWindowName) => {
  return (async () => {
    const execPromise = new Promise(resolve => {
      const dirName = eval('__dirname');
      execFile(path.join(dirName, '../vendor/EnumWindows'), [`--search=${searchWindowName}`], (err, stdout, stderr) => {
        const output = stdout.toString();
        if (err || stderr) {
          alert(output);
        }
        parseString(output, (err, data) => {
          if (err) {
            console.error(err);
          }
          resolve(data);
        });
      });
    });
    const json = await execPromise;
    // xml => json
    return json && json.items && json.items.item;
  })();
}, MEMOIZE_OPTIONS);

/**
 * Plugin to look and display local and external IPs
 *
 * @param  {String} options.term
 * @param  {Function} options.display
 */
const fn = ({term, display}) => {
  const match = term.match(REGEXP);
  if (match) {
    const searchWindowName = match[1];
    
    if (!searchWindowName) {
      return;
    }
    findWindow(searchWindowName).then(list => {
      const results = list.map(({uid, title, subtitle, icon, $}) => ({
        title: title[0],
        id: $.uid,
        icon: icon[0],
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
        }
      }));
      display(results);
    });
  }
};

module.exports = {
  name: 'Switch Windows',
  keyword: 'win',
  icon: pluginIcon,
  fn
};
