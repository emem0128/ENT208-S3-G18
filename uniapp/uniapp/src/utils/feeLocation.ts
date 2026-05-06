export interface FeeLocationItem {
  location: string
  amount: number
}

export function parseFeeLocationDetail(feeLocationDetail?: string | null) {
  const locationMap: Record<string, FeeLocationItem[]> = {}

  if (!feeLocationDetail) {
    return locationMap
  }

  const parts = feeLocationDetail.split(';').map((s) => s.trim()).filter(Boolean)
  for (const part of parts) {
    const match = part.match(/^(.+?)\((.+?)\):(-?\d+(\.\d+)?)$/)
    if (!match) continue

    const displayName = match[1].trim()
    const location = match[2].trim()
    const amount = Number.parseFloat(match[3])
    if (!displayName || !location || Number.isNaN(amount)) continue

    if (!locationMap[displayName]) {
      locationMap[displayName] = []
    }

    locationMap[displayName].push({location, amount})
  }

  return locationMap
}
