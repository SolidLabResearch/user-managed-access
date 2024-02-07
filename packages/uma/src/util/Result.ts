
export type Result<S,F> = Success<S> | Failure<F>

export interface Success<S> { value: S; success: true; };
export interface Failure<F> { value: F; success: false; };

export const Success = <S> (value: S): Success<S> => ({ value, success: true, });
export const Failure = <F> (value: F): Failure<F> => ({ value, success: false, });
