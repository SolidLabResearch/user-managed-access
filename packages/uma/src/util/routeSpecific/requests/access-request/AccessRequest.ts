/**
 * Simplistic interface for an AccessRequest
 * Could be improved by adding AccessRequestAction and AccessRequestStatus as types,
 * however that is not necessary.
 * requester and target should be made something else later on.
 */
export interface AccessRequest {
    issueDate: Date;
    target: string;
    action: "read" | "write" | "append" | "create" | "control";
    requester: string;
    status: "requested" | "accepted" | "denied";
}
