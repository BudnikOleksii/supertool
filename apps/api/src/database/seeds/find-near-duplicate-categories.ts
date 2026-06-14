import type { NearDuplicateCluster, SeedSourceRecord } from './seed.types';

const LATIN_HOMOGLYPHS = 'abcehikmoptxy';
const CYRILLIC_HOMOGLYPHS = 'аьсенікмортху';

const LATIN_TO_CYRILLIC = new Map(
  [...LATIN_HOMOGLYPHS].map((latinChar, index) => [
    latinChar,
    CYRILLIC_HOMOGLYPHS[index] ?? latinChar,
  ]),
);

const LATIN_LETTER = /[a-z]/iu;
const CYRILLIC_LETTER = /[Ѐ-ӿ]/u;
const MIN_CLUSTER_SIZE = 2;

const normalizeName = (name: string): string =>
  [...name.trim().toLowerCase()].map((char) => LATIN_TO_CYRILLIC.get(char) ?? char).join('');

const checkHasMixedScript = (name: string): boolean =>
  LATIN_LETTER.test(name) && CYRILLIC_LETTER.test(name);

export const findNearDuplicateCategories = (
  recordList: SeedSourceRecord[],
): NearDuplicateCluster[] => {
  const rawNameSet = new Set<string>();
  recordList.forEach((record) => {
    rawNameSet.add(record.Category);
    if (record.Subcategory) {
      rawNameSet.add(record.Subcategory);
    }
  });

  const clusterMap = new Map<string, Set<string>>();
  rawNameSet.forEach((rawName) => {
    const normalizedKey = normalizeName(rawName);
    const cluster = clusterMap.get(normalizedKey) ?? new Set<string>();
    cluster.add(rawName);
    clusterMap.set(normalizedKey, cluster);
  });

  const nearDuplicateClusterList: NearDuplicateCluster[] = [];
  clusterMap.forEach((rawNameCluster, normalizedKey) => {
    if (rawNameCluster.size < MIN_CLUSTER_SIZE) {
      return;
    }
    const rawNameList = [...rawNameCluster];
    nearDuplicateClusterList.push({
      normalizedKey,
      rawNameList,
      hasMixedScript: rawNameList.some(checkHasMixedScript),
    });
  });

  return nearDuplicateClusterList;
};
