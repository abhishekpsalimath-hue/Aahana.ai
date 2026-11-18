export function isFounderUser(userId, founderUserId) {
  return typeof userId === "string" && userId.length > 0 &&
    typeof founderUserId === "string" && founderUserId.length > 0 &&
    userId === founderUserId;
}
