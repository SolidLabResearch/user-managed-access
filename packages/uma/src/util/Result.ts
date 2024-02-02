
export type Result<S,F> = Success<S> | Failure<F>

const SUCCESS = Symbol('success');

export interface Success<S> { value: S; [SUCCESS]: true; };
export interface Failure<F> { value: F; [SUCCESS]: false; };

export const Success = <S> (value: S): Success<S> => ({ value, [SUCCESS]: true, });
export const Failure = <F> (value: F): Failure<F> => ({ value, [SUCCESS]: false, });

export function success<S,F>(result: Result<S,F>): result is Success<S> { return result[SUCCESS]; }
export function failure<S,F>(result: Result<S,F>): result is Failure<F> { return result[SUCCESS]; }
