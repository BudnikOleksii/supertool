const GENERATED_CLIENT_DIR = 'packages/shared/src/generated/';
const EMPTY_LENGTH = 0;

const buildCommandList = (fileList, commandList) => {
  const targetList = fileList.filter((file) => !file.includes(GENERATED_CLIENT_DIR));
  if (targetList.length === EMPTY_LENGTH) {
    return [];
  }
  const files = targetList.join(' ');
  return commandList.map((command) => `${command} ${files}`);
};

const lintStagedConfig = {
  '*.{js,jsx,cjs,mjs,ts,tsx,cts,mts}': (fileList) =>
    buildCommandList(fileList, ['oxfmt --write --no-error-on-unmatched-pattern', 'oxlint --fix']),
  '*.{json,md}': (fileList) =>
    buildCommandList(fileList, ['oxfmt --write --no-error-on-unmatched-pattern']),
  '*.{scss,css}': (fileList) => buildCommandList(fileList, ['stylelint --fix']),
};

export default lintStagedConfig;
