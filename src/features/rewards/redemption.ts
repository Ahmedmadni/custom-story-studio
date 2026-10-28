export const REDEMPTION_POINTS = 100;
export const REDEMPTION_DISCOUNT_EGP = 25;

/** Integer allocations preserve the total and never exceed an item's price. */
export function allocateDiscount(amounts: number[], discount: number): number[] {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isInteger(discount) || discount < 0 || discount > total) {
    throw new Error("قيمة الخصم غير صالحة");
  }
  if (total === 0) return amounts.map(() => 0);
  const shares = amounts.map((amount) => Math.floor((amount * discount) / total));
  let remaining = discount - shares.reduce((sum, share) => sum + share, 0);
  for (let i = 0; remaining > 0; i = (i + 1) % amounts.length) {
    if (shares[i] < amounts[i]) {
      shares[i] += 1;
      remaining -= 1;
    }
  }
  return shares;
}

export function rewardDiscount(points: number, eligibleAmount: number): number {
  if (points === 0) return 0;
  if (points !== REDEMPTION_POINTS) throw new Error("اختر مكافأة 100 نقطة فقط");
  if (eligibleAmount < REDEMPTION_DISCOUNT_EGP) {
    throw new Error("المبلغ بعد الخصومات أقل من قيمة مكافأة النقاط");
  }
  return REDEMPTION_DISCOUNT_EGP;
}