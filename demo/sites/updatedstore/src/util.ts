import { Item } from "./App";

export const getPriceString = (item: Item) => (item.price_cents / 100).toFixed(2) 
export const getPriceStringDirectly = (price_cents: number) => (price_cents / 100).toFixed(2) 


export const performAgeVerification = async (webId: string) => {
    console.log('running verification for', webId)

    // todo:: do age verification in the backend
    
    throw new Error('NotImplementedError')

}