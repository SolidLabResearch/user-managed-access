
export type ClaimVerifier = (...args: unknown[]) => boolean;

export type Requirements = NodeJS.Dict<ClaimVerifier>;