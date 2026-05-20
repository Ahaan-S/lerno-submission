export type SearchResultRelationship = "none" | "friends" | "request_sent" | "request_received";

export function searchResultRelationship(
    userId: string,
    friendIds: ReadonlySet<string>,
    outgoingRecipientIds: ReadonlySet<string>,
    incomingSenderIds: ReadonlySet<string>
): SearchResultRelationship {
    if (friendIds.has(userId)) return "friends";
    if (outgoingRecipientIds.has(userId)) return "request_sent";
    if (incomingSenderIds.has(userId)) return "request_received";
    return "none";
}
