function leadingSpaces(value) {
  const match = String(value ?? "").match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function stripInlineComment(value) {
  const raw = String(value ?? "");
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const previous = i > 0 ? raw[i - 1] : "";
    if (char === "'" && !inDouble && previous !== "\\") {
      inSingle = !inSingle;
      continue;
    }
    if (char === "\"" && !inSingle && previous !== "\\") {
      inDouble = !inDouble;
      continue;
    }
    if (char === "#" && !inSingle && !inDouble) {
      const before = i === 0 ? "" : raw[i - 1];
      if (!before || /\s/.test(before)) {
        return raw.slice(0, i).trimEnd();
      }
    }
  }

  return raw.trim();
}

function splitInlineCollection(value) {
  const raw = String(value ?? "").trim();
  const items = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const previous = i > 0 ? raw[i - 1] : "";
    if (char === "'" && !inDouble && previous !== "\\") {
      inSingle = !inSingle;
      current += char;
      continue;
    }
    if (char === "\"" && !inSingle && previous !== "\\") {
      inDouble = !inDouble;
      current += char;
      continue;
    }
    if (char === "," && !inSingle && !inDouble) {
      items.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) items.push(current.trim());
  return items;
}

function parseScalar(value) {
  const stripped = stripInlineComment(value);
  if (!stripped) return "";

  if (
    (stripped.startsWith("\"") && stripped.endsWith("\"")) ||
    (stripped.startsWith("'") && stripped.endsWith("'"))
  ) {
    return stripped.slice(1, -1);
  }

  if (stripped === "[]") return [];
  if (stripped === "{}") return {};
  if (stripped === "true") return true;
  if (stripped === "false") return false;
  if (stripped === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(stripped)) return Number(stripped);

  if (stripped.startsWith("[") && stripped.endsWith("]")) {
    const inner = stripped.slice(1, -1).trim();
    if (!inner) return [];
    return splitInlineCollection(inner).map(item => parseScalar(item));
  }

  return stripped;
}

function findNextSignificantLine(lines, startIndex) {
  for (let i = startIndex; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (!rawLine || !rawLine.trim()) continue;
    return { index: i, line: rawLine };
  }
  return null;
}

function parseObject(lines, indentLevel, startIndex) {
  const result = {};
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    if (!rawLine || !rawLine.trim()) {
      index += 1;
      continue;
    }

    const indent = leadingSpaces(rawLine);
    if (indent < indentLevel) break;
    if (indent > indentLevel) {
      index += 1;
      continue;
    }

    const trimmed = rawLine.trim();
    if (trimmed.startsWith("- ")) break;

    const keyVal = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!keyVal) {
      index += 1;
      continue;
    }

    const key = keyVal[1].trim();
    const rest = keyVal[2];
    if (rest && rest.trim()) {
      result[key] = parseScalar(rest);
      index += 1;
      continue;
    }

    const next = findNextSignificantLine(lines, index + 1);
    if (!next || leadingSpaces(next.line) <= indentLevel) {
      result[key] = [];
      index += 1;
      continue;
    }

    const nextIndent = leadingSpaces(next.line);
    if (next.line.trim().startsWith("- ")) {
      const parsedArray = parseArray(lines, nextIndent, next.index);
      result[key] = parsedArray.value;
      index = parsedArray.nextIndex;
      continue;
    }

    const parsedObject = parseObject(lines, nextIndent, next.index);
    result[key] = parsedObject.value;
    index = parsedObject.nextIndex;
  }

  return { value: result, nextIndex: index };
}

function parseArray(lines, indentLevel, startIndex) {
  const result = [];
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    if (!rawLine || !rawLine.trim()) {
      index += 1;
      continue;
    }

    const indent = leadingSpaces(rawLine);
    if (indent < indentLevel) break;
    if (indent > indentLevel) {
      index += 1;
      continue;
    }

    const trimmed = rawLine.trim();
    if (!trimmed.startsWith("- ")) break;
    const content = trimmed.slice(2).trim();

    if (!content) {
      result.push("");
      index += 1;
      continue;
    }

    const inlineKeyVal = content.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!inlineKeyVal) {
      result.push(parseScalar(content));
      index += 1;
      continue;
    }

    const item = {
      [inlineKeyVal[1].trim()]: parseScalar(inlineKeyVal[2])
    };
    index += 1;

    while (index < lines.length) {
      const continuationLine = lines[index];
      if (!continuationLine || !continuationLine.trim()) {
        index += 1;
        continue;
      }

      const continuationIndent = leadingSpaces(continuationLine);
      if (continuationIndent <= indentLevel) break;

      const continuationTrimmed = continuationLine.trim();
      const continuationMatch = continuationTrimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!continuationMatch) {
        index += 1;
        continue;
      }

      const continuationKey = continuationMatch[1].trim();
      const continuationRest = continuationMatch[2];
      if (continuationRest && continuationRest.trim()) {
        item[continuationKey] = parseScalar(continuationRest);
        index += 1;
        continue;
      }

      const next = findNextSignificantLine(lines, index + 1);
      if (!next || leadingSpaces(next.line) <= continuationIndent) {
        item[continuationKey] = [];
        index += 1;
        continue;
      }

      if (next.line.trim().startsWith("- ")) {
        const nestedArray = parseArray(lines, leadingSpaces(next.line), next.index);
        item[continuationKey] = nestedArray.value;
        index = nestedArray.nextIndex;
        continue;
      }

      const nestedObject = parseObject(lines, leadingSpaces(next.line), next.index);
      item[continuationKey] = nestedObject.value;
      index = nestedObject.nextIndex;
    }

    result.push(item);
  }

  return { value: result, nextIndex: index };
}

function parseFrontMatter(raw) {
  const text = String(raw ?? "");
  if (!text.startsWith("---")) {
    return { frontMatter: {}, body: text.trim() };
  }

  const endMarker = "\n---";
  const endIdx = text.indexOf(endMarker, 3);
  if (endIdx < 0) {
    return { frontMatter: {}, body: text.trim() };
  }

  const frontRaw = text.slice(3, endIdx).trim();
  const body = text.slice(endIdx + endMarker.length).trim();
  const lines = frontRaw.split(/\r?\n/);
  return {
    frontMatter: parseObject(lines, 0, 0).value,
    body
  };
}

module.exports = { parseFrontMatter };
