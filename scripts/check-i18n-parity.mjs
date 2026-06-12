import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exit } from 'node:process';

const WORKSPACE_ROOT_LIST = ['apps', 'packages'];
const REFERENCE_LOCALE = 'en';
const REQUIRED_LOCALE_LIST = ['en', 'uk'];

const findMessagesDirList = () => {
  const messagesDirList = [];

  for (const workspaceRoot of WORKSPACE_ROOT_LIST) {
    if (!existsSync(workspaceRoot)) {
      continue;
    }

    for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidate = join(workspaceRoot, entry.name, 'messages');

      if (existsSync(candidate)) {
        messagesDirList.push(candidate);
      }
    }
  }

  return messagesDirList;
};

const flattenKeyList = (value, prefix) => {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    if (prefix === '') {
      return flattenKeyList(child, key);
    }

    return flattenKeyList(child, `${prefix}.${key}`);
  });
};

const readKeySet = (filePath) => {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'));

  return new Set(flattenKeyList(parsed, ''));
};

const collectLocaleList = (messagesDir) => {
  const presentLocaleList = readdirSync(messagesDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => fileName.replace(/\.json$/, ''));

  return [...new Set([...presentLocaleList, ...REQUIRED_LOCALE_LIST])];
};

const checkMessagesDir = (messagesDir) => {
  const problemList = [];
  const referencePath = join(messagesDir, `${REFERENCE_LOCALE}.json`);

  if (!existsSync(referencePath)) {
    return [`${messagesDir}: reference locale file ${REFERENCE_LOCALE}.json is missing`];
  }

  const referenceKeySet = readKeySet(referencePath);
  const localeList = collectLocaleList(messagesDir).filter((locale) => locale !== REFERENCE_LOCALE);

  for (const locale of localeList) {
    const localePath = join(messagesDir, `${locale}.json`);

    if (!existsSync(localePath)) {
      problemList.push(`${messagesDir}: locale file ${locale}.json is missing entirely`);
      continue;
    }

    const localeKeySet = readKeySet(localePath);
    const missingKeyList = [...referenceKeySet].filter((key) => !localeKeySet.has(key));
    const extraKeyList = [...localeKeySet].filter((key) => !referenceKeySet.has(key));

    for (const key of missingKeyList) {
      problemList.push(`${localePath}: missing key "${key}" (present in ${REFERENCE_LOCALE}.json)`);
    }

    for (const key of extraKeyList) {
      problemList.push(`${localePath}: extra key "${key}" (absent from ${REFERENCE_LOCALE}.json)`);
    }
  }

  return problemList;
};

const messagesDirList = findMessagesDirList();
const problemList = messagesDirList.flatMap((messagesDir) => checkMessagesDir(messagesDir));

if (problemList.length > 0) {
  console.error('i18n key parity check failed:');

  for (const problem of problemList) {
    console.error(`  ${problem}`);
  }

  exit(1);
}

console.log(`i18n key parity OK — ${messagesDirList.length} messages dir(s) checked`);
