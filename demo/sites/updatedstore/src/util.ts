import { Item } from "./App";
import { processAgeResult, retrieveData } from "./flow";

export const getPriceString = (item: Item) => (item.price_cents / 100).toFixed(2) 
export const getPriceStringDirectly = (price_cents: number) => (price_cents / 100).toFixed(2) 


export const performAgeVerification = async (webId: string) => {
    console.log('running verification for', webId)

    const ageData = await retrieveData(webId);
    const result = await processAgeResult(ageData, webId)
    return result

}