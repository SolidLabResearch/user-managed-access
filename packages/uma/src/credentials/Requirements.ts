
export type ClaimVerifier = (...args: unknown[]) => Promise<boolean>;

export type Requirements = NodeJS.Dict<ClaimVerifier>;
