export const ProjectStages = [
    "DRAFT",
    "ANALYZING",
    "ANALYSIS_REVIEW",
    "STRUCTURING",
    "STRUCTURE_REVIEW",
    "RESOLVING_RESOURCES",
    "RESOURCES_REVIEW",
    "ART_DIRECTING",
    "ART_DIRECTION_REVIEW",
    "GENERATING",
    "GENERATED",
    "VERIFYING",
    "VERIFICATION_REVIEW",
    "APPROVED",
    "FINAL",
    "ARCHIVED"
];
const allowedTransitions = {
    DRAFT: ["ANALYZING", "ARCHIVED"],
    ANALYZING: ["ANALYSIS_REVIEW", "ARCHIVED"],
    ANALYSIS_REVIEW: ["ANALYZING", "STRUCTURING", "ARCHIVED"],
    STRUCTURING: ["STRUCTURE_REVIEW", "ARCHIVED"],
    STRUCTURE_REVIEW: ["STRUCTURING", "RESOLVING_RESOURCES", "ARCHIVED"],
    RESOLVING_RESOURCES: ["RESOURCES_REVIEW", "ARCHIVED"],
    RESOURCES_REVIEW: ["RESOLVING_RESOURCES", "ART_DIRECTING", "ARCHIVED"],
    ART_DIRECTING: ["ART_DIRECTION_REVIEW", "ARCHIVED"],
    ART_DIRECTION_REVIEW: ["ART_DIRECTING", "STRUCTURING", "GENERATING", "ARCHIVED"],
    GENERATING: ["GENERATED", "ARCHIVED"],
    GENERATED: ["VERIFYING", "GENERATING", "ARCHIVED"],
    VERIFYING: ["VERIFICATION_REVIEW", "ARCHIVED"],
    VERIFICATION_REVIEW: ["VERIFYING", "GENERATING", "APPROVED", "ARCHIVED"],
    APPROVED: ["FINAL", "GENERATING", "ARCHIVED"],
    FINAL: ["ARCHIVED"],
    ARCHIVED: []
};
export class TransitionError extends Error {
    code;
    constructor(code, message) {
        super(message ?? code);
        this.code = code;
        this.name = "TransitionError";
    }
}
function isCurrentVersionApproved(approval) {
    return approval.currentVersionId !== null && approval.currentVersionId === approval.approvedVersionId;
}
function assertStageGuards(to, approval) {
    if (to === "STRUCTURING" && !isCurrentVersionApproved(approval.analysis)) {
        throw new TransitionError("ANALYSIS_APPROVAL_REQUIRED");
    }
    if (to === "RESOLVING_RESOURCES" && !isCurrentVersionApproved(approval.structure)) {
        throw new TransitionError("STRUCTURE_APPROVAL_REQUIRED");
    }
    if (to === "ART_DIRECTING" && !isCurrentVersionApproved(approval.resources)) {
        throw new TransitionError("RESOURCES_APPROVAL_REQUIRED");
    }
    if (to === "GENERATING" && !isCurrentVersionApproved(approval.artDirection)) {
        throw new TransitionError("ART_DIRECTION_APPROVAL_REQUIRED");
    }
    if (to === "APPROVED") {
        if (!approval.verificationPassed || !isCurrentVersionApproved(approval.verification)) {
            throw new TransitionError("VERIFICATION_PASS_REQUIRED");
        }
        if (approval.criticalErrors.length > 0) {
            throw new TransitionError("CRITICAL_ERRORS_BLOCK_APPROVAL");
        }
    }
    if (to === "FINAL") {
        if (!approval.verificationPassed ||
            !isCurrentVersionApproved(approval.verification) ||
            approval.criticalErrors.length > 0) {
            throw new TransitionError("FINAL_BLOCKED_BY_VERIFICATION");
        }
    }
}
export function transition(from, to, approval) {
    if (!allowedTransitions[from].includes(to)) {
        throw new TransitionError("INVALID_STAGE_TRANSITION", `${from} -> ${to} is not allowed`);
    }
    assertStageGuards(to, approval);
    return to;
}
export function canTransition(from, to, approval) {
    try {
        transition(from, to, approval);
        return true;
    }
    catch {
        return false;
    }
}
