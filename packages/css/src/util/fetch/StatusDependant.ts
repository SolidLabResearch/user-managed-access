
/**
 * Any object of which a status can be changed.
 */
export interface StatusDependant<T> {
  changeStatus(status: T): Promise<void>, 
}
