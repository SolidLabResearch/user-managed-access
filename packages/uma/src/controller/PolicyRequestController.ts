import { KeyValueStorage } from '@solid/community-server';
import { Quad, Quad_Object, Quad_Subject, Store } from 'n3';
import { UCRulesStorage } from "../ucp/storage/UCRulesStorage";
import { ODRL } from '../ucp/util/Vocabularies';
import { BaseController } from "./BaseController";
import {
    deletePolicy,
    getPolicies,
    getPolicy,
    patchPolicy,
    postPolicy
} from "../util/routeSpecific";

/**
 * Controller for routes concerning policies and related rules
 */
export class PolicyController extends BaseController {
    constructor(
        store: UCRulesStorage,
        private readonly revocationStore?: KeyValueStorage<string, number>,
    ) {
        super(
            store,
            "Already existing policies found",
            postPolicy,
            deletePolicy,
            getPolicies,
            getPolicy,
            patchPolicy,
        );
    }

    public async addEntity(data: string, clientID: string): Promise<{ status: number, message: string }> {
        return this.invalidateChangedTargets(() => super.addEntity(data, clientID));
    }

    public async deleteEntity(entityID: string, clientID: string): Promise<{ status: number }> {
        return this.invalidateChangedTargets(() => super.deleteEntity(entityID, clientID));
    }

    public async patchEntity(entityID: string | undefined, patchInformation: string, clientID: string, isolate = true):
        Promise<{ status: number, message: string }> {
        return this.invalidateChangedTargets(() => super.patchEntity(entityID, patchInformation, clientID, isolate));
    }

    public async putEntity(data: string, entityID: string, clientID: string): Promise<{ status: number }> {
        return this.invalidateChangedTargets(() => super.putEntity(data, entityID, clientID));
    }

    private async invalidateChangedTargets<T extends { status: number }>(operation: () => Promise<T>): Promise<T> {
        if (!this.revocationStore) {
            return operation();
        }

        const before = await this.store.getStore();
        const result = await operation();
        if (result.status < 200 || result.status >= 300) {
            return result;
        }

        const after = await this.store.getStore();
        const revokedAt = Date.now();
        for (const target of this.collectChangedTargets(before, after)) {
            await this.revocationStore.set(target, revokedAt);
        }
        return result;
    }

    private collectChangedTargets(before: Store, after: Store): Set<string> {
        const targets = new Set<string>();
        const changedSubjects = new Map<string, Quad_Subject>();

        const collectChangedQuad = (store: Store, quad: Quad): void => {
            changedSubjects.set(this.termKey(quad.subject), quad.subject);
            if (quad.predicate.equals(ODRL.terms.target) && quad.object.termType === 'NamedNode') {
                targets.add(quad.object.value);
            }
            if (quad.predicate.equals(ODRL.terms.permission)) {
                this.collectPermissionTargets(store, quad.object, targets);
            }
        };

        for (const quad of before.difference(after)) {
            collectChangedQuad(before, quad as Quad);
        }
        for (const quad of after.difference(before)) {
            collectChangedQuad(after, quad as Quad);
        }

        for (const subject of changedSubjects.values()) {
            this.collectSubjectTargets(before, subject, targets);
            this.collectSubjectTargets(after, subject, targets);
        }

        return targets;
    }

    private collectSubjectTargets(store: Store, subject: Quad_Subject, targets: Set<string>): void {
        this.collectPermissionTargets(store, subject, targets);
        for (const permission of store.getObjects(subject, ODRL.terms.permission, null)) {
            this.collectPermissionTargets(store, permission, targets);
        }
    }

    private collectPermissionTargets(store: Store, permission: Quad_Subject | Quad_Object, targets: Set<string>): void {
        if (permission.termType !== 'NamedNode' && permission.termType !== 'BlankNode') {
            return;
        }
        for (const target of store.getObjects(permission, ODRL.terms.target, null)) {
            if (target.termType === 'NamedNode') {
                targets.add(target.value);
            }
        }
    }

    private termKey(term: Quad_Subject | Quad_Object): string {
        return `${term.termType}:${term.value}`;
    }
}
