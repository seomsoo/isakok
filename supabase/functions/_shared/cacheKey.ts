export function buildCacheKey(conditions: {
  housing_type: string
  contract_type: string
  move_type: string
  prompt_version?: string
}): string {
  return [
    conditions.housing_type,
    conditions.contract_type,
    conditions.move_type,
    conditions.prompt_version,
  ]
    .filter(Boolean)
    .join('_')
}
