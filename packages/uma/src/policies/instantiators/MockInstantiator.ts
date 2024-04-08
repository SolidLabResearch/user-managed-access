import { Instantiator } from "./Instantiator";


export class MockInstantiator extends Instantiator {
    public instantiate(): void {
        throw new Error("Method not implemented.");
    }

}