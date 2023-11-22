
import * as jose from 'jose';

/**
 * A JwksKeyHolder is an interface for secrets management
 * w.r.t. JWTs.
 */
export abstract class JwksKeyHolder {
    public abstract getPublicKey(kid: string): jose.KeyLike;
    public abstract getPrivateKey(kid: string): jose.KeyLike;
    public abstract getDefaultKey(): Promise<string>;
    public abstract toPublicJwk(kid: string): Promise<jose.JWK>;
    public abstract getJwks(): Promise<jose.JSONWebKeySet>;
    public abstract getKids(): string[];
    public abstract generateKeypair(): Promise<string>;
    public abstract getAlg(): string;
}
