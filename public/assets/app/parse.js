angular.module('ms-parse', [])

// ==================================
// Clean up a string
// ==================================
.factory('parseClean', function () {
  return function (text) {
    text = text || '';
    return text.trim().toLowerCase();
  };
})

// ==================================
// The big daddy regex
// ==================================
.factory('parseRegex', function () {
  return (/([A-Z\s'‘’“”\(\)\&]+)[A-Za-z\s.,!']([A-Z\s'‘’“”\(\)\&]+)[A-Za-z\s.,!']([A-Z\s'‘’“”\(\)\&]+)/g);
})

// ==================================
// The size regex
// ==================================
.factory('parseSizeRegex', function () {
  return (/\[.+?\]/g);
})

// ==================================
// Sort out a size array
// ==================================
.factory('parseSizes', function () {
  return function (sizes) {
    return sizes.map(function (segment) {
      return segment
              .replace('[', '')
              .replace(']', '');
    });
  };
})

// ==================================
// Parse subitem
// ==================================
.factory('parseSubitem', [
  'parseSizes', 'parseSizeRegex',
function (parseSizes, parseSizeRegex) {
  return function (originalLine) {
    originalLine = originalLine.trim().replace(/^-/, '');
    // Extract the different segments
    var sizes = originalLine.match(parseSizeRegex),
        line = originalLine.replace(parseSizeRegex, '');

    var text = line.split(/\s?[#@]\w+\s?/g),
        entities = line.match(/[#@]\w+/g),
        segments = [];
    // Interpolate them back together
    while (text.length) {
      segments.push(text.shift());
      if (entities && entities.length) {
        segments.push(entities.shift());
      }
    }
    // Remove the duffers and then convert them into objects to use later
    var subitem = segments.filter(function (seg) {
      return !!seg;
    }).map(function (seg) {
      var obj = {
        hashtag: false,
        mention: false,
        size: false,
        text: false,
        raw: seg
      };
      if (seg.match(/#\w+/)) {
        obj.hashtag = true;
      } else if (seg.match(/@\w+/)) {
        obj.mention = true;
      } else {
        obj.text = true;
      }
      return obj;
    });

    // Parse sizes
    if (sizes) {
      subitem.sizes = parseSizes(sizes);
    }

    subitem.original = originalLine;
    return subitem;
  };
}])

// ==================================
// Parse the raw user stories file
// ==================================
.factory('parse', [
  'parseClean', 'parseRegex', 'parseSubitem', '$filter', 'parseSizes', 'parseSizeRegex',
function (parseClean, parseRegex, parseSubitem, $filter, parseSizes, parseSizeRegex) {

  return function (raw) {
    raw = raw || '';

    var lines = raw.split('\n'),
        sections = [],
        groups = {},
        groupname = null,
        lastStory = {};

    // Iterate over the lines, extracting stories as we go
    lines.forEach(function (line, index) {

      var cleanedSizes = [];

      // Extract group headings
      if (line.match('---')) {
        return groupname = parseClean(lines[index - 1]);
      } else if (line.match(/^#+\s/)) {
        return groupname = parseClean(line);
      }

      // If this a new group create it, and push a reference onto the sections
      // array so we maintain the order in the storied file
      if (groupname && !groups[groupname]) {
        groups[groupname] = [];
        groups[groupname].$key = $filter('capitalize')(groupname);
        sections.push(groups[groupname]);
      }


      // Extract subitems
      if (line.match(/^\s+/)) {
        var subitem = parseSubitem(line);
        return lastStory.subitems.push(subitem);
      }


      line = line.trim().replace(/^-/, '').trim();

      // Extract bugs
      if (line.match(/^#bug/)) {
        var bug = parseSubitem(line);
        bug.isBug = true;
        return groups[groupname].push(bug);
      }

      // Match the line!
      var res = line.match(parseRegex),
          sizes = line.match(parseSizeRegex);

      if (!res) return;

      if (res && !groupname) return alert("Ungrouped story found.\n\n" + line);

      if (sizes) {
        cleanedSizes = parseSizes(sizes);
      }

      // Clean the segments up, to account for a poorish regex
      var cleaned = res.map(function (segment, index) {
        var str = (segment || '')
                    .replace(',', '')
                    .replace(/as a/i, '')
                    .trim();
        if (index === 0) str = str.replace(/ i/i, '');
        return parseClean(str);
      });

      cleaned = cleaned.slice(0,2).concat(cleaned.slice(2).join(' '));

      // Build the story object
      lastStory = {
        isStory: true,
        who: cleaned[0],
        what: cleaned[1],
        why: cleaned[2],
        sizes: cleanedSizes,
        raw: line,
        subitems: []
      };

      groups[groupname].push(lastStory);

    });

    return sections;

  };

}])

;