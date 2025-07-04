import { ODRL } from "@solidlab/ucp";
import { DataFactory } from "n3";

// relevant ODRL implementations
export const odrlAssigner = ODRL.terms.assigner;
export const relations = [
    ODRL.terms.permission,
    ODRL.terms.prohibition,
    ODRL.terms.duty
];

export const { namedNode } = DataFactory;

export interface PolicyBody {
    policy: string;
}

