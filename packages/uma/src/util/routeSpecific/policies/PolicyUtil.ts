import { ODRL } from "@solidlab/ucp";
import { DataFactory, Quad, Writer } from "n3";
import { HttpHandlerResponse } from "../../http/models/HttpHandler";

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

export async function quadsToText(quads: Quad[]): Promise<HttpHandlerResponse<any>> {
    // Serialize as Turtle
    const writer = new Writer({ format: 'Turtle' });
    writer.addQuads(quads);

    return new Promise<HttpHandlerResponse<any>>((resolve, reject) => {
        writer.end((error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve({
                    status: 200,
                    headers: { 'content-type': 'text/turtle' },
                    body: result
                });
            }
        });
    });
}