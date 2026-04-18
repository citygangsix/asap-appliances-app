export function indexBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

export function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const groupKey = item[key];

    if (groupKey == null) {
      return groups;
    }

    const existingGroup = groups.get(groupKey) || [];
    existingGroup.push(item);
    groups.set(groupKey, existingGroup);
    return groups;
  }, new Map());
}
