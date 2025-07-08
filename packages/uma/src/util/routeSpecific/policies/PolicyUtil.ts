import { ODRL } from "@solidlab/ucp";
import { DataFactory, Quad, Writer } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { MethodNotAllowedHttpError } from "@solid/community-server";

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

/**
 * Function to test if the baseUrl is a prefix of the full URL. It returns the part after the baseUrl
 * 
 * @param request
 * @param baseUrl 
 * @returns the part after the baseUrl
 */
export const checkBaseURL = (request: HttpHandlerRequest, baseUrl: string) => {
    if (request.url.href.slice(0, baseUrl.length) !== baseUrl) throw new MethodNotAllowedHttpError();
    return request.url.href.slice(baseUrl.length);
}

/**
 * Function to extract the ID for endpoints with URL baseUrl/policies/<id>
 * 
 * @param pathname the part of the URL after the baseUrl
 * @returns the ID
 */
export const retrieveID = (pathname: string): string => {
    const args = pathname.split('/');
    if (args.length !== 3 || args[1] !== 'policies') throw new MethodNotAllowedHttpError();
    return args[2];
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