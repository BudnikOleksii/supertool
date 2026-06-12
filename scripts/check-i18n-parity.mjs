import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${filePath}: locale files must contain a top-level JSON object`);
  }

  return new Set(flattenKeyList(parsed, ''));
};

const listJsonFileNameList = (dirPath) =>
  readdirSync(dirPath).filter((fileName) => fileName.endsWith('.json'));

const compareKeySetList = (referencePath, localePath) => {
  const problemList = [];
  const referenceKeySet = readKeySet(referencePath);
  const localeKeySet = readKeySet(localePath);
  const missingKeyList = [...referenceKeySet].filter((key) => !localeKeySet.has(key));
  const extraKeyList = [...localeKeySet].filter((key) => !referenceKeySet.has(key));

  for (const key of missingKeyList) {
    problemList.push(`${localePath}: missing key "${key}" (present in ${referencePath})`);
  }

  for (const key of extraKeyList) {
    problemList.push(`${localePath}: extra key "${key}" (absent from ${referencePath})`);
  }

  return problemList;
};

const collectLocaleDirList = (messagesDir) => {
  const presentLocaleList = readdirSync(messagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return [...new Set([...presentLocaleList, ...REQUIRED_LOCALE_LIST])];
};

const checkLocaleDirLayout = (messagesDir) => {
  const problemList = [];
  const referenceDir = join(messagesDir, REFERENCE_LOCALE);
  const referenceFileNameList = listJsonFileNameList(referenceDir);
  const localeList = collectLocaleDirList(messagesDir).filter(
    (locale) => locale !== REFERENCE_LOCALE,
  );

  for (const locale of localeList) {
    const localeDir = join(messagesDir, locale);

    if (!existsSync(localeDir)) {
      problemList.push(`${messagesDir}: locale directory ${locale}/ is missing entirely`);
      continue;
    }

    const localeFileNameList = listJsonFileNameList(localeDir);

    for (const fileName of referenceFileNameList) {
      const localePath = join(localeDir, fileName);

      if (!existsSync(localePath)) {
        problemList.push(
          `${localeDir}: file ${fileName} is missing (present in ${REFERENCE_LOCALE}/)`,
        );
        continue;
      }

      problemList.push(...compareKeySetList(join(referenceDir, fileName), localePath));
    }

    for (const fileName of localeFileNameList) {
      if (!referenceFileNameList.includes(fileName)) {
        problemList.push(`${localeDir}: extra file ${fileName} (absent from ${REFERENCE_LOCALE}/)`);
      }
    }
  }

  return problemList;
};

const collectFlatLocaleList = (messagesDir) => {
  const presentLocaleList = listJsonFileNameList(messagesDir).map((fileName) =>
    fileName.replace(/\.json$/, ''),
  );

  return [...new Set([...presentLocaleList, ...REQUIRED_LOCALE_LIST])];
};

const checkFlatLayout = (messagesDir) => {
  const problemList = [];
  const referencePath = join(messagesDir, `${REFERENCE_LOCALE}.json`);

  if (!existsSync(referencePath)) {
    return [`${messagesDir}: reference locale file ${REFERENCE_LOCALE}.json is missing`];
  }

  const localeList = collectFlatLocaleList(messagesDir).filter(
    (locale) => locale !== REFERENCE_LOCALE,
  );

  for (const locale of localeList) {
    const localePath = join(messagesDir, `${locale}.json`);

    if (!existsSync(localePath)) {
      problemList.push(`${messagesDir}: locale file ${locale}.json is missing entirely`);
      continue;
    }

    problemList.push(...compareKeySetList(referencePath, localePath));
  }

  return problemList;
};

const checkMessagesDir = (messagesDir) => {
  const referenceDir = join(messagesDir, REFERENCE_LOCALE);

  if (existsSync(referenceDir) && statSync(referenceDir).isDirectory()) {
    return checkLocaleDirLayout(messagesDir);
  }

  return checkFlatLayout(messagesDir);
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
