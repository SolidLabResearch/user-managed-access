
export abstract class Handler<T = void, S = void> {

  abstract handle(input: T): Promise<S>;

}
